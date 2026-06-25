"""Troceo de texto en chunks de ~500 tokens con solapamiento de 50.

Usa tiktoken (encoding cl100k_base) como aproximador universal de tokens.
Voyage y Anthropic no usan exactamente este encoder pero el conteo es
lo bastante cercano para decidir cortes de chunk.

Hay dos estrategias:
- chunk_text: texto narrativo (PDFs, Word, Docs, correos). Ventana + overlap.
- chunk_tabular: Excel/Sheets convertidos a Markdown. Nunca parte filas y
  repite cabecera + título de hoja en cada chunk para mantener contexto.
"""

from __future__ import annotations

import re

import tiktoken

from alsari.config import get_settings

_ENC = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str, *, size: int | None = None, overlap: int | None = None) -> list[str]:
    """Trocea `text` en ventanas de `size` tokens con solapamiento `overlap`.

    Los chunks se reconstituyen a string via el mismo encoder. Devuelve lista
    vacía si el texto es solo espacios.
    """
    if size is None or overlap is None:
        s = get_settings()
        size = size if size is not None else s.chunk_size_tokens
        overlap = overlap if overlap is not None else s.chunk_overlap_tokens

    if not text.strip():
        return []
    if overlap >= size:
        raise ValueError("overlap debe ser menor que size")

    tokens = _ENC.encode(text)
    if len(tokens) <= size:
        return [text.strip()]

    step = size - overlap
    chunks: list[str] = []
    for start in range(0, len(tokens), step):
        window = tokens[start : start + size]
        if not window:
            break
        chunks.append(_ENC.decode(window).strip())
        if start + size >= len(tokens):
            break
    return [c for c in chunks if c]


def count_tokens(text: str) -> int:
    return len(_ENC.encode(text))


def chunk_tabular(markdown_text: str, *, size: int | None = None) -> list[str]:
    """Trocea tablas Markdown sin partir filas. Repite cabecera en cada chunk."""
    if size is None:
        size = get_settings().chunk_size_tokens

    if not markdown_text.strip():
        return []

    chunks: list[str] = []
    for sheet in _split_sheets(markdown_text):
        chunks.extend(_chunk_sheet(sheet, size))
    return chunks


def _split_sheets(text: str) -> list[str]:
    parts = re.split(r"(?=^## Hoja:)", text, flags=re.MULTILINE)
    return [p.strip() for p in parts if p.strip()]


def _chunk_sheet(sheet: str, size: int) -> list[str]:
    """Separa título + cabecera Markdown del cuerpo; empaqueta filas hasta `size`."""
    lines = sheet.split("\n")
    title_lines: list[str] = []
    header_lines: list[str] = []
    body_lines: list[str] = []

    i = 0
    while i < len(lines) and not lines[i].strip().startswith("|"):
        if lines[i].strip():
            title_lines.append(lines[i])
        i += 1
    while i < len(lines) and lines[i].strip().startswith("|") and len(header_lines) < 2:
        header_lines.append(lines[i])
        i += 1
    while i < len(lines):
        if lines[i].strip():
            body_lines.append(lines[i])
        i += 1

    preamble_parts = title_lines + header_lines
    preamble = "\n".join(preamble_parts).strip()

    if not body_lines:
        return [preamble] if preamble else []

    preamble_tokens = count_tokens(preamble) if preamble else 0
    chunks: list[str] = []
    current_rows: list[str] = []
    current_tokens = preamble_tokens

    for row in body_lines:
        row_tokens = count_tokens(row)
        if current_tokens + row_tokens > size and current_rows:
            chunks.append(_compose(preamble, current_rows))
            current_rows = [row]
            current_tokens = preamble_tokens + row_tokens
        else:
            current_rows.append(row)
            current_tokens += row_tokens

    if current_rows:
        chunks.append(_compose(preamble, current_rows))

    return chunks


def _compose(preamble: str, rows: list[str]) -> str:
    return (preamble + "\n" + "\n".join(rows)).strip() if preamble else "\n".join(rows)
