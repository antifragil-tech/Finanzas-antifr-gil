"""Clasificador de metadatos: Claude Sonnet 4.6 extrae taxonomía de un documento.

Toma los primeros ~8000 tokens del texto (suficiente para cabecera + resumen
en escrituras, contratos, etc.) y devuelve metadatos normalizados contra la
taxonomía canónica de Alsari.
"""

from __future__ import annotations

import json
import time
from datetime import date, datetime
from functools import lru_cache

from anthropic import Anthropic, APIStatusError

from alsari.config import (
    AREAS,
    CONTRAPARTES,
    PERSONAS,
    PROYECTOS,
    SOCIEDADES,
    TIPOS_DOCUMENTO,
    get_settings,
)
from alsari.db.schema import DocumentMetadata
from alsari.pipeline.chunker import _ENC

MAX_INPUT_TOKENS = 8000


@lru_cache(maxsize=1)
def _client() -> Anthropic:
    return Anthropic(api_key=get_settings().anthropic_api_key)


def _truncate(text: str, max_tokens: int = MAX_INPUT_TOKENS) -> str:
    tokens = _ENC.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return _ENC.decode(tokens[:max_tokens])


def _system_prompt() -> str:
    return (
        "Eres un clasificador documental de Alsari Capital. Extraes metadatos "
        "estructurados de documentos de negocio (escrituras, contratos, actas, "
        "balances, correos).\n\n"
        "Reglas:\n"
        "- Usa EXACTAMENTE los valores de las listas canónicas; no inventes.\n"
        "- Si un valor no está en la lista pero aparece claramente, incorpóralo igual.\n"
        "- Devuelve SOLO JSON válido, sin markdown ni comentarios.\n\n"
        f"Sociedades canónicas: {SOCIEDADES}\n"
        f"Proyectos canónicos: {PROYECTOS}\n"
        f"Personas canónicas: {PERSONAS}\n"
        f"Contrapartes canónicas: {CONTRAPARTES}\n"
        f"Tipos de documento: {TIPOS_DOCUMENTO}\n"
        f"Áreas: {AREAS}\n"
    )


def _user_prompt(title: str, text: str) -> str:
    return (
        f"Título del archivo: {title}\n\n"
        f"Contenido (posiblemente truncado):\n---\n{text}\n---\n\n"
        "Devuelve JSON con este esquema exacto:\n"
        "{\n"
        '  "sociedades": [string],\n'
        '  "proyectos": [string],\n'
        '  "personas": [string],\n'
        '  "contrapartes": [string],\n'
        '  "tipo_documento": string|null,\n'
        '  "area": string|null,\n'
        '  "fecha_documento": "YYYY-MM-DD"|null\n'
        "}"
    )


def classify(title: str, text: str) -> DocumentMetadata:
    """Llama a Claude y normaliza la respuesta a DocumentMetadata."""
    s = get_settings()
    truncated = _truncate(text)

    for attempt in range(3):
        try:
            msg = _client().messages.create(
                model=s.anthropic_model,
                max_tokens=1024,
                system=_system_prompt(),
                messages=[{"role": "user", "content": _user_prompt(title, truncated)}],
            )
            break
        except APIStatusError as e:
            if e.status_code in (503, 529) and attempt < 2:
                time.sleep(30 * (attempt + 1))
                continue
            raise

    raw = "".join(block.text for block in msg.content if block.type == "text").strip()
    payload = _parse_json(raw)

    fecha = payload.get("fecha_documento")
    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = datetime.strptime(fecha, "%Y-%m-%d").date()
        except ValueError:
            fecha_date = None

    return DocumentMetadata(
        sociedades=payload.get("sociedades") or [],
        proyectos=payload.get("proyectos") or [],
        personas=payload.get("personas") or [],
        contrapartes=payload.get("contrapartes") or [],
        tipo_documento=payload.get("tipo_documento"),
        area=payload.get("area"),
        fecha_documento=fecha_date,
    )


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Respuesta de Claude sin JSON válido: {raw[:200]}")
    return json.loads(raw[start : end + 1])
