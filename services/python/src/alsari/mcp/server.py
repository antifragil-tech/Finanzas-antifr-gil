"""MCP server para Claude Desktop — búsqueda semántica sobre la BD de Alsari.

Expone dos herramientas:
  buscar_documentos  — búsqueda semántica con filtros opcionales
  listar_fuentes     — lista los documentos únicos ingestados
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from alsari.db.supabase import get_client
from alsari.pipeline.embedder import embed_query

mcp = FastMCP("Alsari Knowledge")


@mcp.tool()
def buscar_documentos(
    consulta: str,
    n_resultados: int = 8,
    sociedad: str = "",
    area: str = "",
    tipo_documento: str = "",
) -> str:
    """Busca en la base de conocimiento de Alsari Capital usando búsqueda semántica.

    Args:
        consulta: Pregunta o texto a buscar (en español).
        n_resultados: Número de fragmentos a devolver (máx 20).
        sociedad: Filtrar por sociedad (ej: "Rialsa Obras S.L."). Opcional.
        area: Filtrar por área (legal, financiero, fiscal, comercial, operativo, inmobiliario). Opcional.
        tipo_documento: Filtrar por tipo (escritura, contrato_arrendamiento, balance...). Opcional.
    """
    embedding = embed_query(consulta)

    filters: dict = {}
    if sociedad:
        filters["filter_sociedades"] = sociedad
    if area:
        filters["filter_area"] = area
    if tipo_documento:
        filters["filter_tipo"] = tipo_documento

    results = get_client().rpc(
        "search_alsari",
        {"query_embedding": embedding, "match_count": min(n_resultados, 20), **filters},
    ).execute().data or []

    if not results:
        return "No se encontraron documentos relevantes para esa consulta."

    lines: list[str] = [f"Se encontraron {len(results)} fragmentos relevantes:\n"]
    for i, r in enumerate(results, 1):
        similarity = r.get("similarity", 0)
        lines.append(
            f"--- Resultado {i} (similitud: {similarity:.2f}) ---\n"
            f"Documento: {r.get('source_title', '—')}\n"
            f"Tipo: {r.get('tipo_documento', '—')}  |  Área: {r.get('area', '—')}\n"
            f"Sociedades: {', '.join(r.get('sociedades') or []) or '—'}\n"
            f"Fecha: {r.get('fecha_documento', '—')}\n"
            f"Enlace: {r.get('source_url', '—')}\n"
            f"Fragmento:\n{r.get('content', '')}\n"
        )
    return "\n".join(lines)


@mcp.tool()
def listar_fuentes(sociedad: str = "", tipo_documento: str = "") -> str:
    """Lista los documentos únicos ingestados en la base de conocimiento.

    Args:
        sociedad: Filtrar por sociedad. Opcional.
        tipo_documento: Filtrar por tipo de documento. Opcional.
    """
    client = get_client()
    query = (
        client.table("alsari_knowledge")
        .select("source_id,source_title,source_url,tipo_documento,area,sociedades,fecha_documento")
        .order("source_title")
    )
    if tipo_documento:
        query = query.eq("tipo_documento", tipo_documento)

    rows: list[dict] = []
    seen: set[str] = set()
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        for r in batch.data:
            sid = r.get("source_id")
            if sid and sid not in seen:
                seen.add(sid)
                if not sociedad or sociedad in (r.get("sociedades") or []):
                    rows.append(r)
        if len(batch.data) < 1000:
            break
        offset += 1000

    if not rows:
        return "No se encontraron documentos con esos filtros."

    lines = [f"Total: {len(rows)} documentos\n"]
    for r in rows:
        lines.append(
            f"• {r.get('source_title', '—')}"
            f"  [{r.get('tipo_documento', '—')}]"
            f"  {r.get('fecha_documento', '') or ''}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
