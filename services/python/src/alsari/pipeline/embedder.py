"""Generación de embeddings con Voyage AI (voyage-3.5, 1024 dimensiones)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

import voyageai

from alsari.config import get_settings

InputType = Literal["document", "query"]
BATCH = 32


@lru_cache(maxsize=1)
def _client() -> voyageai.Client:
    return voyageai.Client(api_key=get_settings().voyage_api_key)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed(texts, "document")


def embed_query(text: str) -> list[float]:
    return _embed([text], "query")[0]


def _embed(texts: list[str], input_type: InputType) -> list[list[float]]:
    if not texts:
        return []
    s = get_settings()
    client = _client()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        resp = client.embed(batch, model=s.voyage_model, input_type=input_type)
        out.extend(resp.embeddings)
    return out
