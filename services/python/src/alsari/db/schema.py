"""Modelos Pydantic que reflejan la tabla `alsari_knowledge` de Supabase."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

SourceType = Literal[
    "drive_pdf",
    "drive_docx",
    "drive_gdoc",
    "drive_xlsx",
    "drive_gsheet",
    "gmail",
    "manual",
]


class DocumentMetadata(BaseModel):
    """Metadatos extraídos por el clasificador Claude para un documento completo."""

    sociedades: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)
    personas: list[str] = Field(default_factory=list)
    contrapartes: list[str] = Field(default_factory=list)
    tipo_documento: str | None = None
    area: str | None = None
    fecha_documento: date | None = None


class KnowledgeChunk(BaseModel):
    """Una fila de `alsari_knowledge`: un trozo de texto con su embedding y metadatos."""

    id: UUID = Field(default_factory=uuid4)
    content: str
    embedding: list[float]

    source_type: SourceType
    source_id: str
    source_url: str
    source_title: str

    sociedades: list[str] = Field(default_factory=list)
    proyectos: list[str] = Field(default_factory=list)
    personas: list[str] = Field(default_factory=list)
    contrapartes: list[str] = Field(default_factory=list)
    tipo_documento: str | None = None
    area: str | None = None

    fecha_documento: date | None = None
    fecha_ingesta: datetime = Field(default_factory=datetime.utcnow)

    chunk_index: int
    chunk_total: int

    def to_row(self) -> dict:
        """Convierte a dict serializable para la API REST de Supabase."""
        return {
            "id": str(self.id),
            "content": self.content,
            "embedding": self.embedding,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_url": self.source_url,
            "source_title": self.source_title,
            "sociedades": self.sociedades,
            "proyectos": self.proyectos,
            "personas": self.personas,
            "contrapartes": self.contrapartes,
            "tipo_documento": self.tipo_documento,
            "area": self.area,
            "fecha_documento": self.fecha_documento.isoformat() if self.fecha_documento else None,
            "fecha_ingesta": self.fecha_ingesta.isoformat(),
            "chunk_index": self.chunk_index,
            "chunk_total": self.chunk_total,
        }
