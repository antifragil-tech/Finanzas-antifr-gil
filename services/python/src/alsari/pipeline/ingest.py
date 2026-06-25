"""Orquestador de ingesta: de URL de Drive o hilo Gmail a filas en `alsari_knowledge`."""

from __future__ import annotations

from dataclasses import dataclass

from alsari.db.schema import KnowledgeChunk
from alsari.db.supabase import upsert_chunks
from alsari.extract.drive import download_and_extract
from alsari.extract.gmail import GmailThread, fetch_thread
from alsari.pipeline.chunker import chunk_tabular, chunk_text
from alsari.pipeline.classifier import classify
from alsari.pipeline.embedder import embed_documents

TABULAR_SOURCES = {"drive_xlsx", "drive_gsheet"}


@dataclass
class IngestResult:
    file_id: str
    title: str
    chunks_written: int
    tipo_documento: str | None
    sociedades: list[str]
    proyectos: list[str]


def ingest_drive_file(url_or_id: str) -> IngestResult:
    """Flujo completo: descarga → extrae → clasifica → trocea → embebe → upsert."""
    drive_file = download_and_extract(url_or_id)

    if not drive_file.text.strip():
        raise ValueError(f"Texto vacío tras extraer: {drive_file.title}")

    metadata = classify(drive_file.title, drive_file.text)
    chunker = chunk_tabular if drive_file.source_type in TABULAR_SOURCES else chunk_text
    chunks = chunker(drive_file.text)
    embeddings = embed_documents(chunks)

    total = len(chunks)
    rows = [
        KnowledgeChunk(
            content=content,
            embedding=emb,
            source_type=drive_file.source_type,  # type: ignore[arg-type]
            source_id=drive_file.file_id,
            source_url=drive_file.source_url,
            source_title=drive_file.title,
            sociedades=metadata.sociedades,
            proyectos=metadata.proyectos,
            personas=metadata.personas,
            contrapartes=metadata.contrapartes,
            tipo_documento=metadata.tipo_documento,
            area=metadata.area,
            fecha_documento=metadata.fecha_documento,
            chunk_index=i,
            chunk_total=total,
        )
        for i, (content, emb) in enumerate(zip(chunks, embeddings, strict=True))
    ]

    written = upsert_chunks(rows)
    return IngestResult(
        file_id=drive_file.file_id,
        title=drive_file.title,
        chunks_written=written,
        tipo_documento=metadata.tipo_documento,
        sociedades=metadata.sociedades,
        proyectos=metadata.proyectos,
    )


def ingest_gmail_thread(thread_id: str) -> IngestResult:
    """Flujo completo para un hilo de Gmail: descarga → clasifica → trocea → embebe → upsert."""
    thread = fetch_thread(thread_id)

    if not thread.text.strip():
        raise ValueError(f"Hilo vacío (sin texto): {thread.subject}")

    title = f"[Gmail] {thread.subject}"
    metadata = classify(title, thread.text)
    chunks = chunk_text(thread.text)
    embeddings = embed_documents(chunks)

    total = len(chunks)
    fecha = thread.date_first.date() if thread.date_first else metadata.fecha_documento
    rows = [
        KnowledgeChunk(
            content=content,
            embedding=emb,
            source_type="gmail",
            source_id=thread.thread_id,
            source_url=thread.source_url,
            source_title=title,
            sociedades=metadata.sociedades,
            proyectos=metadata.proyectos,
            personas=metadata.personas,
            contrapartes=metadata.contrapartes,
            tipo_documento=metadata.tipo_documento,
            area=metadata.area,
            fecha_documento=fecha,
            chunk_index=i,
            chunk_total=total,
        )
        for i, (content, emb) in enumerate(zip(chunks, embeddings, strict=True))
    ]

    written = upsert_chunks(rows)
    return IngestResult(
        file_id=thread.thread_id,
        title=title,
        chunks_written=written,
        tipo_documento=metadata.tipo_documento,
        sociedades=metadata.sociedades,
        proyectos=metadata.proyectos,
    )
