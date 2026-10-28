"""Application configuration, loaded from the environment with safe defaults."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"
DEMO_CSV_PATH = DATA_DIR / "lifelens_demo.csv"


class Settings(BaseSettings):
    """Runtime settings. Every value has a working local-first default."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="LIFELENS_",
        extra="ignore",
    )

    app_name: str = "LifeLens AI"
    app_version: str = "1.0.0"
    app_tagline: str = "Mining the Hidden Patterns Behind Your Daily Life"

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'lifelens.db').as_posix()}"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_upload_mb: int = 10
    upload_dir: str = "storage/uploads"

    @field_validator("max_upload_mb")
    @classmethod
    def _positive_upload_limit(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("max_upload_mb must be positive")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()
