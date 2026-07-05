# Plan del Proyecto — Alsari Knowledge System

## Objetivo

Sistema de gestión documental y búsqueda semántica para ~60 documentos críticos de Alsari Capital dispersos en Google Drive y Gmail. Permite:

- Preguntas en lenguaje natural ("¿qué pagos debo a Evariste?")
- Ingesta automática de nuevos documentos
- Alertas proactivas de fechas críticas (earn-outs, vencimientos, seguros)

## Decisión arquitectónica

**Código Python, ejecución 100% local** (sin nube pública). Motivos:

- Coste: 0€ de hosting
- Mejores librerías para parseo de PDFs/Word/Excel
- **Confidencialidad:** ningún documento ni token OAuth sale del PC. No usamos GitHub Actions precisamente por esto.
- Contrapartida aceptada: el PC debe estar encendido a la hora del cron nocturno

## Stack

| Capa                     | Servicio                              | Plan               | Uso estimado                          |
| ------------------------ | ------------------------------------- | ------------------ | ------------------------------------- |
| Base de datos + vectores | Supabase Free                         | 500 MB + pgvector  | ~20 MB para 60 docs                   |
| Embeddings               | Voyage AI Free                        | 200M tokens gratis | ~500k para ingesta inicial            |
| Clasificación + Q&A      | Anthropic API (**Claude Sonnet 4.6**) | pago por uso       | ~1€ inicial + <1€/mes                 |
| Cron / automatización    | **Windows Task Scheduler (local)**    | gratis             | —                                     |
| Repo                     | GitHub privado                        | gratis             | Solo código, nunca secretos ni tokens |
| MCP server               | Local (stdio)                         | gratis             | Claude Desktop conecta local          |

**Coste total estimado: 1–3 €/mes** (solo Anthropic API).

## Arquitectura

```
Todo corre en el PC Windows
───────────────────────────────────────────────────────────
• 08:00  generate_drafts.py   (Task Scheduler — borradores Gmail)
• 09:00  check_deadlines.py   (Task Scheduler — alertas vencimientos)
• 23:00  daily_sync.py        (Task Scheduler — sync incremental Drive+Gmail)

On demand:
• app.py                      (Streamlit dashboard — .\run_dashboard.bat)
• mcp/server.py               (stdio, Claude Desktop conecta local)
• ingest_manual.py            (ingesta manual un doc)
```

Los tokens OAuth (`google_token.json`) y el `.env` viven **solo** en el PC, nunca se sincronizan a GitHub.

## Estructura del proyecto

```
Alsari Database/
├── app.py                                # Dashboard Streamlit (entry point)
├── run_dashboard.bat                     # Arrancar dashboard (.\run_dashboard.bat)
├── pyproject.toml                        # deps: anthropic, supabase, voyageai,
│                                         #   google-api-python-client, pypdf,
│                                         #   python-docx, openpyxl, streamlit,
│                                         #   plotly, google-genai, pydantic, click
├── .env                                  # credenciales (gitignored)
├── secrets/                              # gitignored — tokens OAuth Google
├── scheduler/                            # XMLs para Task Scheduler Windows
│   ├── generate_drafts.xml               # 08:00 diario
│   ├── check_deadlines.xml               # 09:00 diario
│   └── daily_sync.xml                    # 23:00 diario
├── pages/                                # Páginas Streamlit
│   ├── estadisticas.py
│   ├── busqueda.py
│   └── hitos.py
├── src/alsari/
│   ├── config.py                         # env + taxonomía + dashboard_password
│   ├── db/
│   │   ├── schema.py
│   │   └── supabase.py
│   ├── extract/
│   │   ├── drive.py                      # OAuth Drive+Gmail (4 scopes)
│   │   ├── gmail.py                      # list_threads_since, fetch_thread
│   │   ├── pdf.py / docx.py / gdocs.py / xlsx.py / ocr.py
│   ├── pipeline/
│   │   ├── chunker.py                    # chunk_text + chunk_tabular
│   │   ├── classifier.py                 # Claude → JSON (reintentos 503/529)
│   │   ├── embedder.py                   # Voyage voyage-3.5 → 1024-d
│   │   └── ingest.py                     # + ingest_gmail_thread()
│   ├── alerts/
│   │   ├── deadlines.py                  # alsari_hitos → email HTML Gmail API
│   │   ├── draft_replies.py              # Gemini 2.5 Flash Lite + KB + perfil estilo
│   │   └── style_profile.txt             # Perfil escritura Guillermo (80 muestras)
│   └── mcp/
│       └── server.py                     # FastMCP stdio — buscar_documentos, listar_fuentes
├── scripts/
│   ├── ingest_manual.py
│   ├── ingest_bulk.py                    # paginado Supabase
│   ├── ingest_gmail_bulk.py              # --after YYYY/MM/DD
│   ├── daily_sync.py                     # --init para inicializar tokens
│   ├── check_deadlines.py                # --dry-run, --test
│   └── generate_drafts.py               # --dry-run, --max N
└── style_samples.json                    # 80 respuestas reales para análisis estilo
```

