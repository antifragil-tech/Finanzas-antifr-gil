"""Genera borradores de respuesta de email con KB vectorial + few-shot + estilo Guille."""

from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass, field
from email import encoders as _encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from alsari.db.supabase import get_client
from alsari.extract.drive import download_file_for_attachment
from alsari.pipeline.embedder import embed_query

_SKILL_DIR = Path(__file__).parent / "write_like_guille"
_EXAMPLES_PATH = _SKILL_DIR / "examples.json"
_STYLE_GUIDE_PATH = _SKILL_DIR / "style_guide.md"

MAX_DRAFTS_PER_RUN = 10
KB_MATCH_COUNT = 20
MAX_CANDIDATE_ATTACHMENTS = 8
MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

MY_EMAIL = "guillermovila@alsari.net"


@dataclass
class UnrepliedEmail:
    thread_id: str
    message_id: str
    sender: str
    subject: str
    body: str


@dataclass
class DraftResult:
    text: str
    attachment_ids: list[str] = field(default_factory=list)


def find_unreplied_threads(max_results: int = MAX_DRAFTS_PER_RUN) -> list[UnrepliedEmail]:
    """Busca hilos en INBOX donde el último mensaje no lo envió Guille."""
    from googleapiclient.discovery import build
    from alsari.extract.drive import get_drive_service as _auth

    drive_svc = _auth()
    creds = drive_svc._http.credentials  # type: ignore[attr-defined]
    gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)

    resp = gmail.users().threads().list(
        userId="me",
        q=f"in:inbox -from:{MY_EMAIL} -label:draft",
        maxResults=max_results * 3,
    ).execute()

    results: list[UnrepliedEmail] = []
    for t in resp.get("threads", []):
        if len(results) >= max_results:
            break
        thread_data = gmail.users().threads().get(
            userId="me", id=t["id"], format="full"
        ).execute()
        messages = thread_data.get("messages", [])
        if not messages:
            continue

        last_msg = messages[-1]
        headers = {
            h["name"].lower(): h["value"]
            for h in last_msg.get("payload", {}).get("headers", [])
        }
        sender = headers.get("from", "")
        if MY_EMAIL.lower() in sender.lower():
            continue  # ya respondimos

        subject = headers.get("subject", "(sin asunto)")
        msg_id = last_msg["id"]
        body = _extract_body(last_msg.get("payload", {}))

        results.append(UnrepliedEmail(
            thread_id=t["id"],
            message_id=msg_id,
            sender=sender,
            subject=subject,
            body=body,
        ))

    return results


def _extract_body(payload: dict) -> str:
    mime = payload.get("mimeType", "")
    if mime == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
        return ""
    if mime.startswith("multipart/"):
        parts = payload.get("parts", [])
        plain_parts = [p for p in parts if p.get("mimeType") == "text/plain"]
        if plain_parts:
            return _extract_body(plain_parts[0])
        for part in parts:
            text = _extract_body(part)
            if text.strip():
                return text
    return ""


def _search_kb_split(subject: str, body: str) -> tuple[str, list[dict]]:
    """Busca en KB vectorial. Devuelve (context_text, drive_candidates)."""
    query = f"{subject} {body[:500]}"
    emb = embed_query(query)
    results = (
        get_client()
        .rpc("search_alsari", {"query_embedding": emb, "match_count": KB_MATCH_COUNT})
        .execute()
        .data
        or []
    )

    context_parts: list[str] = []
    seen: set[str] = set()
    candidates: list[dict] = []

    for r in results:
        title = r.get("source_title", "—")
        tipo = r.get("tipo_documento", "—")
        fecha = r.get("fecha_documento", "—")
        content = r.get("content", "")
        sim = r.get("similarity", 0.0)
        context_parts.append(f"[{title} | {tipo} | {fecha} | sim={sim:.2f}]\n{content}")

        # Candidatos adjuntables: solo Drive; extraer file_id desde source_url
        st = r.get("source_type") or ""
        if not st.startswith("drive_"):
            continue
        url = r.get("source_url") or ""
        m = re.search(r"/d/([a-zA-Z0-9_-]+)", url) or re.search(
            r"[?&]id=([a-zA-Z0-9_-]+)", url
        )
        if not m:
            continue
        fid = m.group(1)
        if fid in seen:
            continue
        seen.add(fid)
        candidates.append({
            "source_id": fid,
            "source_title": title,
            "tipo_documento": tipo,
            "fecha_documento": fecha,
            "source_type": st,
            "source_url": url,
            "similarity": sim,
        })
        if len(candidates) >= MAX_CANDIDATE_ATTACHMENTS:
            break

    return "\n\n---\n\n".join(context_parts), candidates


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


