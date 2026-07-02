from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

from .config import settings
from .reporting import send_daily_report

client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
scheduler = BackgroundScheduler(timezone="America/Lima")


def scheduled_report() -> None:
    if not settings.resend_api_key:
        return
    rows = client.table("notification_settings").select("*").eq("id", 1).limit(1).execute().data or []
    config = rows[0] if rows else None
    if not config or not config["enabled"]:
        return
    if config.get("weekdays_only", True) and date.today().weekday() >= 5:
        return
    send_daily_report(client)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.scheduler_enabled:
        # Revisa cada minuto; solo ejecuta al coincidir con la hora configurada.
        def check_schedule() -> None:
            from datetime import datetime
            rows = client.table("notification_settings").select("send_time,enabled").eq("id", 1).limit(1).execute().data or []
            config = rows[0] if rows else None
            if not config or not config["enabled"]:
                return
            now = datetime.now()
            target = str(config["send_time"])[:5]
            if now.strftime("%H:%M") == target:
                already_sent = (
                    client.table("report_deliveries")
                    .select("id", count="exact")
                    .eq("report_date", now.date().isoformat())
                    .eq("status", "sent")
                    .execute()
                )
                if not already_sent.count:
                    scheduled_report()

        scheduler.add_job(check_schedule, "interval", minutes=1, id="daily_report_check", replace_existing=True)
        scheduler.start()
    yield
    if scheduler.running:
        scheduler.shutdown()


app = FastAPI(title="Justifica Admin API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=120)
    department: str = Field(default="", max_length=120)
    role: str = "user"
    status: str = "active"
    password: str = Field(min_length=10, max_length=128)


class UserUpdate(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=120)
    department: str = Field(default="", max_length=120)
    role: str = "user"
    status: str = "active"


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=10, max_length=128)


class JustificationStatusUpdate(BaseModel):
    status: str


def validate_user_fields(role: str, status: str) -> None:
    if role not in {"admin", "user"}:
        raise HTTPException(status_code=422, detail="Rol inválido")
    if status not in {"active", "inactive"}:
        raise HTTPException(status_code=422, detail="Estado inválido")


def require_admin(authorization: str = Header(default="")) -> str:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sesión requerida")
    try:
        user = client.auth.get_user(token).user
        profile = client.table("profiles").select("role,status").eq("id", user.id).single().execute().data
        if profile["role"] != "admin" or profile["status"] != "active":
            raise HTTPException(status_code=403, detail="Acceso exclusivo para administradores")
        return user.id
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sesión inválida") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "justifica-admin-api"}


@app.post("/api/reports/daily/send")
def trigger_daily_report(_: str = Depends(require_admin)) -> dict:
    if not settings.resend_api_key:
        raise HTTPException(
            status_code=503,
            detail="Falta configurar RESEND_API_KEY en backend/.env",
        )
    return send_daily_report(client)


@app.post("/api/reports/daily/test")
def test_daily_report(_: str = Depends(require_admin)) -> dict:
    if not settings.resend_api_key:
        raise HTTPException(
            status_code=503,
            detail="Falta configurar RESEND_API_KEY en backend/.env",
        )
    return send_daily_report(client, is_test=True)


@app.post("/api/admin/users", status_code=201)
def create_user(payload: UserCreate, _: str = Depends(require_admin)) -> dict:
    """Crea la identidad en Auth; Supabase almacena la contraseña con hash."""
    validate_user_fields(payload.role, payload.status)
    try:
        result = client.auth.admin.create_user({
            "email": payload.email.strip().lower(),
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"full_name": payload.full_name},
        })
        user = result.user
        if not user:
            raise HTTPException(status_code=400, detail="No se pudo crear la identidad")
        profile = {
            "email": payload.email.strip().lower(),
            "full_name": payload.full_name.strip(),
            "department": payload.department.strip() or None,
            "role": payload.role,
            "status": payload.status,
        }
        client.table("profiles").update(profile).eq("id", user.id).execute()
        client.table("audit_logs").insert({
            "actor_id": _,
            "action": "user_created",
            "entity_type": "profile",
            "entity_id": user.id,
            "metadata": {"email": profile["email"], "role": payload.role},
        }).execute()
        return {"id": user.id}
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "already" in message.lower() or "registered" in message.lower():
            raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo") from exc
        raise HTTPException(status_code=400, detail="No se pudo crear el usuario") from exc


@app.patch("/api/admin/users/{user_id}")
def update_user(user_id: str, payload: UserUpdate, actor_id: str = Depends(require_admin)) -> dict:
    validate_user_fields(payload.role, payload.status)
    try:
        client.auth.admin.update_user_by_id(user_id, {
            "email": payload.email.strip().lower(),
            "user_metadata": {"full_name": payload.full_name},
        })
        client.table("profiles").update({
            "email": payload.email.strip().lower(),
            "full_name": payload.full_name.strip(),
            "department": payload.department.strip() or None,
            "role": payload.role,
            "status": payload.status,
        }).eq("id", user_id).execute()
        client.table("audit_logs").insert({
            "actor_id": actor_id,
            "action": "user_updated",
            "entity_type": "profile",
            "entity_id": user_id,
            "metadata": {"role": payload.role, "status": payload.status},
        }).execute()
        return {"id": user_id}
    except Exception as exc:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el usuario") from exc


@app.put("/api/admin/users/{user_id}/password")
def update_password(user_id: str, payload: PasswordUpdate, actor_id: str = Depends(require_admin)) -> dict:
    try:
        client.auth.admin.update_user_by_id(user_id, {"password": payload.password})
        client.table("audit_logs").insert({
            "actor_id": actor_id,
            "action": "password_reset",
            "entity_type": "profile",
            "entity_id": user_id,
            "metadata": {},
        }).execute()
        return {"updated": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail="No se pudo cambiar la contraseña") from exc


@app.get("/api/admin/legacy-justifications")
def list_legacy_justifications(_: str = Depends(require_admin)) -> list[dict]:
    """Adapta la tabla `justificaciones` existente al panel nuevo."""
    try:
        rows = (
            client.table("justificaciones")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        audit_rows = (
            client.table("audit_logs")
            .select("entity_id,metadata,created_at")
            .eq("entity_type", "legacy_justification")
            .eq("action", "status_changed")
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        latest_status: dict[str, str] = {}
        for audit in audit_rows:
            entity_id = audit.get("entity_id")
            if entity_id and entity_id not in latest_status:
                latest_status[entity_id] = (audit.get("metadata") or {}).get("status", "pending")
        for row in rows:
            row["review_status"] = latest_status.get(row["id"], "pending")
        return rows
    except Exception as exc:
        raise HTTPException(status_code=400, detail="No se pudieron consultar las justificaciones existentes") from exc


@app.post("/api/admin/legacy-justifications/{justification_id}/status")
def review_legacy_justification(
    justification_id: str,
    payload: JustificationStatusUpdate,
    actor_id: str = Depends(require_admin),
) -> dict:
    if payload.status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=422, detail="Estado inválido")
    try:
        existing = (
            client.table("justificaciones")
            .select("id")
            .eq("id", justification_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not existing:
            raise HTTPException(status_code=404, detail="La justificación no existe")
        client.table("audit_logs").insert({
            "actor_id": actor_id,
            "action": "status_changed",
            "entity_type": "legacy_justification",
            "entity_id": justification_id,
            "metadata": {"status": payload.status},
        }).execute()
        return {"updated": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="No se pudo actualizar la justificación") from exc
