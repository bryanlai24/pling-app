from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/pling"

    # JWT
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # App
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Platform sync (all optional)
    psn_npsso_token: str = "6ZGdf2dyGO47QAPTufjtmROwF5ru0vY25j6zmOjI5JCv0bU1KUIGkTeabuwuZIAR"
    steam_api_key: str = ""
    xbox_client_id: str = ""
    xbox_client_secret: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()