"""Cliente Supabase: upsert idempotente y búsqueda semántica."""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from alsari.config import get_settings
from alsari.db.schema import KnowledgeChunk

TABLE = "alsari_knowledge"


@lru_cache(maxsize=1)
def get_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def upsert_chunks(chunks: list[KnowledgeChunk]) -> int:
    """Upsert por (source_id, chunk_index). Devuelve número de filas escritas."""
    if not chunks:
        return 0
    client = get_client()
    rows = [c.to_row() for c in chunks]
    client.table(TABLE).upsert(rows, on_conflict="source_id,chunk_index").execute()
    return len(rows)


def delete_by_source(source_id: str) -> int:
    """Borra todos los chunks de un documento. Útil para re-ingestar limpio."""
    client = get_client()
    resp = client.table(TABLE).delete().eq("source_id", source_id).execute()
    return len(resp.data or [])


def search(
    query_embedding: list[float],
    match_count: int = 10,
    filters: dict | None = None,
) -> list[dict]:
    """Búsqueda semántica. Usa la función `search_alsari` definida en Supabase.

    filters admite: sociedades, proyectos, area, source_type, fecha_desde, fecha_hasta.
    """
    client = get_client()
    params: dict = {
        "query_embedding": query_embedding,
        "match_count": match_count,
    }
    if filters:
        params.update(filters)
    resp = client.rpc("search_alsari", params).execute()
    return resp.data or []