## Fases de entrega

| Fase | Alcance                                                                                                          | Estado                   |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 0–2  | Arquitectura, schema Supabase, Voyage AI                                                                         | ✅ Completada            |
| 3a   | Núcleo Python: config, db, extract, pipeline                                                                     | ✅ Completada            |
| 3b   | `scripts/ingest_manual.py` (CLI 1 documento)                                                                     | ✅ Completada            |
| 4    | `scripts/ingest_bulk.py` — 203 docs Drive + OCR Gemini para escaneados                                           | ✅ Completada 2026-04-24 |
| 4b   | `scripts/ingest_gmail_bulk.py` — bulk Gmail desde oct 2025 (~369 hilos)                                          | ✅ Completada 2026-04-24 |
| 5    | `scripts/daily_sync.py` **incremental** Drive + Gmail + Task Scheduler 23:00                                     | ✅ Completada 2026-04-24 |
| 6    | Tabla `alsari_hitos` + `check_deadlines.py` + email Gmail API + Task Scheduler 09:00                             | ✅ Completada 2026-04-24 |
| 6b   | `scripts/generate_drafts.py` — borradores email con Gemini 2.5 Flash Lite + perfil estilo + Task Scheduler 08:00 | ✅ Completada 2026-04-24 |
| 7    | `src/alsari/mcp/server.py` — Claude Desktop conectado, estado "running"                                          | ✅ Completada 2026-04-24 |
| 8    | Dashboard Streamlit multi-página con auth — `app.py` + `pages/` + `run_dashboard.bat`                            | ✅ Completada 2026-04-24 |

## Diseño Fase 5 — Ingesta Incremental

- **Drive:** `changes.list` con `startPageToken` persistido en tabla `alsari_sync_state`. Cada ejecución procesa solo los cambios desde la última.
- **Gmail:** `history.list` con `historyId` persistido. Se agrupan mensajes por `threadId` para mantener el contexto de la negociación — cada hilo se ingesta como un documento, no mensaje a mensaje.
- **Idempotencia:** garantizada por `upsert` en `(source_id, chunk_index)`. Los re-procesamientos limpian previamente con `delete_by_source(source_id)`.
- **Si el PC estuvo apagado:** al encender, la Task Scheduler dispara la tarea pendiente con la opción "Run task as soon as possible after a scheduled start is missed".

## Detalle Fase 3a — Orden de construcción

| #   | Módulo                              | Qué hace                                   |
| --- | ----------------------------------- | ------------------------------------------ |
| 1   | `pyproject.toml` + `.env.example`   | Proyecto inicializado, dependencias        |
| 2   | `src/alsari/config.py`              | Lee credenciales + carga taxonomía         |
| 3   | `src/alsari/db/schema.py`           | Modelo pydantic = tabla `alsari_knowledge` |
| 4   | `src/alsari/db/supabase.py`         | Cliente + upsert idempotente               |
| 5   | `src/alsari/extract/drive.py`       | Auth Google (1 vez) + descarga según MIME  |
| 6   | `src/alsari/extract/pdf.py`         | PDF → texto                                |
| 7   | `src/alsari/extract/docx.py`        | Word → texto                               |
| 8   | `src/alsari/extract/gdocs.py`       | Google Docs export → texto                 |
| 9   | `src/alsari/extract/xlsx.py`        | Excel/Sheets → Markdown                    |
| 10  | `src/alsari/pipeline/chunker.py`    | Trocea 500 tokens, overlap 50              |
| 11  | `src/alsari/pipeline/classifier.py` | Claude → metadatos JSON                    |
| 12  | `src/alsari/pipeline/embedder.py`   | Voyage → vector 1024-d                     |
| 13  | `src/alsari/pipeline/ingest.py`     | Orquestador: ata todo                      |

