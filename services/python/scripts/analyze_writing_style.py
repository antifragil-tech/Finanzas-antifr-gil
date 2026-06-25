"""Write Like Guille — analiza todos los emails enviados por Guillermo
y construye un perfil de estilo + banco de ejemplos categorizados.

Output:
  src/alsari/alerts/write_like_guille/raw_pairs.jsonl    (cache)
  src/alsari/alerts/write_like_guille/examples.json      (banco few-shot)
  src/alsari/alerts/write_like_guille/style_guide.md     (manual humano)

Uso:
    python scripts/analyze_writing_style.py                    # análisis completo
    python scripts/analyze_writing_style.py --max-pairs 400    # limitar coste
    python scripts/analyze_writing_style.py --reuse            # saltar fetch (usa caché)
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import click
from anthropic import Anthropic, APIStatusError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from alsari.config import get_settings
from alsari.extract.gmail import _extract_body, get_gmail_service

OUTPUT_DIR = Path(__file__).parent.parent / "src" / "alsari" / "alerts" / "write_like_guille"
RAW_PATH        = OUTPUT_DIR / "raw_pairs.jsonl"
EXAMPLES_PATH   = OUTPUT_DIR / "examples.json"
STYLE_GUIDE_PATH = OUTPUT_DIR / "style_guide.md"

MY_EMAIL        = "guillermovila@alsari.net"
DEFAULT_MAX     = 800
BATCH_SIZE      = 20

# ── Patrones de limpieza ─────────────────────────────────────────────────────

# Patrones que indican inicio de cita / forward / firma — se busca el más temprano
# y se corta TODO desde el principio de la línea que contiene la coincidencia.
_BREAKER_PATTERNS = [
    # Citas / attribution lines
    re.compile(r"^>", re.MULTILINE),
    re.compile(r"escribi[oó]:", re.IGNORECASE),               # "...escribió:" — cortar línea entera (incl. wrap)
    re.compile(r"\bwrote:\s*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^El \w{2,3}, \d{1,2}", re.MULTILINE),         # "El mar, 14 abr..." — apertura típica de Gmail
    re.compile(r"^On \w{3}, \w{3}\s\d", re.MULTILINE),         # "On Mon, Apr 1..."
    re.compile(r"^De:\s.+@",         re.MULTILINE),
    re.compile(r"^From:\s.+@",       re.MULTILINE),
    re.compile(r"^Enviado:\s",       re.MULTILINE),
    re.compile(r"^Sent:\s",          re.MULTILINE),
    re.compile(r"^-{3,}\s*Original Message\s*-{3,}", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^-{3,}\s*Mensaje original\s*-{3,}", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^_{20,}",           re.MULTILINE),
    # Firmas
    re.compile(r"^--\s*$",           re.MULTILINE),
    re.compile(r"^Guillermo Vila",   re.MULTILINE),
    re.compile(r"^Enviado desde ",   re.MULTILINE | re.IGNORECASE),
    re.compile(r"^Sent from ",       re.MULTILINE | re.IGNORECASE),
    re.compile(r"^Get Outlook ",     re.MULTILINE | re.IGNORECASE),
]


def clean_text(text: str) -> str:
    """Quita citas, forwards y firmas. Devuelve solo el texto original del autor.

    Estrategia: encuentra la primera coincidencia de cualquier patrón breaker,
    luego retrocede al inicio de su línea (para no dejar fragmentos como
    'El mar, 14 abr...' que comienzan antes del match), y corta ahí.
    """
    earliest = len(text)
    for pat in _BREAKER_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        # Retroceder al inicio de la línea que contiene el match
        line_start = text.rfind("\n", 0, m.start()) + 1
        if line_start < earliest:
            earliest = line_start
    text = text[:earliest]
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Fetch ────────────────────────────────────────────────────────────────────

def fetch_sent_pairs(svc, max_pairs: int) -> list[dict]:
    """Para cada hilo donde Guille respondió, captura (recibido, respuesta)."""
    pairs: list[dict] = []
    seen: set[str] = set()
    page_token = None

    click.echo(f"  Listando hilos en Sent...")
    while len(pairs) < max_pairs:
        kw: dict = {"userId": "me", "q": "in:sent", "maxResults": 500}
        if page_token: kw["pageToken"] = page_token
        resp = svc.users().messages().list(**kw).execute()
        msgs = resp.get("messages", [])
        if not msgs: break

        for m in msgs:
            if len(pairs) >= max_pairs: break
            tid = m["threadId"]
            if tid in seen: continue
            seen.add(tid)

            try:
                thread = svc.users().threads().get(userId="me", id=tid, format="full").execute()
            except Exception:
                continue
            t_msgs = thread.get("messages", [])
            if len(t_msgs) < 2: continue

            for i in range(1, len(t_msgs)):
                cur = t_msgs[i]
                cur_h = {h["name"].lower(): h["value"] for h in cur.get("payload", {}).get("headers", [])}
                if MY_EMAIL.lower() not in cur_h.get("from", "").lower():
                    continue
                prev = t_msgs[i-1]
                prev_h = {h["name"].lower(): h["value"] for h in prev.get("payload", {}).get("headers", [])}
                if MY_EMAIL.lower() in prev_h.get("from", "").lower():
                    continue  # no es (otro → Guille)

                received = _extract_body(prev.get("payload", {}))
                response = _extract_body(cur.get("payload", {}))
                if len(received.strip()) < 20 or len(response.strip()) < 10:
                    continue

                pairs.append({
                    "thread_id": tid,
                    "received_subject": prev_h.get("subject", ""),
                    "received_from":    prev_h.get("from", ""),
                    "received_body":    received[:3000],
                    "response_body":    response[:3000],
                    "date":             cur_h.get("date", ""),
                })
                break  # un par por hilo basta

        page_token = resp.get("nextPageToken")
        if not page_token: break
        click.echo(f"    {len(pairs)} pares capturados...")

    return pairs


# ── Categorización con Claude ────────────────────────────────────────────────

def _claude_call(client: Anthropic, system: str, user: str, max_tokens: int = 2500) -> str:
    s = get_settings()
    for attempt in range(3):
        try:
            msg = client.messages.create(
                model=s.anthropic_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return "".join(b.text for b in msg.content if b.type == "text").strip()
        except APIStatusError as e:
            if e.status_code in (503, 529) and attempt < 2:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    return ""


def _parse_json_array(raw: str) -> list:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON array: {raw[:200]}")
    return json.loads(raw[start:end+1])


CATEGORIES = [
    "confirmacion_breve",       # ok, recibido, perfecto
    "agradecimiento_simple",
    "envio_documentos",         # te adjunto, te comparto
    "peticion_documento",       # ¿me puedes mandar X?
    "respuesta_pregunta",       # contesta una pregunta concreta
    "instruccion_equipo",       # gestiona algo, organiza, encárgate
    "negociacion_precio",
    "organizacion_reunion",     # cita, llamada, agenda
    "rechazo_cortes",
    "aclaracion_tecnica",       # explica detalle financiero/legal
    "seguimiento",              # status update
    "otro",
]


def categorize_batch(client: Anthropic, batch: list[dict]) -> list[dict]:
    """Devuelve los pares enriquecidos con category + score 0-10."""
    system = (
        "Clasificas pares email-recibido / email-respuesta de Guillermo Vila Marcos. "
        "Para cada par, devuelve un objeto JSON con 'id' (índice 0-based), "
        "'category' (UNA de las categorías canónicas), "
        "'representative_score' (0-10, 10 = ejemplo prototípico que un nuevo borrador "
        "debería imitar; 0 = atípico / mal limpio / sin valor para few-shot).\n\n"
        f"Categorías canónicas: {', '.join(CATEGORIES)}\n\n"
        "Devuelve SOLO un array JSON, sin markdown, sin texto extra."
    )

    user_parts = []
    for j, p in enumerate(batch):
        user_parts.append(
            f"--- Par {j} ---\n"
            f"<recibido>\n{p['received_body'][:1200]}\n</recibido>\n"
            f"<respuesta_guille>\n{p['response_body'][:1200]}\n</respuesta_guille>\n"
        )
    raw = _claude_call(client, system, "\n".join(user_parts), max_tokens=2500)

    try:
        results = _parse_json_array(raw)
    except Exception as e:
        click.secho(f"    parse error: {str(e)[:80]}", fg="yellow")
        return []

    out: list[dict] = []
    for r in results:
        idx = r.get("id")
        if isinstance(idx, int) and 0 <= idx < len(batch):
            cat = r.get("category", "otro")
            if cat not in CATEGORIES: cat = "otro"
            out.append({
                **batch[idx],
                "category": cat,
                "representative_score": int(r.get("representative_score", 0)),
            })
    return out


# ── Síntesis del style guide ─────────────────────────────────────────────────

def synthesize_style_guide(client: Anthropic, enriched: list[dict]) -> str:
    """Pasa los mejores ejemplos a Claude y obtiene un manual de estilo."""
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for e in enriched:
        by_cat[e["category"]].append(e)

    selected: list[dict] = []
    for cat, items in by_cat.items():
        items.sort(key=lambda x: -x.get("representative_score", 0))
        selected.extend(items[:4])

    system = (
        "Eres un experto en análisis de estilo de escritura. Vas a leer ejemplos reales "
        "de respuestas de Guillermo Vila Marcos (CEO Alsari Capital) y extraer su voz. "
        "Genera un MANUAL DE ESTILO en markdown que cualquier modelo pueda usar para "
        "imitar a Guillermo de forma convincente. "
        "Sé MUY específico, cita expresiones literales, pega ejemplos textuales. "
        "No inventes nada que no esté en los ejemplos."
    )

    parts = [
        "# Tarea\n",
        "Analiza estos ejemplos de emails de Guillermo y produce su MANUAL DE ESTILO en markdown. "
        "Estructura el manual con estas secciones:\n",
        "1. **Personalidad y tono general** (3-4 frases)",
        "2. **Saludos** — cuándo usa cada variante, con ejemplos textuales",
        "3. **Cierres y firma** — cuándo usa cada uno; particularidades",
        "4. **Estructura por longitud** — cuándo es telegráfico, cuándo se extiende",
        "5. **Vocabulario y frases recurrentes** — lista con frecuencia y contexto",
        "6. **Tono según destinatario** — interno vs externo, conocido vs nuevo, formal vs informal",
        "7. **Particularidades** — faltas ortográficas consistentes (las que son SU firma), uso de mayúsculas, exclamaciones",
        "8. **Qué EVITA** — fórmulas que nunca usa",
        "9. **Patrones por categoría de email** — para cada categoría con ejemplos suficientes",
        "",
        "EJEMPLOS REALES (recibido + respuesta de Guillermo):",
        "",
    ]
    for e in selected:
        parts.append(f"### Categoría: {e['category']}  (score {e.get('representative_score',0)}/10)")
        parts.append(f"<recibido>\n{e['received_body'][:600]}\n</recibido>")
        parts.append(f"<respuesta>\n{e['response_body'][:600]}\n</respuesta>")
        parts.append("")

    return _claude_call(client, system, "\n".join(parts), max_tokens=4500)


# ── Main ─────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--max-pairs", default=DEFAULT_MAX, help="Pares máximos a procesar")
@click.option("--reuse", is_flag=True, help="Reutilizar caché de raw_pairs.jsonl")
@click.option("--examples-per-cat", default=8, help="Ejemplos por categoría en examples.json")
def main(max_pairs: int, reuse: bool, examples_per_cat: int) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    s = get_settings()
    client = Anthropic(api_key=s.anthropic_api_key)

    # 1. Fetch
    if reuse and RAW_PATH.exists():
        click.echo(f"→ Reutilizando {RAW_PATH}")
        with open(RAW_PATH, encoding="utf-8") as f:
            pairs = [json.loads(l) for l in f if l.strip()]
    else:
        click.echo(f"→ Descargando emails enviados (máx {max_pairs} pares)...")
        svc = get_gmail_service()
        pairs = fetch_sent_pairs(svc, max_pairs)
        with open(RAW_PATH, "w", encoding="utf-8") as f:
            for p in pairs:
                f.write(json.dumps(p, ensure_ascii=False) + "\n")
        click.secho(f"  {len(pairs)} pares guardados", fg="green")

    if not pairs:
        click.secho("Sin pares para analizar.", fg="red"); return

    # 2. Limpieza
    click.echo("→ Limpiando emails (citas, firmas, forwards)...")
    for p in pairs:
        p["received_body"] = clean_text(p["received_body"])
        p["response_body"] = clean_text(p["response_body"])
    pairs = [p for p in pairs if 10 <= len(p["response_body"]) <= 5000
                              and 20 <= len(p["received_body"]) <= 5000]
    click.secho(f"  {len(pairs)} pares válidos tras limpieza", fg="green")

    # 3. Categorización con Claude
    click.echo(f"→ Categorizando con Claude (batches de {BATCH_SIZE})...")
    enriched: list[dict] = []
    n_batches = (len(pairs) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(pairs), BATCH_SIZE):
        batch = pairs[i:i+BATCH_SIZE]
        click.echo(f"  Batch {i//BATCH_SIZE + 1}/{n_batches} ({len(batch)} pares)...")
        enriched.extend(categorize_batch(client, batch))
    click.secho(f"  {len(enriched)} pares clasificados", fg="green")

    cats = Counter(e["category"] for e in enriched)
    click.echo("  Distribución:")
    for cat, n in cats.most_common():
        click.echo(f"    {cat:30s} {n:4d}")

    # 4. Top ejemplos por categoría → examples.json
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for e in enriched:
        by_cat[e["category"]].append(e)
    examples: list[dict] = []
    for cat, items in by_cat.items():
        items.sort(key=lambda x: -x.get("representative_score", 0))
        for ex in items[:examples_per_cat]:
            if ex.get("representative_score", 0) < 5:
                continue  # filtrar ejemplos malos
            examples.append({
                "category":         cat,
                "score":            ex["representative_score"],
                "received_subject": ex.get("received_subject", ""),
                "received_body":    ex["received_body"],
                "response_body":    ex["response_body"],
            })
    EXAMPLES_PATH.write_text(json.dumps(examples, ensure_ascii=False, indent=2), encoding="utf-8")
    click.secho(f"→ {len(examples)} ejemplos guardados en {EXAMPLES_PATH}", fg="green")

    # 5. Síntesis del manual de estilo
    click.echo("→ Sintetizando manual de estilo con Claude...")
    style_guide = synthesize_style_guide(client, enriched)
    STYLE_GUIDE_PATH.write_text(style_guide, encoding="utf-8")
    click.secho(f"→ {STYLE_GUIDE_PATH} guardado ({len(style_guide):,} chars)", fg="green")

    click.secho("\n✓ Análisis completo!", fg="green", bold=True)


if __name__ == "__main__":
    main()
