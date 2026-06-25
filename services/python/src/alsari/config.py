"""Configuración global: credenciales (.env) y taxonomía canónica de Alsari."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Credenciales y parámetros cargados desde .env."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    supabase_url: str
    supabase_service_key: str
    supabase_db_password: str = ""

    voyage_api_key: str
    voyage_model: str = "voyage-3.5"

    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-6"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    dashboard_password: str = "alsari2026"
    ocr_render_dpi: int = 200

    google_credentials_path: Path = PROJECT_ROOT / "secrets" / "google_credentials.json"
    google_token_path: Path = PROJECT_ROOT / "secrets" / "google_token.json"

    chunk_size_tokens: int = 500
    chunk_overlap_tokens: int = 50
    embedding_dim: int = 1024


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


SOCIEDADES: list[str] = [
    "Alsari Inversiones S.L.",
    "Pavier Legacy Group S.L.",
    "Armia Group S.L.",
    "Rialsa Obras S.L.",
    "Le Toit Grand 10 S.L.U.",
    "Perisur Gestión de Inmuebles S.L.",
    "Capellanía Desarrollo Residencial S.L.",
]

PROYECTOS: list[str] = [
    "Las Mesas Estepona",
    "Alborán Living",
    "Laguna Park",
    "Campanillas",
    "Álora",
    "CENS",
]

PERSONAS: list[str] = [
    "Guillermo Vila Marcos",
    "Javier Alarcón Rivera",
    "Iván Alarcón Rivera",
    "Francisco Javier Alarcón García",
    "Antonia Rivera Sánchez",
    "Alicia Rodríguez Gálvez",
]

CONTRAPARTES: list[str] = [
    "Evariste S.A.S.",
    "Urbanitae",
    "Nyland Reim S.L.",
    "Grupo Procourval",
    "CaixaBank",
    "Banco Santander",
    "FMC Legal",
    "Asesoría MM",
]

TIPOS_DOCUMENTO: list[str] = [
    "escritura",
    "pacto_socios",
    "contrato_prestamo",
    "contrato_arrendamiento",
    "contrato_construccion",
    "balance",
    "pyg",
    "correo",
    "acta",
]

AREAS: list[str] = [
    "legal",
    "financiero",
    "fiscal",
    "comercial",
    "operativo",
    "inmobiliario",
]

SOURCE_TYPES: list[str] = [
    "drive_pdf",
    "drive_docx",
    "drive_gdoc",
    "drive_xlsx",
    "drive_gsheet",
    "gmail",
    "manual",
]
