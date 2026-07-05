# Changelog — Alsari Knowledge System

Registro de cambios, fixes y decisiones técnicas relevantes.

---

## 2026-05-14

### Task Scheduler — fix definitivo (LogonType S4U)

- Las 3 tareas (`Alsari Daily Sync`, `Alsari Check Deadlines`, `Alsari Generate Drafts`) cambiadas de `InteractiveToken` a **S4U**
- S4U corre como el usuario `guill` pero sin sesión interactiva → ya no recibe `CTRL+C` al bloquear el PC
- Se descartó usar cuenta `SYSTEM` porque el Python instalado desde Windows Store está en `AppData\Local\Microsoft\WindowsApps` (alias por usuario) y SYSTEM no puede ejecutarlo
- **Para reconfigurar**: ejecutar `scheduler/fix_tasks_admin.ps1` (doble clic o `powershell -ExecutionPolicy Bypass -File ...`). Se auto-eleva vía UAC, solo hay que pulsar "Sí"

---

## 2026-05-13

### Sincronización manual

- La automatización llevaba días fallando con `^C` (sesión bloqueada)
- Ejecutada sincronización manual: `scripts/daily_sync.py`
- Resultado: **5 docs Drive** + **16 hilos Gmail** indexados
  - Drive: FRA.NOTARIA COMPRA LOCAL 6 ARMIA.pdf, MovimientosCuenta (4).pdf, Calculo de gastos 2026 Alsari Capital, contrato Pavier_signed.pdf, Host OS
  - Gmail: tasación Campanillas, financiación Parcela CA, contrato Local 6, Pavier Legacy Group, entre otros

---

## 2026-05-10

### MCP server — fix filtro sociedad

- Corregido bug en `src/alsari/mcp/server.py`: `filter_sociedad` → `filter_sociedades` (plural)
- La función RPC de Supabase espera el parámetro en plural; el singular causaba error `PGRST202` (404)

### draft_replies.py — reconstrucción completa

- Archivo estaba vacío por error de disco lleno en sesión anterior
- Reconstruido desde cero con los siguientes fixes:
  - **source_id nunca encontrado**: el RPC devuelve `source_url` (no `source_id`). Se extrae el file*id de Drive con regex: `re.search(r"/d/([a-zA-Z0-9*-]+)", url)`
  - **Adjunto no aparecía en Gmail**: `MIMEApplication` con headers manuales añadía headers duplicados. Fix: usar `MIMEBase` + `set_payload(data)` + `encoders.encode_base64(part)` + `part.add_header("Content-Disposition", "attachment", filename=...)`
  - **"Invalid To header"**: nombres con caracteres no-ASCII (ej: "Alicia Rodríguez") rompían la API de Gmail. Fix: `email.utils.parseaddr()` para extraer solo la dirección `<email@domain>`
  - **Gemini no incluía `[ATTACH:id]`**: prompt reestructurado con reglas numeradas y ejemplo concreto

### Grafo de conocimiento — D3.js bundled localmente

- El CDN `d3js.org` no era accesible desde la red → grafo aparecía en negro
- Solución: D3.js v7 descargado y guardado en `static/d3.v7.min.js`; `pages/grafo.py` lee el archivo local e incrusta el JS directamente en el HTML

### MCP server desconectado accidentalmente

- El proceso Python del MCP fue matado por `Stop-Process python*` ejecutado para limpiar procesos zombie del Task Scheduler
- **Fix**: cerrar Claude Desktop completamente desde la bandeja del sistema (click derecho → Quit), esperar 5s, reabrir

---

## 2026-04-24 (estado inicial documentado)

### Sistema completo y operativo

- Fases 0–8 completadas: ingesta Drive+Gmail, embeddings Voyage AI, búsqueda semántica pgvector, alertas vencimientos, borradores automáticos Gemini, MCP server, Dashboard Streamlit
- ~2900+ chunks indexados (203 docs Drive + ~369 hilos Gmail)
- Coste operativo: ~1–3 €/mes (solo Anthropic API)

---

## Bugs conocidos y soluciones de referencia

| Problema                               | Causa                                                        | Solución                                                            |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Task Scheduler `^C` / exit 0xC000013A  | `LogonType=InteractiveToken` recibe señal al bloquear sesión | Cambiar a S4U con `fix_tasks_admin.ps1`                             |
| SYSTEM no ejecuta Python               | Python de Windows Store es alias por usuario en AppData      | Usar S4U en vez de SYSTEM                                           |
| PowerShell wrapper en .bat → DNS fallo | `powershell -NonInteractive` no hereda env correctamente     | Llamar Python directamente en el bat                                |
| Grafo negro                            | CDN d3js.org no accesible                                    | D3.js bundled en `static/d3.v7.min.js`                              |
| MCP `filter_sociedad` 404              | RPC Supabase espera parámetro en plural                      | `filter_sociedades` en `server.py`                                  |
| MCP desconectado                       | Proceso Python matado externamente                           | Reiniciar Claude Desktop desde bandeja                              |
| Adjunto no aparece en borrador         | Headers duplicados con MIMEApplication                       | MIMEBase + encode_base64                                            |
| "Invalid To header" Gmail              | Nombre no-ASCII en campo To                                  | `email.utils.parseaddr()`                                           |
| Supabase 1000 rows truncados           | Límite por defecto de PostgREST                              | Paginación `.range(offset, offset+999)` en bucle                    |
| Anthropic 503/529                      | Sobrecarga API                                               | Reintentos automáticos con backoff 30s en `classifier.py`           |
| Puerto 8501 ocupado                    | Proceso Streamlit anterior sin cerrar                        | `netstat -ano \| findstr ":8501"` → `Stop-Process -Id <pid> -Force` |
