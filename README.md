# Justifica Admin

Panel administrativo para gestionar asistencia, faltas y justificaciones. Incluye autenticación exclusiva para administradores, gráficos, historial por usuario, revisión de solicitudes, auditoría y reportes diarios automáticos por correo.

## Tecnologías

- React + TypeScript + Vite
- Supabase Auth, PostgreSQL, Storage y RLS
- FastAPI + APScheduler
- Resend para correo transaccional
- Recharts para visualizaciones

## Inicio rápido

1. Instala el frontend:

   ```bash
   npm install
   npm run dev
   ```

2. En Supabase, abre **SQL Editor** y ejecuta `supabase/schema.sql`.

3. En **Authentication > Users**, crea el usuario administrador. Después ejecuta:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@empresa.pe';
   ```

4. Copia `.env.example` como `.env` y añade la URL y clave pública de Supabase. Este repositorio ya puede conservar un `.env` local, pero nunca debe subirse a Git.

## Servicio Python y reportes por correo

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8001
```

Configura en `backend/.env` la clave `service_role` de Supabase y una API key de Resend. La clave de servicio solo pertenece al backend; nunca debe exponerse en variables `VITE_*`.

El servicio consulta cada minuto la hora elegida en **Notificaciones**, evita envíos duplicados y guarda el resultado en `report_deliveries`. El endpoint manual `POST /api/reports/daily/send` requiere el token de un administrador.

## Seguridad

- RLS está activado en todas las tablas.
- Solo un perfil activo con `role = 'admin'` puede entrar al panel.
- Los usuarios normales solo pueden leer sus propios datos y crear sus propias justificaciones.
- Los cambios de estado quedan registrados en `audit_logs`.
- Las contraseñas se administran exclusivamente con Supabase Auth y nunca se guardan como texto plano.
- El alta, edición, activación y restablecimiento de contraseña se realiza desde **Usuarios**.
- El botón de datos demo solo aparece durante desarrollo (`npm run dev`), nunca en el build de producción.

## Estructura

```text
src/                 Interfaz React
backend/app/         API y automatización Python
supabase/schema.sql  Modelo de datos, RLS y triggers
```
# Proyecto-admin-jistificaciones