## Formatos soportados

| Tipo          | MIME                                                                      | Extractor                      |
| ------------- | ------------------------------------------------------------------------- | ------------------------------ |
| PDF           | `application/pdf`                                                         | `pdf.py` (pypdf)               |
| Word          | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `docx.py` (python-docx)        |
| Google Docs   | `application/vnd.google-apps.document`                                    | `gdocs.py` (export text/plain) |
| Excel         | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | `xlsx.py` (openpyxl)           |
| Google Sheets | `application/vnd.google-apps.spreadsheet`                                 | `xlsx.py` (export csv)         |

### Chunking por tipo de fuente

Hay dos estrategias — el orquestador (`ingest.py`) elige según `source_type`:

| source_type                                                | Chunker         | Comportamiento                                                                                                                                                            |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drive_pdf`, `drive_docx`, `drive_gdoc`, `gmail`, `manual` | `chunk_text`    | Ventana de 500 tokens con overlap de 50                                                                                                                                   |
| `drive_xlsx`, `drive_gsheet`                               | `chunk_tabular` | **Nunca parte filas.** Empaqueta filas enteras hasta 500 tokens. Repite título de hoja + cabecera Markdown en cada chunk para mantener contexto numérico de balances/PyG. |

## Taxonomía canónica

El clasificador de Claude debe usar exactamente estos valores.

**Sociedades:** Alsari Inversiones S.L., Pavier Legacy Group S.L., Armia Group S.L., Rialsa Obras S.L., Le Toit Grand 10 S.L.U., Perisur Gestión de Inmuebles S.L., Capellanía Desarrollo Residencial S.L.

**Proyectos:** Las Mesas Estepona, Alborán Living, Laguna Park, Campanillas, Álora, CENS

**Personas:** Guillermo Vila Marcos, Javier Alarcón Rivera, Iván Alarcón Rivera, Francisco Javier Alarcón García, Antonia Rivera Sánchez, Alicia Rodríguez Gálvez

**Contrapartes:** Evariste S.A.S., Urbanitae, Nyland Reim S.L., Grupo Procourval, CaixaBank, Banco Santander, FMC Legal, Asesoría MM

**tipo_documento:** escritura, pacto_socios, contrato_prestamo, contrato_arrendamiento, contrato_construccion, balance, pyg, correo, acta

**area:** legal, financiero, fiscal, comercial, operativo, inmobiliario

## Principios de diseño

- **Idempotencia:** upsert por `(source_id, chunk_index)` — nunca duplicamos
- **Trazabilidad:** cada resultado de búsqueda devuelve `source_url` al documento original
- **Versionado de embeddings:** guardamos nombre del modelo para permitir re-embedding futuro
- **Coste controlado:** Free tiers + pago solo por clasificación LLM

## Fechas críticas de negocio (para sistema de alertas, Fase 6)

- **29 May 2026** — Vence seguro Campanillas
- **2026** — Earn-out Evariste (€570k, verificar fecha exacta)
- **Oct 2027–2029** — Calendario liberación pignoraciones Santander
- **2027** — Vencimiento bullet préstamo Perisur (€694.907)
- **Sep 2029** — Vencimiento préstamo Javier→Iván (€451.323)

## Setup que se hace una vez

1. Crear cuenta GitHub → 1 repo privado
2. Autorización Google OAuth (Drive + Gmail): interactiva, guarda token local
3. Rellenar `.env` con claves existentes (Supabase, Voyage, Anthropic)
4. `pip install -e .`
