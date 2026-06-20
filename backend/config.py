"""
CoastGuard — Application settings.

All values are read from environment variables (or backend/.env).
Copy backend/.env.example → backend/.env and fill in real values.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """CoastGuard application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database (Phase 1 default: SQLite) ────────────────────────────────────
    # Used when AURORA_USE_IAM_AUTH=false (or not set).
    # Switch to Aurora by setting AURORA_USE_IAM_AUTH=true and the AURORA_* vars below.
    database_url: str = "sqlite:///./coastguard.db"

    # ── Aurora PostgreSQL + IAM Auth (Phase 3) ────────────────────────────────
    # Set AURORA_USE_IAM_AUTH=true to enable.
    # boto3 generates a fresh token automatically on every new connection
    # (tokens expire in 15 min; pool_recycle handles this transparently).
    aurora_use_iam_auth: bool = False
    aurora_host: str = ""                                          # cluster endpoint
    aurora_port: int = 5432
    aurora_user: str = "postgres"
    aurora_db: str = "postgres"                                    # database name
    aurora_region: str = "us-east-1"
    # AWS credentials — boto3 also reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    # / AWS_SESSION_TOKEN from the environment automatically.
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None

    # ── AI / LLM ──────────────────────────────────────────────────────────────
    llm_provider: str = "gemini"
    gemini_api_key: Optional[str] = None
    # gemini-flash-latest is a Google-maintained alias that always points at
    # the current flash-tier model — avoids breakage when Google retires
    # specific dated model names (e.g. gemini-1.5-flash, gemini-2.0-flash).
    gemini_model: str = "gemini/gemini-flash-latest"

    # ── Mock mode ─────────────────────────────────────────────────────────────
    use_mock_llm: bool = True
    use_mock_data: bool = True

    # When true, the TariffMonitor agent is given a real GDELT news-search
    # tool (services/gdelt.py — free, no API key needed). This is independent
    # of USE_MOCK_LLM: you can run real tools with a mocked LLM (free/instant)
    # or mocked tools with a real LLM. Default false so a fresh checkout makes
    # zero outbound network calls.
    use_real_tools: bool = False

    # When true, a background job (APScheduler) periodically re-runs the
    # monitor pipeline for all customers. Default false — for a hackathon
    # demo you want deterministic, judge-triggered runs via the "Run Monitor"
    # button, not a background job firing at an unpredictable moment.
    enable_scheduler: bool = False
    scheduler_interval_hours: int = 6

    # ── External data sources (Phase 2+) ──────────────────────────────────────
    usitc_api_key: Optional[str] = None
    sentinelhub_api_key: Optional[str] = None
    google_maps_api_key: Optional[str] = None

    # ── Vector DB / RAG (Phase 3) ─────────────────────────────────────────────
    chroma_persist_dir: str = "./data/vectordb"
    trade_regulations_dir: str = "./data/trade_regulations"

    # ── File uploads ──────────────────────────────────────────────────────────
    upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 50

    # ── Active session (temporary until Clerk auth is wired) ─────────────────
    # Change this to switch which company is "logged in". Replace with Clerk
    # user lookup once auth is implemented.
    active_customer_id: int = 1

    # ── Auth (Auth0) ──────────────────────────────────────────────────────────
    auth0_domain: str = "dev-u567o418jqffuhhh.us.auth0.com"
    auth0_api_audience: str = "https://dev-u567o418jqffuhhh.us.auth0.com/api/v2/"
    auth0_algorithms: list[str] = ["RS256"]
    admin_whitelist: Optional[str] = None

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"
    debug: bool = True


@lru_cache()
def get_settings() -> Settings:
    """Return the singleton settings instance (cached after first call)."""
    return Settings()
