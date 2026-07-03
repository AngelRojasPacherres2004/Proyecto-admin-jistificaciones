from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    resend_api_key: str = ""
    report_from_email: str = "Justifica <onboarding@resend.dev>"
    resend_test_recipient: str = ""
    frontend_url: str = "http://localhost:5173"
    scheduler_enabled: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
