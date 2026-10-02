"""Environment-driven settings, loaded from process env or ``.env``."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Finance in Practice - Quant API"
    environment: str = "development"
    # Comma-separated list, e.g. "http://localhost:3000,https://financeinpractice.me"
    cors_origins: str = "http://localhost:3000"
    rate_limit: str = "60/minute"
    # "memory://" for one process; "redis://host:6379" when running several workers
    rate_limit_storage_uri: str = "memory://"
    rate_limit_enabled: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
