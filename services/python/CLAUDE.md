# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Alsari Knowledge System** — intelligent document management and semantic search for Alsari Capital (Spanish holding company). Ingests documents from Google Drive and Gmail, generates embeddings, stores in Supabase/pgvector, answers natural-language queries.

See `PLAN.md` for full planning, phases, and taxonomy details.

## Architecture

**Pure Python, 100% local execution** (no public cloud). Documents are strictly confidential — OAuth tokens and documents never leave the PC. GitHub is used only for code versioning, never for secrets or scheduled runs.

```
All runs on the Windows PC
• Phase 3: ingest_manual (on demand)
• Phase 4: ingest_bulk (one-shot ~60 docs)
• Phase 5: daily_sync (Task Scheduler, incremental)
• Phase 6: check_deadlines (Task Scheduler)
• Phase 7: MCP server (stdio, Claude Desktop local)
```

## Tech Stack

| Layer                | Service                               | Plan              |
| -------------------- | ------------------------------------- | ----------------- |
| Database + vectors   | Supabase Free                         | 500 MB + pgvector |
| Embeddings           | Voyage AI (`voyage-3.5`, 1024-d)      | Free 200M tokens  |
| LLM (classify + Q&A) | Anthropic API (**Claude Sonnet 4.6**) | Pay-per-use       |
| Cron                 | **Windows Task Scheduler** (local)    | Free              |
| Query interface      | MCP server (local, stdio)             | Free              |

Target cost: 1–3 €/month (Anthropic API only).

## Project Structure

```
src/alsari/
├── config.py                    # env loading + taxonomy constants
├── db/
│   ├── schema.py                # pydantic models
│   └── supabase.py              # client + upsert + search
├── extract/
│   ├── drive.py                 # router: detects MIME, dispatches
│   ├── pdf.py                   # pypdf
│   ├── docx.py                  # python-docx
│   ├── gdocs.py                 # Drive export → text/plain
│   └── xlsx.py                  # openpyxl → Markdown
├── pipeline/
│   ├── chunker.py               # chunk_text (narrative) + chunk_tabular (never splits rows)
│   ├── classifier.py            # Claude → JSON metadata
│   ├── embedder.py              # Voyage → 1024-d vector
│   └── ingest.py                # orchestrator (branches chunker by source_type)
├── alerts/deadlines.py          # scan alsari_hitos → email
└── mcp/server.py                # MCP server

scripts/
├── ingest_manual.py             # Phase 3b — CLI: single doc
├── ingest_bulk.py               # Phase 4 — folder batch
├── daily_sync.py                # Phase 5 — cron
└── check_deadlines.py           # Phase 6 — cron
```

## Database Schema

Main table: `alsari_knowledge`

```sql
id UUID PRIMARY KEY
content TEXT
embedding vector(1024)
source_type TEXT               -- 'drive_pdf'|'drive_docx'|'drive_gdoc'|'drive_xlsx'|'gmail'|'manual'
source_id TEXT                 -- Drive file_id or Gmail thread_id
source_url TEXT                -- clickable link to original
source_title TEXT
sociedades TEXT[]              -- GIN indexed
proyectos TEXT[]               -- GIN indexed
personas TEXT[]
contrapartes TEXT[]
tipo_documento TEXT
area TEXT
fecha_documento DATE           -- btree indexed
fecha_ingesta TIMESTAMPTZ
chunk_index INT
chunk_total INT
```

Dedup key: `(source_id, chunk_index)` — always upsert, never duplicate.

Additional planned: `alsari_hitos` (deadline alerts, Phase 6), `alsari_ingest_log` (observability).

## Supported File Formats

| Type          | MIME                                                                      | Extractor                      |
| ------------- | ------------------------------------------------------------------------- | ------------------------------ |
| PDF           | `application/pdf`                                                         | `pdf.py`                       |
| Word          | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `docx.py`                      |
| Google Docs   | `application/vnd.google-apps.document`                                    | `gdocs.py` (export text/plain) |
| Excel         | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | `xlsx.py`                      |
| Google Sheets | `application/vnd.google-apps.spreadsheet`                                 | `xlsx.py` (export csv)         |

## Delivery Phases

| Phase | Scope                                                   | Status  |
| ----- | ------------------------------------------------------- | ------- |
| 0–2   | Architecture, Supabase schema, Voyage AI                | ✅ Done |
| 3a    | Core Python (config, db, extract, pipeline)             | ✅ Done |
| 3b    | `scripts/ingest_manual.py`                              | Next    |
| 4     | `scripts/ingest_bulk.py` (60 docs)                      | Pending |
| 5     | Incremental daily sync + Gmail threads + Task Scheduler | Pending |
| 6     | Deadline alerts                                         | Pending |
| 7     | MCP server                                              | Pending |

## Phase 5 — Incremental Sync Design

- **Drive:** `changes.list` with persisted `startPageToken` in `alsari_sync_state` table
- **Gmail:** `history.list` with persisted `historyId`; messages grouped by `threadId` and ingested as a single document per thread
- **Idempotence:** upsert on `(source_id, chunk_index)`; re-ingestion calls `delete_by_source` first
- **Missed runs:** Task Scheduler configured with "Run task as soon as possible after a scheduled start is missed"

## Canonical Taxonomy

Classifier prompts must use these exact values — see `PLAN.md` for full list.

## Design Principles

- **Idempotence:** upsert on `(source_id, chunk_index)`
- **Traceability:** every search result returns `source_url`
- **Embedding versioning:** store model name alongside vectors
- **Free-tier first:** no infrastructure cost except Anthropic API

## Critical Deadlines (for Phase 6 alert system)

- **29 May 2026** — Campanillas insurance expires
- **2026** — Evariste earn-out (€570k, verify date)
- **Oct 2027–2029** — Santander pignoration release schedule
- **2027** — Perisur bullet loan maturity (€694,907)
- **Sep 2029** — Javier→Iván loan maturity (€451,323)