_examples_cache: list[dict] | None = None
_examples_embeddings: list[list[float]] | None = None


def _load_examples() -> tuple[list[dict], list[list[float]]]:
    global _examples_cache, _examples_embeddings
    if _examples_cache is not None and _examples_embeddings is not None:
        return _examples_cache, _examples_embeddings
    from alsari.pipeline.embedder import embed_documents

    examples = json.loads(_EXAMPLES_PATH.read_text(encoding="utf-8"))
    texts = [
        f"{e.get('received_subject', '')} {e.get('received_body', '')[:300]}"
        for e in examples
    ]
    _examples_embeddings = embed_documents(texts)
    _examples_cache = examples
    return _examples_cache, _examples_embeddings


def _select_fewshot(subject: str, body: str, k: int = 3) -> list[dict]:
    """Devuelve los k ejemplos más similares al email recibido."""
    examples, embeddings = _load_examples()
    query_emb = embed_query(f"{subject} {body[:300]}")
    scored = sorted(
        enumerate(embeddings),
        key=lambda t: _cosine_similarity(query_emb, t[1]),
        reverse=True,
    )
    return [examples[i] for i, _ in scored[:k]]


def generate_draft(email: UnrepliedEmail) -> DraftResult:
    """Genera un borrador de respuesta en estilo Guille usando Gemini."""
    from google import genai as google_genai
    from alsari.config import get_settings

    s = get_settings()

    context, candidates = _search_kb_split(email.subject, email.body)
    fewshot = _select_fewshot(email.subject, email.body)
    style_guide = _STYLE_GUIDE_PATH.read_text(encoding="utf-8")

    fewshot_block = "\n\n".join(
        f"EMAIL RECIBIDO:\n{ex['received_body'][:600]}\n\nRESPUESTA DE GUILLERMO:\n{ex['response_body']}"
        for ex in fewshot
    )

    if candidates:
        candidates_block = "DOCUMENTOS DISPONIBLES PARA ADJUNTAR (source_id exacto entre corchetes):\n" + "\n".join(
            f"  source_id=[{c['source_id']}]  título={c['source_title']}  tipo={c['tipo_documento']}  fecha={c['fecha_documento']}  sim={c['similarity']:.2f}"
            for c in candidates
        )
        # Pick top candidate for the example in the instruction
        top = candidates[0]
        attach_instructions = (
            "REGLA DE ADJUNTOS:\n"
            "1. Si el email pide EXPLÍCITAMENTE un documento O la similitud del candidato es ≥ 0.60:\n"
            "   - Menciona 'te adjunto' o 'te comparto' en el cuerpo.\n"
            "   - OBLIGATORIO: añade una línea [ATTACH:source_id] por cada adjunto DESPUÉS del cierre 'Gracias!!'.\n"
            "   - Usa el source_id EXACTO (el texto entre corchetes [] de la lista).\n"
            "2. NUNCA inventes source_ids. Solo los de la lista.\n"
            "3. Si no hay candidatos con sim ≥ 0.60, NO adjuntes nada.\n\n"
            f"EJEMPLO DE FORMATO CORRECTO cuando adjuntas el primer candidato:\n"
            f"  Hola [Nombre],\n"
            f"  Te comparto el documento solicitado adjunto.\n"
            f"  Gracias!!\n"
            f"  [ATTACH:{top['source_id']}]"
        )
    else:
        candidates_block = "NO HAY DOCUMENTOS DISPONIBLES PARA ADJUNTAR."
        attach_instructions = (
            "PROHIBIDO incluir [ATTACH:...] en el borrador. "
            "PROHIBIDO escribir 'te adjunto' ni 'te comparto' ningún documento."
        )

    prompt = f"""Eres Guillermo Vila Marcos (CEO Alsari Capital). Redacta la respuesta al email recibido.

=== MANUAL DE ESTILO ===
{style_guide}

=== EJEMPLOS REALES DE CÓMO RESPONDE GUILLERMO ===
{fewshot_block}

=== CONTEXTO FACTUAL DE LA BASE DE CONOCIMIENTO ===
{context if context else "No se han encontrado documentos relevantes."}

REGLA ANTI-ALUCINACIÓN: Usa ÚNICAMENTE los datos del contexto anterior (cifras, fechas, modelos fiscales, NRCs, importes, sociedades implicadas). Si no tienes el dato, escribe "lo reviso" o "lo confirmo". No extrapoles ni reutilices datos de un campo para rellenar otro distinto.

=== ADJUNTOS ===
{candidates_block}
{attach_instructions}

=== EMAIL RECIBIDO ===
De: {email.sender}
Asunto: {email.subject}

{email.body[:2000]}

=== INSTRUCCIÓN ===
Redacta la respuesta directamente. Sin comentarios previos, sin "Borrador:", sin meta-texto."""

    client = google_genai.Client(api_key=s.gemini_api_key)
    response = client.models.generate_content(model=s.gemini_model, contents=prompt)
    raw_text = response.text.strip()

    # Parsear y limpiar [ATTACH:id] tags
    attach_pattern = re.compile(r"\[ATTACH:([a-zA-Z0-9_-]+)\]")
    found_ids = attach_pattern.findall(raw_text)
    clean_text = attach_pattern.sub("", raw_text).strip()

    # Solo IDs que existan en los candidatos reales (anti-hallucination)
    valid_ids = {c["source_id"] for c in candidates}
    attachment_ids = [fid for fid in found_ids if fid in valid_ids]

    return DraftResult(text=clean_text, attachment_ids=attachment_ids)


