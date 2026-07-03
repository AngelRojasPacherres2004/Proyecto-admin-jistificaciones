"""Comando de ejecución única para servicios cron en producción."""

from supabase import create_client

from .config import settings
from .reporting import send_daily_report


def main() -> None:
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    result = send_daily_report(client)
    print(f"sent={result.get('sent', False)} recipients={result.get('recipients', 0)}")


if __name__ == "__main__":
    main()
