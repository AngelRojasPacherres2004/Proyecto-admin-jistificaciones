from __future__ import annotations

from datetime import date
from email.message import EmailMessage
from email.utils import make_msgid
from html import escape
import smtplib
from typing import Any

import resend
from supabase import Client

from .config import settings


def get_daily_data(client: Client, report_date: date) -> dict[str, Any]:
    day = report_date.isoformat()
    justifications = (
        client.table("justifications")
        .select("id,date,reason,status,created_at,profiles!justifications_user_id_fkey(full_name,department)")
        .eq("date", day)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    legacy_rows = (
        client.table("justificaciones")
        .select("id,dni,nombre_completo,fecha_inasistencia,motivo,descripcion,documento_url,created_at")
        .eq("fecha_inasistencia", day)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    legacy_justifications = [
        {
            "id": item["id"],
            "date": item["fecha_inasistencia"],
            "reason": item["motivo"],
            "description": item.get("descripcion"),
            "status": "pending",
            "created_at": item["created_at"],
            "profiles": {
                "full_name": item["nombre_completo"],
                "department": f"DNI {item['dni']}",
            },
        }
        for item in legacy_rows
    ]
    justifications.extend(legacy_justifications)
    attendance = (
        client.table("attendance")
        .select("status")
        .eq("attendance_date", day)
        .execute()
        .data
        or []
    )
    pending = (
        client.table("justifications")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )
    present = sum(1 for row in attendance if row["status"] in {"present", "late"})
    attendance_rate = round((present / len(attendance) * 100), 1) if attendance else 0
    return {
        "date": report_date,
        "justifications": justifications,
        "total_absences": sum(1 for row in attendance if row["status"] == "absent"),
        "attendance_rate": attendance_rate,
        "pending_total": pending.count or 0,
    }


def render_email(data: dict[str, Any], sections: dict[str, bool] | None = None) -> str:
    sections = sections or {}
    status_labels = {"pending": "Pendiente", "approved": "Aprobada", "rejected": "Rechazada"}
    rows = "".join(
        f"""<tr>
          <td style="padding:12px;border-bottom:1px solid #e8e8e3"><b>{escape(item['id'])}</b></td>
          <td style="padding:12px;border-bottom:1px solid #e8e8e3">{escape((item.get('profiles') or {}).get('full_name', 'Usuario'))}</td>
          <td style="padding:12px;border-bottom:1px solid #e8e8e3">{escape(item['reason'])}</td>
          <td style="padding:12px;border-bottom:1px solid #e8e8e3">{status_labels.get(item['status'], item['status'])}</td>
        </tr>"""
        for item in data["justifications"]
    ) or '<tr><td colspan="4" style="padding:24px;text-align:center;color:#777">No se registraron justificaciones hoy.</td></tr>'
    formatted_date = data["date"].strftime("%d/%m/%Y")
    stats_html = ""
    if sections.get("summary", True):
        pending_html = (
            f'<div style="flex:1;border:1px solid #e1e2dc;border-radius:9px;padding:16px"><b style="font-size:24px">{data["pending_total"]}</b><br><span style="font-size:10px;color:#777">PENDIENTES</span></div>'
            if sections.get("pending", True) else ""
        )
        attendance_html = (
            f'<div style="flex:1;border:1px solid #e1e2dc;border-radius:9px;padding:16px"><b style="font-size:24px">{data["total_absences"]}</b><br><span style="font-size:10px;color:#777">FALTAS</span></div>'
            f'<div style="flex:1;border:1px solid #e1e2dc;border-radius:9px;padding:16px"><b style="font-size:24px">{data["attendance_rate"]}%</b><br><span style="font-size:10px;color:#777">ASISTENCIA</span></div>'
            if sections.get("attendance", True) else ""
        )
        stats_html = f"""<div style="display:flex;gap:10px;margin-bottom:25px">
          <div style="flex:1;border:1px solid #e1e2dc;border-radius:9px;padding:16px"><b style="font-size:24px">{len(data['justifications'])}</b><br><span style="font-size:10px;color:#777">JUSTIFICACIONES</span></div>
          {pending_html}{attendance_html}
        </div>"""
    table_html = (
        f'<h2 style="font-size:16px">Justificaciones del día</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;background:#f6f6f2"><th style="padding:10px">Código</th><th style="padding:10px">Usuario</th><th style="padding:10px">Motivo</th><th style="padding:10px">Estado</th></tr></thead><tbody>{rows}</tbody></table>'
        if sections.get("justifications", True) else ""
    )
    return f"""<!doctype html><html><body style="margin:0;background:#f0f0eb;font-family:Arial,sans-serif;color:#171816">
      <div style="max-width:700px;margin:30px auto;background:white;border-radius:14px;overflow:hidden">
        <div style="background:#101110;color:white;padding:28px 32px">
          <div style="font-size:22px;font-weight:700">✓ justifica <span style="color:#b8f13c;font-size:10px">ADMIN</span></div>
          <p style="color:#8b8d87;font-size:12px;margin:18px 0 0">REPORTE DIARIO · {formatted_date}</p>
          <h1 style="font-size:28px;margin:8px 0 0">Resumen de asistencia</h1>
        </div>
        <div style="padding:28px 32px">
          {stats_html}
          {table_html}
          <a href="{settings.frontend_url}" style="display:inline-block;margin-top:24px;background:#b8f13c;color:#12130f;text-decoration:none;font-weight:700;font-size:12px;padding:12px 18px;border-radius:8px">Abrir panel administrativo</a>
        </div>
        <div style="padding:16px 32px;background:#f7f7f3;color:#999;font-size:10px">Mensaje automático de Justifica Admin. No respondas a este correo.</div>
      </div></body></html>"""


def send_daily_report(client: Client, report_date: date | None = None, is_test: bool = False) -> dict[str, Any]:
    report_date = report_date or date.today()
    rows = client.table("notification_settings").select("*").eq("id", 1).limit(1).execute().data or []
    config = rows[0] if rows else None
    if not config or not config["enabled"] or not config["recipients"]:
        return {"sent": False, "reason": "notifications_disabled_or_no_recipients"}

    data = get_daily_data(client, report_date)
    test_mode = (
        settings.email_provider != "gmail"
        and "onboarding@resend.dev" in settings.report_from_email
    )
    recipients = (
        [
            email for email in config["recipients"]
            if email.lower() == settings.resend_test_recipient.lower()
        ]
        if test_mode else config["recipients"]
    )
    if not recipients:
        raise RuntimeError(
            "El remitente de prueba solo puede enviar al correo propietario de la cuenta Resend"
        )
    try:
        subject = f"{'[PRUEBA] ' if is_test else ''}Reporte diario de justificaciones · {report_date.strftime('%d/%m/%Y')}"
        html_body = render_email(data, config.get("report_sections") or {})
        if settings.email_provider == "gmail":
            message = EmailMessage()
            message["From"] = settings.report_from_email
            message["To"] = settings.gmail_user
            message["Bcc"] = ", ".join(recipients)
            message["Subject"] = subject
            message["Message-ID"] = make_msgid(domain="gmail.com")
            message.set_content("Reporte diario de Justifica Admin. Abre este mensaje en un cliente compatible con HTML.")
            message.add_alternative(html_body, subtype="html")
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as smtp:
                smtp.login(settings.gmail_user, settings.gmail_app_password)
                smtp.send_message(message)
            email_id = message["Message-ID"]
        else:
            resend.api_key = settings.resend_api_key
            result = resend.Emails.send({
                "from": settings.report_from_email,
                "to": recipients,
                "subject": subject,
                "html": html_body,
            })
            email_id = result.get("id")
        if not is_test:
            client.table("report_deliveries").insert({
                "report_date": report_date.isoformat(),
                "recipients": recipients,
                "status": "sent",
            }).execute()
        return {
            "sent": True,
            "email_id": email_id,
            "recipients": len(recipients),
            "configured_recipients": len(config["recipients"]),
            "test_mode": test_mode,
        }
    except Exception as exc:
        if not is_test:
            client.table("report_deliveries").insert({
                "report_date": report_date.isoformat(),
                "recipients": recipients,
                "status": "failed",
                "error_message": str(exc)[:500],
            }).execute()
        raise