def save_draft(email: UnrepliedEmail, text: str, attachment_ids: list[str]) -> str:
    """Guarda el borrador en Gmail con adjuntos opcionales. Devuelve draft_id."""
    import email as _email_lib
    from googleapiclient.discovery import build
    from alsari.extract.drive import get_drive_service as _auth

    drive_svc = _auth()
    creds = drive_svc._http.credentials  # type: ignore[attr-defined]
    gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)

    # Extraer solo la dirección de email del campo sender (evita problemas con caracteres especiales)
    _, sender_addr = _email_lib.utils.parseaddr(email.sender)
    to_field = sender_addr if sender_addr else email.sender

    if attachment_ids:
        msg: MIMEMultipart = MIMEMultipart()
        msg.attach(MIMEText(text, "plain", "utf-8"))
        for fid in attachment_ids:
            try:
                data, mime_type, filename = download_file_for_attachment(fid)
                if len(data) > MAX_ATTACHMENT_SIZE_BYTES:
                    continue
                maintype, subtype = mime_type.split("/", 1)
                part = MIMEBase(maintype, subtype)
                part.set_payload(data)
                _encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment", filename=filename)
                msg.attach(part)
            except Exception:
                pass
    else:
        msg = MIMEText(text, "plain", "utf-8")  # type: ignore[assignment]

    msg["Subject"] = f"Re: {email.subject}"
    msg["From"] = MY_EMAIL
    msg["To"] = to_field
    msg["In-Reply-To"] = email.message_id
    msg["References"] = email.message_id

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    draft = gmail.users().drafts().create(
        userId="me",
        body={"message": {"raw": raw, "threadId": email.thread_id}},
    ).execute()
    return draft["id"]
