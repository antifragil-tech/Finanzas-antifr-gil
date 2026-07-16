# Changelog — Antifrágil OS

Todos los cambios relevantes del proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

#### DB — reflejo versionado del esquema real de `antifragil-os` (PR #47, 2026-07-16)

- **`services/supabase/esquema-real/`**: foto fiel del esquema `public` de la base
  real (58 tablas · 21 enums · 12 funciones propias · 12 vistas · 36 triggers ·
  256 constraints · 74 políticas RLS), generada por reflexión de **solo lectura**
  (`information_schema` + `pg_catalog` vía Management API). Cierra la deuda
  "esquema aplicado en vivo sin SQL versionado".
- `scripts/db/reflejar-esquema.py` regenera el reflejo tras cualquier cambio de
  esquema (token por variable de entorno, nunca commiteado);
  `post_reflejo_checks.sql` verifica la paridad repo↔base viva.
- Auditoría incluida en el README del paquete: RLS activado en 58/58 tablas,
  buckets privados, capa de roles operativos ya construida en BD; 41/74 políticas
  aún permisivas (backlog de endurecimiento).
- Consecuencia: **PRs #4 y #12 cerrados** (su contenido está aplicado y ampliado
  en la base real; quedan como documentación histórica del diseño).

#### Host OS — jerarquía visual del OS: Panel con datos reales y héroes por página (PR #46, 2026-07-16)

- **El Panel (`/dashboard`) deja de ser mock**: con entorno lee ingresos, gastos,
  CxC y liquidaciones reales (sin entorno, demo). Banda héroe "Resultado del mes ·
  Clínica", KPIs de apoyo (pendiente de cobrar, coste de equipo, nº ingresos,
  ticket medio), tendencia de 6 meses (ingresos vs gastos) y avisos **reales**
  "Requiere atención" derivados de los datos (IVA aplicado a exentos, reglas de
  liquidación sin confirmar, deuda de proyectos externos). Derivaciones puras en
  `apps/host/src/components/os/dashboard/panel.ts`; se eliminan `OSDashboard.tsx`
  y `mockDashboardData.ts`.
- **Nav por lógica de decisión**: Dirección (Panel) / Dinero (Tesorería →
  Rentabilidad → Liquidaciones) / Operación (Reservas) / Sistema. Tesorería pierde
  el flag `placeholder` obsoleto; topbar del shell pasa de "Draft — shell sin
  módulos" a "MVP operativo".
- **Rentabilidad**: el héroe pasa de M1 a **M3 (margen operativo)** con delta vs
  mes anterior; M1 e ingreso devengado como cifras de apoyo.
- **Tesorería**: banda héroe de saldo con reparto Caja/Banco (lee
  `cuenta_tesoreria` de gastos vía `select=*`, tolerante si la columna no existe).
- **UI kit**: `OSHeroMetric`, `OSDelta`, `OSSection` plegable (`<details>`
  server-safe); utilidades de periodo (`resolverMes` — cada página abre en el
  último mes con datos; `?mes=todo` para histórico; `variacionPct`, `mesAnterior`).
- Origen: rescate del trabajo del 2026-07-08 que quedó sin commitear en
  `wt-ux-jerarquia` (Rentabilidad estaba a medio refactor y no compilaba; se
  completó según el diseño original).

> **Antifrágil OS — web operativa conectada a datos reales (2026-07-06 → 2026-07-07).**
> Los PRs #33–#42 convirtieron el host en el runtime del MVP Antifrágil OS: las páginas
> operativas viven en `apps/host/src/app/(app)/(os)/` y consumen el dominio de
> `packages/operativa` (`@antifragil/operativa`). Contrato transversal de todas las
> entradas siguientes: **sin entorno configurado → escenario demo (el build de CI sin
> secrets sigue verde); con entorno → datos reales de Supabase.**

#### Host OS + `@antifragil/operativa` — importación web de reportes periódicos + conciliación pago→factura (PR #42, 2026-07-07)

**Dominio (`packages/operativa/src/importacion.ts`):**

- 3 plantillas nuevas en `PLANTILLAS` con sus importadores puros: `facturas_salonized` (`importarFacturasSalonized`), `efectivo` (`importarEfectivo`, formato `fecha;hora;importe;nota`) y `extracto_banco` (`importarExtractoBanco`, importe con signo). Reutilizan `parseCsv` y la normalización de claves/importes/fechas existente.

**Servidor (`apps/host/src/lib/datos/`):**

- `importacionWeb.ts`: el CSV subido vive como **lote temporal en el tmpdir del sistema** (jamás se persiste en el repo) solo entre la previsualización y el "Aplicar". Cada fila recibe una **clave determinista uuid v5** de su contenido (namespace fijo del OS + contador de ocurrencia para filas legítimamente idénticas, p. ej. dos pagos iguales a la misma hora).
- `accionesImportacion.ts`: server actions `subirReporte` (CSV ≤ 4 MB), `aplicarLote` (insert con `on_conflict=id` + `resolution=ignore-duplicates` ⇒ **aplicación idempotente**: re-importar el mismo archivo no duplica nada), `descartarLote` y `conciliarPago`.

**UI (`/tesoreria/importar`):**

- Selector de tipo de reporte + **preview con detección de duplicados** contra la base (consulta `idsExistentes` por lotes de 80 ids) antes de aplicar.
- **Conciliación v1**: pagos SALIENTES del banco sin factura asociada (`movimientos_bancarios` con `importe < 0` y `factura_recibida_id is null`) ↔ facturas recibidas sin movimiento vinculado. Al conciliar → doble vínculo movimiento↔factura, la factura pasa a `pagada` y, si da soporte a un gasto operativo, se cierra también ese vínculo inverso.

**Destinos:** facturas_salonized → `ingresos_devengados` + `cobros` · efectivo → `cobros` · extracto_banco → `movimientos_bancarios`. Las cuentas de tesorería se resuelven **por tipo** (`caja`/`banco`) — nunca ids hardcodeados.

#### Host OS — entrada manual de datos + emisión de factura operativa serie OPS (PR #41, 2026-07-07)

**Entrada manual en `/tesoreria`** (`EntradaDatos.tsx` + server actions en `apps/host/src/lib/datos/acciones.ts`):

- Alta de **gasto operativo** (taxonomía A–D + capa de coste), **ingreso devengado con cobro opcional** (el cobro entra al libro de caja `cobros`; caja y devengo son libros separados que jamás se suman — doc 09 §4.4) y **factura recibida** (soporte documental, estados físicos del workflow del baseline). Validación SIEMPRE en servidor; avisos por redirect `?ok=`/`?error=` — nunca crash.

**Emisión de factura operativa (`emitirFacturaOperativa`):**

- Registro **precontable** serie **OPS** (doc 02 D1: la factura fiscal oficial sigue delegada fuera del OS). Numeración `max(numero)+1` por serie con reintento único ante colisión 409 (unique `(serie, numero)`). Total = base + IVA; el desglose Base/IVA viaja en `notas` con formato estable (la tabla no lo persiste — D2). Con IVA = 0 añade la leyenda de **exención sanitaria (art. 20.Uno.3º Ley 37/1992)**.
- **Vista imprimible `/tesoreria/factura/[id]`** (series OPS/DRV): overlay de fondo blanco sobre el shell oscuro con **wordmark Antifrágil**, pensada para Ctrl+P → PDF (reglas `@media print` en `globals.css`: solo se imprime `.factura-print`). Tras emitir se redirige directamente a esta vista.

**Filtro de mes:**

- Selector `?mes=YYYY-MM` (componente `OSFiltroMes` + utilidades puras `apps/host/src/lib/datos/periodo.ts`) en **Tesorería y Rentabilidad**; las server actions conservan el periodo activo al volver.

#### Host OS — Liquidaciones conectada al histórico real de Supabase (PR #40, 2026-07-07)

- `/liquidaciones` lee `liquidaciones_mensuales` con embed de `clinica_profesionales` (nombre, activo) y `lineas_liquidacion` (detalle, cantidad, importe) vía `cargarLiquidacionesReales()`. Histórico real **nov-2024 → dic-2025** importado del Excel de pago a trabajadores. Sin entorno → escenario demo.

#### Host OS — Tesorería y Rentabilidad conectadas a los datos reales de Supabase (PR #39, 2026-07-06)

- **Nueva capa de datos `apps/host/src/lib/datos/fuenteDatos.ts` (solo servidor)**: lecturas vía **PostgREST con la service_role key** — la clave jamás llega al cliente (las páginas OS son Server Components).
- **Contrato del build establecido**: `datosRealesDisponibles()` comprueba `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; si faltan, las pantallas caen al **escenario demo** de `@antifragil/operativa` (el build de CI sin secrets sigue verde).
- Tesorería y Rentabilidad leen `gastos_operativos` (fecha = fecha de PAGO), `ingresos_devengados`, `facturas_emitidas_operativas` y la vista **`v_facturas_recibidas_operativas`** (traduce el estado físico del workflow OCR al vocabulario del producto).

#### Datos — base Supabase real de Antifrágil poblada (2026-07-06/07)

> Sin cifras sensibles en este documento: se describen **estructuras**, no importes.

- La base real quedó poblada con la operativa del negocio: **gastos operativos** del Cash Flow 2025–2026, **ingresos devengados** con el detalle de Salonized, **99 facturas recibidas del Drive** (88 conciliadas con sus movimientos bancarios), **liquidaciones nov-2024 → dic-2025**, **cobros en efectivo** y **cuentas por cobrar**.
- **Cambios de esquema aplicados directamente sobre la base real** (aún sin SQL versionado en el repo; llegará con `feat/web-cxc-proyectos`): tabla nueva **`public.cuentas_por_cobrar`** (RLS activado, policies para `authenticated`) y **dimensión de proyectos en `gastos_operativos`** para imputar gasto a proyecto (CLI-PLY, CENS, MENDRA, 9AM).
- Sin datos clínicos: solo estructuras administrativo-financieras (alcance v1, `docs/compliance/`).

> **Fase 5 (continuación) — Presupuestos multi-sociedad, cashflow consolidado, presupuesto de ingresos y recurrencia automática.** _(Bloque legado Alsari, anterior al MVP Antifrágil OS.)_

#### `@alsari/contabilidad` — PR F: importación de extractos bancarios (2026-06-23)

Sube extractos bancarios (CSV/XLSX) por sociedad/cuenta/mes/año, los normaliza en `movimientos_bancarios` y deduplica. **Solo importa y normaliza**: no concilia, no toca facturas/pagos/Drive/OCR/Gmail. Extiende la infraestructura existente (parsers, categorización, vista) en vez de duplicarla.

- **Nueva tabla `extractos_bancarios`** (migración `202606231000`, aditiva): sociedad, cuenta bancaria, banco, IBAN, mes/año, archivo, `archivo_hash`, métricas (nº movimientos/importados/duplicados), rango de fechas, **estado** (`importado | pendiente_revision | listo_conciliacion | deshecho`) y trazabilidad. Índice único parcial `(sociedad, archivo_hash) where estado <> 'deshecho'`. Columnas aditivas en `movimientos_bancarios`: `extracto_id`, `hash`, `referencia`, `tipo_movimiento`, `cuenta_bancaria_id` + índice único parcial `(sociedad, hash)`.
- **Deduplicación por doble hash**: `archivo_hash` (sha256 del fichero) bloquea re-subir el mismo extracto; `hash` por fila = `sha256(sociedad|iban|fecha|importe_céntimos|concepto_normalizado|saldo|referencia)` evita duplicar movimientos (incluso con solapes de fechas entre extractos). Lógica pura `lib/extractoImport.ts` (canónico + sha256 vía Web Crypto + adaptador XLSX→filas con `xlsx` **lazy-loaded** + rango/avisos).
- **RPC `importar_extracto_bancario`** (atómica, security definer): crea el extracto + inserta los movimientos no duplicados (`on conflict (sociedad, hash) do nothing`) + devuelve `{total, importados, duplicados, errores, extracto_id, ya_importado}`. Evita importaciones parciales. **RPC `deshacer_importacion_extracto`**: borra explícitamente los movimientos del extracto y lo marca `deshecho` (soft-state, sin CASCADE automático).
- **UI** (extiende `MovimientosBancarios`): pestañas **Movimientos / Extractos**; importador con **cuenta bancaria** (de `cuentas_bancarias_sociedad` + IBAN manual de fallback), **mes/año**, **CSV o XLSX**, preview con **total / nuevos / duplicados / rango / avisos** (incl. "fichero ya importado" y "sin saldo ni referencia"); lista de extractos con estado, **filtro de movimientos por extracto** y **deshacer importación**. Los selectores usan el dropdown oscuro `SelectField`.
- **Tests** (vitest): 15 nuevos (hash determinista, mismo movimiento→mismo hash, fichero/filas duplicadas, XLSX→filas, parsers CSV siguen verdes, rango, aviso de dedup). **Requiere aplicar la migración post-merge.**
- **Fase 2 (no incluido)**: Norma 43, PDF-OCR, conciliación automática, paquete gestoría. **No toca** OCR, Drive, Gmail, pagos, facturas, reglas de proveedores ni estados de factura.

#### `@alsari/contabilidad` — PR E.1: hotfix UX del modal de reglas de facturación (2026-06-23)

Arregla el aspecto del modal **Reglas de facturación** en dark mode. Los `<select>` nativos abrían una lista blanca del SO que tapaba el modal. Solo UX/visual; **sin tocar lógica de reglas, migraciones, Supabase, OCR, Drive, pagos ni datos**.

- **Dropdown oscuro reutilizable** `components/SelectField.tsx` (extraído del que ya usaba el panel de factura: portal con `z-index` alto, fondo `zinc-900`, altura máxima con scroll interno, posicionamiento sobre el botón). El panel de factura queda **intacto**.
- Los 3 selects del modal (sociedad, método de pago, régimen IVA) pasan de `<select>` nativo a `SelectField`. **Más contraste** en las etiquetas (zinc-400). Layout, padding y botones sin cambios de lógica.
- Checks: type-check ✅ · lint ✅ · tests ✅ (61, sin cambios) · build ✅.

#### `@alsari/contabilidad` — PR E: proveedores recurrentes / reglas de facturación y domiciliadas (2026-06-23)

Reglas por proveedor para hacer el módulo de facturas más operativo: cuando entra una factura de un proveedor conocido, la app **sugiere** sociedad/cuenta/IVA/retención/método/concepto y marca domiciliadas. **v1 = solo sugerencias y preparación operativa: nada se auto-valida, auto-aprueba, auto-paga ni envía emails.**

- **Tabla `proveedores_reglas`** (migración `202606230900`, aditiva) anclada a **`(contacto_id, sociedad_id_ref)`**: `sociedad_id_ref` concreto = regla específica; `null` = **regla global** del proveedor (fallback). Índices únicos parciales: una regla activa por (contacto, sociedad) y una global activa por contacto. RLS `for all to authenticated`; `updated_at` por trigger. Campos: cuenta/proyecto/presupuesto/partida, método de pago, IVA/retención/régimen, `importe_habitual`+`tolerancia_importe_pct`, concepto, `es_domiciliada`, `requiere_pago_manual`, `requiere_aprobacion_javi`, `requiere_factura`, `requiere_justificante_pago`, `auto_validar` (**INERTE en v1**), `activa`, `notas`. Columnas aditivas en `facturas_recibidas`: `es_domiciliada` y `regla_aplicada_id`.
- **Selección de regla** (`lib/proveedorReglas.ts`, puro y testeado): específica > global; si la factura **no** tiene sociedad validada → solo la global (jamás se pisa la sociedad del OCR — PR D.1). Las reglas se aplican como **sugerencias en cliente** al abrir la factura; **no toca `procesar-factura`** (sin redeploy de OCR).
- **Domiciliadas**: sin nuevos estados. Sub-estado **DERIVADO** `pendiente_cargo | cargada_sin_justificante | pagada`. El cargo se registra como un `factura_pago` con `metodo_pago='domiciliacion'` (RPC existente) → `pagada` dentro de tolerancia → Drive archiva igual. **Sin pago automático.**
- **`requiere_aprobacion_javi`**: en v1 **solo aviso visual** (no fuerza el routing de la RPC de aprobaciones). **`tolerancia_importe_pct`** alerta solo si hay `importe_habitual` + tolerancia y la factura se sale del rango (no bloquea).
- **UI**: panel de factura con card "Sugerencias del proveedor" (chips por campo + "Aplicar todo"), "Crear regla desde esta factura", banner de domiciliada + toggle + sub-estado, avisos de Javi e importe; **Contactos › Reglas de facturación** (CRUD por proveedor, ver sociedad de cada regla, activar/desactivar); **filtro y badge "Domiciliadas · pendientes de cargo"** en la lista.
- **Tests** (vitest): 18 nuevos (selección específica/global, sugerencias y `yaAplicado`, alerta de importe, regla-desde-factura, sub-estado domiciliada). **Requiere aplicar la migración post-merge.**
- **No incluye**: Gmail, notificaciones reales, conciliación bancaria, paquete gestoría, OCR (sin tocar `procesar-factura`), routing real de Javi, pagos automáticos ni cambios de estados principales.

#### `@alsari/contabilidad` — PR D.1: asignación correcta de la sociedad receptora (hotfix) (2026-06-22)

Corrige un fallo grave: el OCR detectaba bien el receptor (p. ej. "ALSARI INVERSIONES S.L. — B93626158") pero la factura se asignaba **silenciosamente a la primera sociedad de la lista** (Alrive), y se archivaba en Drive bajo la sociedad equivocada. **Causa raíz**: el NIF se comparaba sin normalizar (`B93626158` ≠ `B-93626158`) y, al no casar, el frontend caía a `sociedades[0]`.

- **Mapeo NIF normalizado y unívoco**: módulo puro `lib/sociedadMatch.ts` (`normalizeNif` = mayúsculas + quita todo lo que no sea `A-Z0-9`; `matchSociedadPorNif` exige **match único**). La Edge Function `procesar-factura` replica esta lógica.
- **Fin del fallback a `sociedades[0]`**: receptor con match único → asigna sociedad + `sociedad_validada=true`; sin receptor / sin match / match múltiple → `sociedad_id_ref = null` + `sociedad_validada=false` (**pendiente de validar**). Nunca se asigna una sociedad por defecto.
- **Migración `202606192500`** (aditiva): `sociedad_id_ref` pasa a **nullable** (antes `NOT NULL`); nueva columna `sociedad_validada boolean NOT NULL DEFAULT true` (las facturas históricas quedan `true`, no se rompe el historial); `accion` de `factura_aprobaciones` ampliada con `cambia_sociedad`. **Se aplica post-merge.**
- **RPC `cambiar_sociedad_factura` (security definer, atómica)**: actor derivado de `auth.jwt()`; actualiza `sociedad_id_ref`, marca `sociedad_validada=true` e inserta evento `cambia_sociedad` con metadata (sociedad y CIF anterior/nuevo, comentario). El cambio de sociedad **queda auditado**, no en `notas`.
- **UI panel**: sección **"Sociedad receptora"** con sociedad vinculada + CIF, receptor OCR + NIF, **alerta de discrepancia** ("La sociedad vinculada no coincide con el receptor detectado por OCR"), selector de reasignación (vía RPC) y **previsualización de la ruta de Drive** `Contabilidad / {Sociedad} / {Año} / {Mes}`. **Bloqueado** el "Dar visto bueno" y el archivo en Drive mientras la sociedad esté pendiente.
- **Tests** (vitest): `normalizeNif` (guiones/puntos/espacios/mayúsculas/null) y `matchSociedadPorNif` (match con guion/punto, sin match, vacío, cif null, match múltiple). **Requiere redeploy de `procesar-factura` post-merge.**
- **No incluye**: pagos, justificantes, Gmail, notificaciones, reglas recurrentes, domiciliaciones, OCR general (salvo el mapeo de sociedad), `proyecto-documentos` ni optimización Gemini.

#### `@alsari/contabilidad` — PR D: archivo documental en Google Drive (2026-06-22)

Archiva en Google Drive (Service Account + Shared Drive) el PDF de factura y los justificantes de pago. **Drive es archivo SECUNDARIO**: la fuente operativa segura sigue siendo Supabase Storage privado; si Drive falla, no rompe OCR, pagos, justificantes, estados ni trazabilidad.

- **Auth Service Account** (server-to-server, sin tokens personales ni caducidad) sobre un **Shared Drive** (validado end-to-end: token → carpeta → subir → `webViewLink` → borrar OK). Secrets en la Edge Function: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` (NUNCA en el repo; `.sa-key.json` gitignored).
- **Edge Function `archivar-en-drive`** (Deno): firma JWT RS256 del SA → token; crea la estructura de carpetas **idempotente** `Contabilidad/{Sociedad}/{Año}/{Mes}/{fecha}_{proveedor}_{numero}/`; descarga el PDF/justificantes del bucket privado `facturas` (service role) y los sube; guarda `drive_file_id`/`drive_web_link`/estado. Idempotente: si `drive_file_id` existe, no re-sube. **Requiere deploy + secrets post-merge.**
- **Migración `202606192400`** (idempotente, aditiva): columnas `drive_file_id/drive_folder_id/drive_estado/drive_error/drive_web_link/drive_synced_at` en `facturas_recibidas` y `factura_pagos` (estado `no_archivado|sincronizado|error`).
- **Builder de rutas puro** `lib/drivePaths.ts` (sanitizado + estructura + naming), espejo de la Edge Function, con tests.
- **UI**: sección **"Archivo en Drive"** en el panel (estado, "Enviar a Drive"/"Reintentar"/"Abrir expediente en Drive"). **Auto-archivo al pasar a `pagada`** (best-effort, no bloquea el pago; si falla → `drive_estado=error` + reintentar).
- **Seguridad**: archivos NO públicos; `webViewLink` exige permisos de Drive; **propiedad de la organización (Shared Drive)**, no Drive personal.
- **No incluye**: Gmail, notificaciones reales, reglas recurrentes, domiciliaciones, OCR de justificantes, `proyecto-documentos` ni cambios de estados principales. Facturas antiguas sin PDF → "Sin documentos para archivar" (no rompe).

#### `@alsari/presupuestos` — PR A2-bis: bucket `proyecto-documentos` privado + signed URLs (2026-06-22)

Cierra el único bucket público real con datos sensibles (estudios de mercado, tasaciones, rentas, contratos de proyectos). Mismo patrón que A2, pero **volteando un bucket público con datos** → orden estricto: visor firmado primero, flip a privado el último.

- **Migración `202606192300`** (idempotente; **se aplica post-merge y SOLO tras verificar el visor firmado en producción**): políticas de `storage.objects` `{public}`→`authenticated` (SELECT/INSERT/DELETE); RLS de la tabla `proyecto_documentos` `anon`→`authenticated`; **bucket → privado**. No toca columnas (`archivo_url`/`storage_path` se conservan).
- **Visor firmado**: `documentosApi.getDocumentoUrl` async firma una signed URL temporal (1 h) desde `storage_path` (fallback `archivo_url` legado). Decisión pura `resolveDocumentoSource` en `lib/documentoUrl.ts`. `TabDocumentos` pasa de `<a href={archivo_url}>` a **botón que firma al clic** (loading/error).
- **Compatibilidad**: las 2 docs existentes tienen `storage_path` → abren por signed URL antes y después del flip; sin backfill. Las URLs públicas legadas dejan de resolver tras el flip (criterio de éxito).
- **Tests** (vitest presupuestos): `resolveDocumentoSource` (signed/legacy/none + prioridad).
- **Solo** `@alsari/presupuestos` y `proyecto-documentos`. No toca facturas, pagos, justificantes, Gmail, Drive, notificaciones, OCR ni estados.

#### `@alsari/contabilidad` — PR C: pagos parciales + justificantes + comparación de importes (2026-06-19)

Libro de pagos REALES de tesorería de la factura (parciales, anticipos, regularizaciones), justificantes en Storage privado y detección de descuadres. **Distinto de `presupuesto_pagos`** (seguimiento presupuestario con base imponible); aquí la referencia es `total_a_pagar` (= total − retención).

- **Tablas (migración `202606192100`)**: `factura_pagos` (libro append-only: importe, fecha, método, tipo, justificante, actor) y `factura_incidencias` (infrapago/sobrepago/…, ciclo `resuelta`). Ambas **RLS SELECT-only**; toda escritura por RPC.
- **Cálculo de pago DERIVADO** (no toca el enum de estados de factura): `sin_pagos | pago_parcial | pagada | sobrepagada | descuadrada`, con `TOLERANCIA_PAGO_EUR = 0,50 €` (absorbe redondeos; "pagada dentro de tolerancia" se muestra explícito). Lógica pura `calcularEstadoPago`/`evaluarIncidenciasDelPago` (espejo de la RPC).
- **RPC `registrar_pago_factura` (security definer, atómica)**: actor derivado de `auth.jwt()`; **solo Alicia** (o single-operator); estados permitidos `pendiente_pago` (pagos normales) y `pagada` (solo `regularizacion`); inserta pago + evento `registra_pago`; crea incidencia `sobrepago`/`infrapago` (un pago parcial **no** es incidencia); si se alcanza el total dentro de tolerancia y estaba en `pendiente_pago` → `marca_pagada` + sincroniza el `presupuesto_pago` vinculado. RPC `resolver_incidencia_factura` (+ evento `resuelve_incidencia`).
- **`accion` de `factura_aprobaciones` ampliada**: `+registra_pago`, `+crea_incidencia`, `+resuelve_incidencia`.
- **Justificantes** en el bucket privado `facturas`, ruta `recibidas/{factura_id}/pagos/{pago_id}/{file}`; **política Storage `INSERT` acotada** a ese prefijo (sin `UPDATE`/upsert; rutas únicas por `pago_id`); apertura con signed URL (patrón A2). Subida primero, luego RPC con el `pago_id` generado en cliente (riesgo de justificante huérfano si la RPC falla, documentado).
- **UI**: sección "Pagos" en el panel de factura (resumen total/pagado/pendiente/%/estado, lista de pagos, alta con justificante, incidencias con resolución). Sin rediseño del panel. **No toca la Edge Function.**
- **Tests** (vitest): `calcularEstadoPago`/`evaluarIncidenciasDelPago` (13 casos).
- **No incluye**: OCR de justificantes, conciliación bancaria, Gmail, Drive, notificaciones reales, reglas recurrentes/domiciliaciones, `proyecto-documentos` ni cambios del enum principal de estados.

#### `@alsari/contabilidad` — PR A2: Storage privado de facturas + persistencia real de PDFs (2026-06-19)

Cierra el riesgo de Storage antes de meter justificantes (PR C). **Hallazgo al diagnosticar (verificado en remoto):** el bucket `facturas` **nunca existió** y **0/16 facturas** tenían PDF persistido (la subida de la Edge Function fallaba en silencio) → **no había fuga pública activa de facturas**; el riesgo era latente. El bucket público real con datos sensibles es **`proyecto-documentos`** (presupuestos), que se trata aparte en **PR A2-bis**.

- **Migración `202606192000_facturas_storage_privado.sql`** (idempotente): columna `storage_path` en `facturas_recibidas`; **creación del bucket `facturas` privado de origen** (sin objetos previos → no expone nada); política RLS `SELECT` en `storage.objects` para `authenticated` (necesaria para firmar URLs).
- **Persistencia real corregida**: `procesar-factura` sube el PDF al bucket privado y guarda **`storage_path`** (antes intentaba `getPublicUrl` sobre un bucket inexistente). **Requiere redeploy.**
- **Acceso al PDF centralizado y seguro**: `resolveFacturaPdfSource` (puro, testeable: `storage_path` > `archivo_url` legado > nada) + `getFacturaPdfUrl` async que **firma una signed URL temporal (1 h)**. Visor `FacturaModal` con estados loading/error/reintento; el botón "abrir" del panel firma una URL fresca al clic (las firmadas caducan).
- **Compatibilidad**: facturas antiguas sin PDF → zona de drop manual (sin cambio); legado con `archivo_url` → fallback directo; error al firmar → estado de error. **Sin backfill** (0 filas con `archivo_url`).
- **Tests** (vitest contabilidad): `resolveFacturaPdfSource` (signed/legacy/none + prioridad).
- **No incluye**: `proyecto-documentos` (→ PR A2-bis), pagos parciales, justificantes, Gmail, Drive, notificaciones reales ni cambios de workflow.

#### `@alsari/contabilidad` — PR B: auditoría de transiciones de factura (`factura_aprobaciones`) (2026-06-19)

Trazabilidad inmutable de quién valida/aprueba/paga/rechaza una factura, antes de meter pagos parciales y justificantes. **No cambia el flujo operativo.**

- **Tabla `factura_aprobaciones`** (migración `202606191100`): log append-only con `factura_id, actor_email, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, motivo_rechazo, metadata, created_at`. `estado_anterior/nuevo` como `text` (resilientes a cambios futuros). Índice por `(factura_id, created_at)` y único parcial para un solo evento de creación por factura.
- **Auditoría atómica vía RPC `avanzar_estado_factura_con_auditoria` (security definer)**: cambia el estado **e** inserta el evento en la **misma transacción** → no se pueden perder eventos aunque falle algo después. **Actor derivado de `auth.jwt()` en el servidor** (no spoofable desde el cliente); rol inferido por email vs config. Valida transición **y autorización rol→acción** dentro de la RPC (valida=Guille · aprueba=Javi/Guille · marca_pagada=Alicia · rechaza=quien puede actuar en ese estado), salvo modo single-operator. **`cambia_estado` eliminada de la RPC** (sin cambios de estado arbitrarios desde el cliente; reservada al service role/admin).
- **RLS inmutable**: `SELECT` para autenticados; **sin políticas de INSERT/UPDATE/DELETE** → el cliente no puede escribir logs falsos. Las inserciones legítimas pasan por la RPC (acciones humanas) o el service role (evento de creación de la Edge Function).
- **Edge Function `procesar-factura`**: registra el evento `crea_borrador_ocr` (sistema) al crear la factura (best-effort, no bloquea). **Requiere redeploy** de la función.
- **UI "Trazabilidad"**: timeline en el panel de factura (fecha/hora · actor · acción · estado anterior→nuevo · comentario/motivo). Facturas antiguas sin historial muestran una línea **sintética informativa** desde `created_at` (marcada como tal, no auditada).
- **Tests** (vitest en contabilidad, nuevo setup): máquina de estados (`calcularEstadoNuevo`, `accionDeAvance`) — 9 casos (valida ≤/>umbral, umbral exacto, aprueba, marca_pagada, rechaza, transiciones inválidas).
- **No incluye**: pagos parciales, justificantes, Gmail, Drive, Storage privado, reglas de proveedor, notificaciones reales ni rediseño grande de UI.

#### `@alsari/contabilidad` — PR A: saneamiento de facturas (base coherente) (2026-06-19)

Primer paso del rediseño en profundidad del flujo de facturas. **Solo saneamiento**, sin Gmail, Drive, pagos parciales, justificantes, reglas de proveedor, paquete gestoría, notificaciones reales ni bucket privado.

- **Estados canónicos reafirmados, sin migrar.** Se mantienen los valores técnicos `borrador_ocr | revision_javi | pendiente_pago | pagada | rechazada` (alineados con BD viva, types, UI y Edge Function). Nueva migración idempotente `202606191000_facturas_pra_saneamiento.sql` que **neutraliza la migración huérfana `estados_v2`** (que renombraba a `validacion/revision/pago` y nunca se reflejó en código): remapeo defensivo `validacion→borrador_ocr`, `revision→revision_javi`, `pago→pendiente_pago`, reafirma el CHECK y el default `borrador_ocr`. Impacto cero en datos si producción ya está en nombres ocr.
- **Labels visibles centralizados** en fuente única `ESTADO_FACTURA_RECIBIDA_LABEL` (`@alsari/types`): "Validación Guille", "Revisión Javi", "Pendiente de pago", "Pagada", "Rechazada". Se eliminan los mapas de labels duplicados en `Facturas.tsx` y `FacturaReviewPanel.tsx`.
- **Flag `notifications_enabled` (default `false`)** en `configuracion_contabilidad`: interruptor maestro para notificaciones futuras. **No se envía ningún email** (no había envío real). Indicador solo-lectura en el panel de configuración.
- **Módulo antiguo `@alsari/facturas` archivado y desconectado**: banner ARCHIVADO en su `README.md`/`CLAUDE.md`, eliminada la dependencia muerta del host (`package.json` + `transpilePackages`) y borrado el stub `FacturasAppClient.tsx` (no importado). Se mantiene la carpeta y el redirect `/facturas → /contabilidad`. **Módulo vivo documentado = `@alsari/contabilidad`.**
- **Storage (riesgo documentado, sin tocar el bucket)**: helper central `getFacturaArchivoUrl(factura)` (sin cambio de comportamiento) como único punto para el futuro salto a signed URLs. **Pendiente PR A2**: bucket privado + `storage_path` + backfill + signed URLs.
- Documentado el flujo canónico, estados, módulo vivo vs archivado y riesgo de Storage en `ARQUITECTURA.md`. **Checks**: type-check, lint, build (host sin `@alsari/facturas`) y tests (12/12) en verde.

#### `@alsari/presupuestos` — Rediseño premium del PDF (dossier de inversión) (2026-06-18)

Rediseño visual del informe PDF para que parezca un **dossier financiero corporativo** (presentable a socios, bancos o comité), no un export técnico. **Sin tocar cálculos, estructura funcional, rutas, Storage ni migraciones**; solo el componente PDF y la capa export.

- **Portada a página completa, oscura** (antracita) con el **logo de Alsari como protagonista** (grande, centrado), título del proyecto en grande, subtítulo "Informe financiero", tipo de análisis y fecha; al pie, sociedad tenedora + nota "Informe interno basado en datos introducidos por el usuario" y un discreto "Generado desde Alsari Capital OS". **Se elimina "Alsari Capital OS" como marca/título visible**: en interiores la cabecera usa el logo (no texto) y el nombre del proyecto.
- **Interiores editoriales**: cabecera fina oscura (logo + proyecto), pie discreto con paginación, más margen lateral, títulos con numeración (01, 02…) y secciones mejor separadas.
- **Resumen ejecutivo** como página ejecutiva: card de veredicto (color sobrio según tipo) + **grid de KPIs en tarjetas** (Inversión total, Rentab. neta sobre coste, Rentab. neta sobre valor actual, TIR, VAN).
- **"Explotar vs liquidar"** como **caja de decisión patrimonial**: estado coloreado, rentab. neta sobre valor actual y tasa exigida destacadas, lectura corta y nota de "no es recomendación de venta".
- **Datos introducidos** en bloques (cards) compactos con valores a la derecha; **KPIs calculados** separados visualmente en tabla limpia. **Escenarios** con cabecera oscura y columna base destacada. **Calidad del dato** como badge "X% · Calidad N" + campos **agrupados** en Completos / Estimados / Faltantes. **Alertas** separadas en "Supuestos por defecto" y "Limitaciones". **Anexo** de fórmulas en lenguaje natural, mejor maquetado.
- **Sin hifenación** (`registerHyphenationCallback`) para evitar cortes de palabra ("AC-TUAL"). El modelo `explotarLiquidar` se enriquece con `nivel`, `rentaValor` y `tasaValor` (capa export).
- **Tests**: nuevo smoke test de render real a PDF (`renderToBuffer`) para Villa el Chorro y Ciudad Rialsa (con `PDF_PREVIEW_DIR` opcional para volcar los PDF a disco). Utilidad `scripts/dump-pdf-text.cjs` para verificar el texto del PDF. **12 tests** verdes. **No añade dependencias** (usa `@react-pdf/renderer` y `react` ya presentes).

#### `@alsari/presupuestos` — Renta: "Explotar vs liquidar" + rediseño del PDF + tests (2026-06-18)

Mejora acotada (sin funcionalidad nueva grande) sobre el análisis de renta y el informe PDF.

- **Rentabilidad neta sobre valor actual más visible + lectura "Explotar vs liquidar".** Nueva sección en `RentaView` (no plegada) que muestra en grande la rentabilidad neta sobre el valor actual frente a la tasa exigida, con una lectura: rentab. **≥ tasa → explotación atractiva**; **dentro de 1 punto por debajo → cerca de la tasa** (comparar con alternativas); **más de 1 punto por debajo → estudiar rotación de capital / venta / refinanciación**. **No es una recomendación de venta**: recuerda considerar impuestos, costes de venta, deuda, liquidez, revalorización y alternativas. Lógica en `rentaInsights.lecturaExplotarLiquidar`.
- **Rediseño del PDF.** Logo real de Alsari en portada y cabecera (`apps/host/public/logo.png` embebido como data URI base64 en `lib/logoAlsari.ts`, sin fetch/red → robusto en Vercel). Se sustituyen los iconos Unicode de estado (●◐○) por **texto** ("Completo" / "Estimado" / "Falta") y las viñetas por puntos dibujados. Mejor jerarquía tipográfica, cabecera/pie fijos con paginación, tablas con filas alternas, fórmulas en palabras (p. ej. **VAN = −inversión inicial + suma de cajas descontadas + valor residual descontado**). El PDF de renta incluye ahora la fila "Rentabilidad neta sobre valor actual" y la sección "Explotar vs liquidar".
- **Avisos de defaults en el PDF**: ocupación no informada → se asume 100%; horizonte no informado → 10 años; revalorización no informada → 0% (conservador); fiscalidad no aplicada → análisis antes de impuestos.
- **Tests de regresión (Vitest).** Se añade Vitest al módulo (`test`: `vitest run`) y `src/lib/__tests__/renta.test.ts` (10 casos): rentab. neta sobre valor actual (Ciudad Rialsa ≈9,45%, Villa el Chorro ≈7,94%), ocupación nula tratada como 100%, bandas de "Explotar vs liquidar", y modelo del PDF (fila presente, aviso de default, lectura expuesta).
- **No toca** otros tipos de análisis (salvo el común del PDF: `explotarLiquidar: null`), nombres de KPIs, rutas, migraciones, Storage ni Prettier.

#### `@alsari/presupuestos` — Corrección veredicto de renta y simulador de financiación (2026-06-18)

Corrige tres problemas detectados en un caso real (Villa el Chorro: inversión 491.000 €, valor actual 1.000.000 €, NOI 79.380 €, sin deuda).

- **Veredicto de renta — separa renta operativa de componente patrimonial.** Antes marcaba "Agresivo" solo por tener un valor residual alto, aunque no hubiera deuda. Ahora: nuevo `vanSinResidual` (VAN solo con las rentas) distingue si la operación funciona por la renta. Solo es "Agresivo" si depende casi en exclusiva del residual (VAN sin residual < 0 y la renta no supera tasa+3pp) o hay tensión real de apalancamiento (deuda informada con LTV alto / DSCR ajustado). **No se menciona apalancamiento si no hay deuda.** Cuando la renta funciona y el residual aporta mucho → "Atractivo — alta rentabilidad operativa y fuerte componente patrimonial; conviene validar el valor actual estimado".
- **Simulador de financiación — escenarios sobre la inversión, no sobre el valor actual.** Antes el 50/60/70% se calculaba sobre el valor actual y se capaba a la inversión, dando **tres tarjetas idénticas** (deuda = inversión, equity 0). Ahora los escenarios financian un % de la **inversión/coste** (Conservadora 50% · Moderada 60% · Agresiva 70%) → deudas, cuotas y equity distintos; y se muestra además el **LTV sobre valor actual** como lectura separada.
- **Banner de financiación — diferencia TIR del activo vs TIR del equity.** No afirma que financiar "reduce la TIR" de forma universal: con equity ≈ 0 o sin TIR comparable muestra "Analizar financiación" en vez de "reduce"; con apalancamiento positivo aclara que mejora la rentabilidad sobre el capital aunque reduce la caja libre.
- **PDF** hereda el veredicto corregido automáticamente (usa la misma `evaluarVeredictoRenta`): no menciona apalancamiento sin deuda y explica el componente residual. **No toca otros tipos, nombres de KPIs, rutas ni Prettier.**

#### `@alsari/presupuestos` — Exportar informe financiero en PDF (Fase 5.1) (2026-06-18)

- Botón **"Exportar PDF"** en la pestaña Números: descarga un **informe financiero estructurado** del proyecto. Funciona para los **6 tipos** (renta, compra-venta, explotación, préstamo, CAPEX, alternativo).
- **100% en cliente, bajo demanda, sin servidor ni Storage, sin migración.** `@react-pdf/renderer` y el documento se cargan con **import() dinámico solo al pulsar** → no engordan la carga inicial (chunk aparte de ~491 KB gzip que solo entra al exportar).
- **Mismos números que la pantalla**: la capa `lib/exportProyectoFinanciero.ts` invoca exactamente las mismas funciones de cálculo (`calcKpis*`), insights (`evaluar{Veredicto,Calidad}*`) y escenarios (`generarEscenariosDesdeAnalisis`) que las vistas; no recalcula nada por su cuenta. Tabla de KPIs **adaptada al tipo** (solo los aplicables).
- **Estructura del PDF** (A4 vertical, sobrio): portada · resumen ejecutivo (veredicto + KPIs) · datos introducidos por bloques (vacíos → "No informado") · KPIs calculados · escenarios · desglose financiero por tipo · supuestos · calidad del dato · alertas/limitaciones · anexo de fórmulas. Archivo `informe-financiero-{slug}-{fecha}.pdf`.
- Nuevos `lib/exportProyectoFinanciero.ts`, `components/pdf/InformeFinancieroProyecto.tsx`, `tab-numeros/ExportarPDFButton.tsx`; `TabNumeros.tsx` añade el botón. Dependencia `@react-pdf/renderer`. **No toca cálculos, nombres de KPIs, rutas ni los 6 tipos.**

#### `@alsari/presupuestos` — Vista ejecutiva de Alternativo (Fase 4.5 · cierra Fase 4) (2026-06-18)

Homogeneiza el análisis "Alternativo" (inversión alternativa genérica) con el patrón ejecutivo. **Con esto los 6 tipos de análisis comparten el mismo patrón.** Sin renombrar KPIs existentes.

- **Veredicto ejecutivo** modulado por **riesgo y liquidez**: riesgo alto o liquidez baja impiden el "Atractivo" (bajan a Agresivo); riesgo/liquidez sin informar → veredicto más prudente; retorno ≤ capital o VAN<0 → Revisar. **Calidad del dato** propia.
- **KPIs principales**: Capital requerido · Retorno esperado total · Beneficio esperado · Rentabilidad estimada (TIR) · Múltiplo sobre capital (MOIC) · VAN · Plazo hasta el retorno · Plusvalía latente · Nivel de riesgo · Nivel de liquidez. **Escenarios resumidos** (Retorno · Beneficio · MOIC · VAN · TIR).
- **Modelo de dos flujos** (el existente, ampliado): año 0 = −capital; salida = retorno esperado total. **VAN** = retorno/(1+tasa)^años − capital. **TIR** = (retorno/capital)^(1/años) − 1. **MOIC** = retorno/capital. **Beneficio** = retorno − capital. Aclaración en UI/tooltips: el "retorno esperado total" es el importe **total** a cobrar a la salida (capital + plusvalía), **no** el beneficio.
- **Plusvalía latente** = valoración actual − capital. **No se suma al VAN** (referencia de mercado hoy, no un cobro); no se asume realización inmediata.
- **Riesgo y liquidez cualitativos** (`nivel_riesgo` bajo/medio/alto · `nivel_liquidez` alta/media/baja). Sin informar → "No informado", baja la calidad del dato y el veredicto es más prudente. Migración aditiva `202606181200_alternativo_riesgo_liquidez.sql`.
- **Desplegables**: Detalle de la operación · Riesgo y liquidez · Valoración / plusvalía latente · Supuestos. **Validaciones suaves**: sin capital/retorno/plazo → MOIC/VAN/TIR no definitivos; sin tasa → default + aviso; retorno ≤ capital → Revisar; sin valoración → sin plusvalía latente.
- Nuevos `lib/alternativoInsights.ts` y `tab-numeros/AlternativoView.tsx`; `KpisAlternativoView` delega; `FormAlternativo` en bloques; `kpis.tsx` queda como barrel de re-exports. **No toca renta, compra-venta, explotación, préstamo ni CAPEX.**

#### `@alsari/presupuestos` — Vista ejecutiva de CAPEX interno (Fase 4.4) (2026-06-18)

Homogeneiza el análisis de CAPEX interno con el patrón ejecutivo. **Sin renombrar KPIs existentes. Sin migración** (reutiliza campos existentes).

- **Veredicto ejecutivo** (Atractivo/Defensivo/Agresivo/Revisar) según payback, VAN, TIR, impacto en caja, vida útil, dependencia del valor residual y calidad del dato. **Calidad del dato** propia del CAPEX.
- **KPIs principales**: Inversión CAPEX · Beneficio o ahorro anual esperado · **Impacto en caja anual** (nuevo) · Recuperación del CAPEX · Valor actual neto del CAPEX (VAN) · TIR del CAPEX · Vida útil · Valor residual del activo · Depreciación anual. **Escenarios resumidos** (Ahorro anual · Caja neta anual · Payback · VAN · TIR).
- **Corrección financiera en `calcKpisCapexInterno`**: VAN, TIR y payback pasan a usar la **caja neta anual = ahorro/beneficio bruto − CAPEX de mantenimiento** (antes usaban el ahorro bruto). El ahorro bruto se conserva como dato informativo. Es una corrección, no un cambio arbitrario: proyectos CAPEX con mantenimiento informado verán VAN/TIR/payback ligeramente distintos (más correctos).
- **VAN/TIR**: año 0 = −inversión; caja neta anual durante la vida útil; **valor residual** (% del coste, **vacío = 0% conservador**) sumado **solo al último año** y descontado (no se duplica). TIR por bisección; si los flujos no recuperan la inversión → "No calculable". La **depreciación** se muestra como dato contable y **no entra en la caja** (sin fiscalidad).
- **Desplegables**: Desglose del CAPEX (inversión → ahorro bruto → mantenimiento → caja neta → vida útil → valor residual) · Depreciación (contable) · Supuestos. **Validaciones suaves**: sin inversión/ahorro/vida → VAN/TIR no definitivos; sin tasa → default + aviso; caja neta ≤ 0 → payback no definitivo + aviso (y veredicto Revisar); inversión ≤ 0 → sin TIR; TIR no convergente → "No calculable".
- Nuevos `lib/capexInsights.ts` y `tab-numeros/CapexView.tsx`; `KpisCapexView` delega; `FormCapex` en bloques (Inversión · Beneficio/ahorro · Mantenimiento · Vida útil · Valor residual · Depreciación · Supuestos avanzados). **No toca renta, compra-venta, explotación ni préstamo.**

#### `@alsari/presupuestos` — Vista ejecutiva de préstamo / inversión financiera (Fase 4.3) (2026-06-18)

Homogeneiza el análisis de préstamo (Alsari prestamista) con el patrón ejecutivo. **Sin renombrar KPIs existentes.**

- **Veredicto ejecutivo** (Atractivo/Defensivo/Agresivo/Revisar) según tipo, plazo, TIR vs tasa, VAN, **VAN ajustado por riesgo**, cobertura de garantía, PD/LGD, riesgo de contraparte y claridad del calendario. **Calidad del dato** con campos propios del instrumento (capital/tipo/plazo/tasa críticos).
- **KPIs principales**: Capital prestado · Tipo de interés anual · Ingreso financiero esperado · Cuota estimada · **VAN** · **VAN ajustado por riesgo** · TIR del instrumento · Plazo · Cobertura de garantía · Pérdida esperada · Probabilidad de impago. **Escenarios resumidos** (Cobro anual · Pérdida esperada · VAN · VAN ajustado · TIR · Cobertura).
- **VAN/TIR sobre el calendario real del cuadro de amortización** (`calcKpisPrestamo` reescrito): año 0 sale el capital; cobros mensuales según sistema (francés / bullet). **VAN base** = −capital + Σ cuotaₘ/(1+tasa/12)^m. **TIR** = IRR mensual de los flujos anualizada ((1+r)^12−1), reemplaza la aproximación anterior; si los cobros no recuperan el capital → "No calculable".
- **Garantía**: cobertura = valor garantía / capital (semáforo ≥1,30 holgada · 1-1,30 razonable · <1 insuficiente). **No se suma al VAN** ni se asume ejecución al 100%: solo mide cobertura. Nueva columna `valor_garantia` (migración aditiva).
- **Riesgo separado del VAN base**: pérdida esperada = capital × PD × LGD (solo si PD y LGD informados). **VAN ajustado por riesgo** = VAN base − VP(pérdida esperada) — se muestra **aparte**, sin mezclar rentabilidad contractual y riesgo, sin doble penalización.
- **Desplegables**: Cuadro de amortización · Garantías y cobertura · Riesgo e impago · Supuestos. **Validaciones suaves**: sin capital/tipo/plazo → VAN/TIR no definitivos; sin tasa → default + aviso; sin valor garantía → sin cobertura + aviso; PD/LGD incompletos → pérdida/VAN ajustado no definitivos + aviso; TIR no convergente → "No calculable" sin romper.
- Migración `202606181100_prestamo_valor_garantia.sql` (aplicada al remoto). Nuevos `lib/prestamoInsights.ts` y `tab-numeros/PrestamoView.tsx`; `KpisPrestamoView` delega; `FormPrestamo` en bloques. **No toca renta, compra-venta ni explotación.**

#### `@alsari/presupuestos` — Vista ejecutiva de negocio operativo / explotación (Fase 4.2) (2026-06-18)

Homogeneiza el análisis de negocio operativo con el patrón ejecutivo. **Sin renombrar KPIs existentes.**

- **Veredicto ejecutivo** (Atractivo/Defensivo/Agresivo/Revisar) según EBITDA, margen, payback, VAN/TIR, punto muerto, estabilidad de ingresos y **dependencia de supuestos** (valor de continuidad / crecimiento). **Calidad del dato** con campos propios de explotación.
- **KPIs principales**: Inversión inicial · Ingresos anuales previstos · EBITDA anual · Margen EBITDA · Punto de equilibrio de ingresos · Flujo de caja libre anual (FCF) · Recuperación de la inversión · **VAN** · **TIR** (nuevos). **Escenarios resumidos** (Ingresos · EBITDA · Caja anual · Payback · VAN · TIR).
- **VAN/TIR nuevos en `calcKpisExplotacion`** (inversión completa con flujos completos, sin mezclar capital parcial): inversión inicial = precio adquisición + capital circulante; FCF = EBITDA − CAPEX − impuestos (si fiscalidad); VAN = −inversión + Σ FCF·(1+g)^(t−1)/(1+tasa)^t; TIR = tasa que anula el VAN. Horizonte (`horizonte_analisis_anios`, def. 10), crecimiento sobre FCF (`tasa_crecimiento_anual_pct`, simplificación).
- **Valor de continuidad / terminal opcional** (cerrado y desactivado por defecto): por defecto **sin** valor terminal (conservador, con aviso). Si se activa: **manual** o **múltiplo de EBITDA** (EBITDA del último año × múltiplo); se suma al flujo del último año y se descuenta a hoy (no duplica el último FCF). Muestra método, valor terminal futuro, valor presente e impacto en VAN.
- **Desplegables**: Desglose operativo (ingresos → costes var → costes fijos → EBITDA → impuestos → caja libre) · Valor de continuidad · Supuestos e horizonte. **Validaciones suaves**: sin ingresos/inversión → VAN/TIR no definitivos; sin tasa/horizonte → defaults + aviso; FCF≤0 → payback no definitivo; margen contribución≤0 → sin punto muerto; valor terminal activado sin dato → no se incluye + aviso.
- Migración `202606181000_explotacion_valor_terminal.sql` (aplicada al remoto): 4 columnas aditivas. Nuevos `lib/explotacionInsights.ts` y `tab-numeros/ExplotacionView.tsx`; `KpisExplotacionView` delega; `FormExplotacion` en bloques. **No toca renta ni compra-venta.**

#### `@alsari/presupuestos` — Vista ejecutiva de compra/reforma/venta (Fase 4.1) (2026-06-18)

Homogeneiza el análisis de compra/reforma/venta con el patrón ejecutivo de renta. **Sin renombrar KPIs existentes.**

- **Veredicto ejecutivo** (Atractivo/Defensivo/Agresivo/Revisar) según margen, beneficio neto, TIR vs tasa, VAN, plazo, apalancamiento y **sensibilidad a precio de venta pesimista** (−10%). **Calidad del dato** con campos propios de CV.
- **KPIs principales** reorganizados (nombres existentes): Coste total del proyecto · Precio de venta estimado · Beneficio antes de impuestos · Beneficio neto esperado · Margen sobre venta · TIR neta estimada · VAN · Plazo. **Escenarios resumidos** (Pesimista/Base/Optimista × precio venta, coste, beneficio, margen, VAN, TIR).
- **Desplegables:** Desglose del resultado · Financiación (solo si hay deuda) · Sensibilidad a precio de venta · Coste/m² (si hay superficie). **Validaciones suaves:** sin precio de venta o sin plazo → TIR/VAN no definitivos; €/m² oculto sin superficie.
- **Corrección de cálculo en `calcKpisCV` (imprescindible):** se separa el **coste económico** (para el margen, incluye todo) del **timing de caja** (para VAN/TIR). Antes los gastos de venta y la comisión se metían en la inversión del año 0; ahora van en el **flujo de salida** (se pagan con la venta), junto al impuesto de sociedades. La contingencia de obra ahora entra en el coste. La deuda se devuelve **una sola vez** a la venta (sin doble penalización), y el capital propio = costes iniciales − deuda.
  - Equity (año 0) = compra + gastos adq + obra + contingencia + IVA + coste financiero − deuda.
  - Flujo salida = venta − deuda − gastos venta − comisión − IS. **VAN** = flujo salida/(1+tasa)^años − equity. **TIR** = (flujo salida/equity)^(1/años) − 1.
- Nuevos `lib/cvInsights.ts` y `tab-numeros/CompraVentaView.tsx`; `KpisCV` delega; `FormCV` reorganizado en bloques (Compra · Reforma/CAPEX · Venta · Financiación · Fiscalidad · Horizonte y salida · Supuestos avanzados); `escenariosProyectoApi` añade `beneficioNeto`/`precioVenta` al resultado CV. **Renta no se toca.**

#### `@alsari/presupuestos` — Andamiaje compartido del patrón ejecutivo (Fase 4.0, refactor) (2026-06-18)

- **Refactor sin cambio funcional** (preparación para homogeneizar el patrón ejecutivo al resto de tipos). Renta queda **visual y numéricamente idéntica**.
- Nuevo `lib/insights.ts`: tipos comunes del veredicto (`VeredictoTipo`, `Veredicto`) y framework de **calidad del dato** (`DefCampo`, `evaluarCalidad`, `CalidadDato`) — cada tipo define sus campos requeridos y el framework calcula score/nivel/desglose.
- Nuevo `tab-numeros/ejecutivo.tsx`: bloques de UI reutilizables `VeredictoBlock`, `CalidadBlock` (recibe `CalidadDato`) y `EscenariosResumenTabla` (recibe la config de filas por tipo).
- `RentaView.tsx` y `rentaInsights.ts` pasan a usar lo compartido (−219 líneas netas); sin tocar cálculos, UX visible, nombres de KPIs, rutas, unidades ni Prettier.

#### `@alsari/presupuestos` — Valor residual de renta con revalorización explícita (2026-06-18)

- **Corrección:** el método "Valor actual estimado" tomaba el valor de mercado de hoy como valor residual del año final sin revalorizarlo. Ahora el valor actual es el valor **hoy** y se proyecta al horizonte con una **revalorización anual estimada** (campo nuevo en el formulario, reutiliza `tasa_crecimiento_anual_pct`). **Vacío = 0%** (supuesto conservador: mantiene el valor de hoy — el resultado numérico no cambia para proyectos existentes).
- `valorResidualFuturo = valorActual × (1 + revalorización)^horizonte`; el VAN/TIR lo descuenta a hoy: `valorPresente = valorResidualFuturo / (1 + tasa)^horizonte`. Manual = valor del año final introducido directamente (no se revaloriza, solo se descuenta). Cap rate = NOI / cap rate de salida (valor futuro), luego se descuenta.
- Se consolidan los métodos a 3 (Valor actual + revalorización · Cap rate · Manual); "crecimiento anual" se pliega dentro de "valor actual" y se mantiene compatibilidad con datos antiguos (`crecimiento_anual` sigue calculándose). El método manual aclara que es el valor del año final.
- **UI nueva** (bloque desplegable "Valor residual"): valor actual estimado, revalorización usada, valor residual futuro, valor presente del residual, y aviso cuando se usa 0% como supuesto conservador. `calcKpisRentaExtended` expone `valorResidualPresente`, `revalorizacionResidualPct` y `revalorizacionPorDefecto`. Sin migración (campo reutilizado).

#### `@alsari/presupuestos` — Corrección TIR/VAN: capital aportado vs flujos completos (2026-06-18)

- **Bug corregido:** la TIR y el VAN (renta y compra-venta) usaban como inversión inicial solo `inversión total × % equity` (p. ej. el 50%), pero mantenían el **100% de la renta/caja y del valor residual sin coste de deuda** — eso inflaba la TIR (un activo con TIR económica ~4,9% mostraba 14,3%) y desalineaba la vista principal con el simulador de financiación.
- Ahora el **capital propio aportado = coste total − deuda real** (deuda hipotecaria en renta, deuda promotora en compra-venta), no un % de la inversión. Sin deuda → equity = coste total → **TIR económica del activo**. Con deuda, los flujos van netos de cuota y la salida neta de la **deuda pendiente** → **TIR sobre equity apalancada**. No se mezcla capital parcial con flujos completos. Afecta a `calcKpisRentaExtended`, `calcKpisRenta` y `calcKpisCV`.
- El campo "% que financia Alsari" deja de gobernar el cálculo (era la causa de la confusión); el formulario muestra ahora "Capital propio aportado = coste − deuda" derivado de la deuda introducida. La nomenclatura visible de los KPIs no cambia.

#### `@alsari/presupuestos` — Vista ejecutiva del análisis de renta (Fase 1) (2026-06-18)

Reorganización del análisis financiero de proyectos en renta para una lectura ejecutiva (primero veredicto y KPIs clave; el detalle, en bloques desplegables). **No se renombró ningún KPI existente.**

- **Veredicto ejecutivo** automático (Atractivo / Defensivo / Agresivo / Revisar) con motivo en lenguaje simple y 3-5 razones, según TIR vs tasa, VAN, cash flow, DSCR, LTV y datos faltantes. Es ayuda interna, no recomendación.
- **Calidad del dato** (Alta/Media/Baja + %) según campos completados, con desglose desplegable de datos completos / estimados / faltantes y aviso de faltantes críticos.
- **VAN** nuevo para renta, conviviendo con la TIR: descuenta los flujos de caja anuales + valor residual − deuda a salida a la tasa exigida, menos el equity. Muestra tasa usada y diferencial TIR − tasa.
- **Desglose del flujo anual** (cascada): renta bruta → ocupación → renta efectiva → gastos (operativos, IBI, seguro, CAPEX) → NOI → servicio de deuda → caja antes de impuestos → impuestos → caja neta.
- **Financiación mejorada**: tipo de interés, plazo restante y sistema de amortización (francés / bullet / manual). Estima intereses, amortización y **deuda viva a la salida**; DSCR y LTV solo si hay deuda; fallback conservador con aviso si faltan datos.
- **Fiscalidad opcional** (cerrada por defecto): IS, amortización fiscal, costes de venta y plusvalía. Si está inactiva, el análisis es antes de impuestos y se marca como dato no aplicado.
- **Escenarios resumidos** compactos en pantalla (Pesimista / Base / Optimista × Renta anual, NOI, Cash flow, VAN, TIR, Valor residual).
- **Bloque de mercado** (€/m²): precio, valor y renta por m², rentabilidad sobre valor actual, prima/descuento y plusvalía latente. Oculto si falta superficie.
- **Formulario reorganizado** en bloques: Básico · Gastos y ocupación · Financiación · Horizonte y salida · Fiscalidad avanzada (desplegable) · Supuestos avanzados (desplegable).
- **Validaciones suaves**: sin renta mensual no se calculan rentabilidades; sin valor residual/horizonte la TIR/VAN no son definitivas; LTV sin DSCR si falta cuota; €/m² oculto sin superficie.
- Migración `202606180900_renta_financiacion_fiscalidad.sql` (aplicada al remoto): 7 columnas aditivas. `upsertAnalisisFinanciero` ahora es resiliente: si una columna no existe aún, la omite y reintenta. Confirmado que "Rentabilidad bruta sobre coste" usa la inversión total (precio + gastos + capex), coherente con su nombre.
- Pendiente (fases siguientes del sprint): desglose por unidades/viviendas (#10, requiere modelo de datos nuevo), auditoría de centralización Supabase (#14) y naming interno Proyectos/Presupuestos (#15).

#### `@alsari/presupuestos` — Simulador de financiación por proyecto (2026-06-17)

- Nueva sub-sección **"Financiación"** dentro de la pestaña Números, junto a Escenarios. Para proyectos **no financiados** genera **3 niveles de apalancamiento** (Conservadora 50%, Moderada 60%, Agresiva 70% de deuda) y los compara contra la base **"Sin financiación"**, para responder a "¿merece la pena financiar?".
- **Veredicto basado en DSCR** (no en comparar yield vs tipo de interés, que pasa a dato secundario). Prioriza: DSCR → cash flow después de deuda → rentabilidad sobre capital propio → TIR financiada vs sin deuda → VAN. Reglas: con DSCR < 1 nunca sale "apalancamiento positivo"; DSCR 1-1,15 = "financiación muy ajustada"; "positivo" exige DSCR ≥ 1,25 y mejora de TIR; si libera capital pero empeora caja/TIR, lo dice claramente. Texto honesto cuando la renta no cubre cómodamente la cuota, y marca **riesgo alto** (DSCR < 1) aunque la TIR salga positiva.
- Por opción muestra: deuda, capital propio necesario, **capital liberado**, cuota mensual, **cash flow anual**, DSCR (renta) o coste financiero y MOIC (compra-venta), rentabilidad sobre capital propio, TIR y **VAN** apalancados. Las **medallas ±pp comparan siempre la misma métrica** (TIR financiada vs TIR sin deuda); en rojo si es negativa.
- **TIR/VAN financiados con flujos coherentes (sin doble penalización de la deuda)**: año 0 = −capital propio; años = NOI − cuota; salida = valor residual − **deuda pendiente ya amortizada** (no la deuda inicial). Base y opciones usan el mismo modelo para que TIR↔TIR y VAN↔VAN sean comparables.
- **Supuestos editables** (tipo de interés y plazo) con valores por defecto sensatos. Compra-venta: préstamo promotor tipo bullet (intereses acumulados, principal a la venta). Cálculo en cliente, no se persiste (es exploratorio). Nuevo `simulacionFinanciacion.ts` + componente `Financiacion.tsx`.

#### `@alsari/presupuestos` — Documentos justificativos por proyecto (2026-06-17)

- Nueva pestaña **"Documentos"** en cada proyecto para adjuntar los archivos con los que se calcularon datos (estudios de mercado, tasaciones oficiales, escrituras), con categoría y una nota de qué dato justifican — para que más adelante se pueda trazar de dónde salió cada cifra (valor actual, renta…).
- Subida de archivos a un bucket de Storage **`proyecto-documentos`** (vía REST desde el cliente, mismo patrón de bucket público + RLS que `facturas`), con listado, descarga y borrado con confirmación.
- Migración `202606171400_proyecto_documentos.sql` (aplicada al remoto): tabla `proyecto_documentos` (FK a `proyectos` con `on delete cascade`, RLS activado) + bucket + políticas de Storage. API en `documentosApi.ts`. Verificado el ciclo completo subida → URL pública → borrado.
- Nota: al eliminar un proyecto se borran las filas de documentos (cascada) pero los binarios quedan en Storage (huérfanos, inofensivos); limpieza pendiente como mejora.

#### `@alsari/presupuestos` — Tasa de descuento como desplegable por tipo de inversión (2026-06-17)

- El campo de tasa de descuento (antes un número a pelo) pasa a ser un **desplegable con tipos de inversión y su tasa orientativa** (liquidez 4%, renta fija 5%, vivienda prime 7%, vivienda normal 8%, local/nave 9%, proyecto con obra 12%, promoción/suelo 18%, startup 25%) más una opción **"Personalizado…"** que abre un campo % para cualquier valor.
- Nuevo componente reutilizable `TasaDescuentoInput`, aplicado en los 5 análisis que usan tasa de descuento (compra-venta, renta, explotación, préstamo, alternativo). Si el valor guardado no coincide con ningún preset, se muestra como personalizado automáticamente.

#### `@alsari/presupuestos` — "Rentabilidad bruta sobre coste" usa el coste inicial total (2026-06-17)

- La rentabilidad bruta sobre coste (yield bruto) de los análisis de renta dividía la renta anual bruta entre **solo el precio de adquisición**, pese a la etiqueta "sobre coste". Ahora divide entre la **inversión total** (precio + gastos de adquisición + capex inicial), la misma base que la rentabilidad neta sobre coste — así ambas son comparables. Corregido en `calcKpisRentaExtended` y `calcKpisRenta`.
- Subtítulo y tooltip de la tarjeta actualizados ("Renta anual bruta / inversión total").

#### `@alsari/financiero` — Soporte de sumas y saldos formato Navision/Dynamics NAV (2026-06-16)

- El importador de sumas y saldos no leía el export de **Microsoft Dynamics NAV** (Rialsa): usa celdas combinadas que descolocan las columnas respecto a los rótulos (el código de cuenta cae en la columna 0 aunque la etiqueta "Cuenta" esté en otra, y el desfase difiere por columna), así que el parser no encontraba ni una línea.
- Nuevo **parser de respaldo anclado a datos** (`extractAnchoredLines`) que se activa solo cuando el parser principal no saca nada: detecta la columna de cuenta por los códigos y la de saldo como la única columna numérica que cuadra a cero con signos mixtos (un balance suma deudor = acreedor). Saldo con signo: positivo = deudor, negativo = acreedor.
- Verificado contra el archivo real de Rialsa: 121 cuentas, caja 5,64 M, deuda bancaria 55,6 k, PN ~7 M. Al subirlo, además, sustituye el valor heredado negativo de deuda de socios (−109 k del Excel antiguo) por el correcto.
- No altera los formatos que ya funcionaban (Sage/A3/ContaPlus): el respaldo solo corre si el parser principal devuelve 0 líneas.

#### `@alsari/financiero` — Fix: "deuda de socios" no contaba la deuda a largo plazo (2026-06-15)

- El KPI **deuda de socios** sumaba solo cuentas a corto plazo (550-553) **+ la 555** (partidas pendientes de aplicación, que no es deuda de socios y metía ruido). Faltaba el grueso, que está a largo plazo: subgrupo **16** (partes vinculadas) y **171** (préstamos de socios — p.ej. la 1710 de Perisur: Iván, Javier y Construcciones Maygar). En Perisur daba 31 € cuando son **1.708.934,60 €**.
- `deriveKpis` corregida: `deuda_socios = 550-553 + grupo 16 + 171`, sin la 555. Afecta a todas las vistas en vivo (histórico, selector de período).
- Migración `202606151600_recalcular_deuda_socios.sql` (aplicada al remoto): recalcula el caché `kpis_sociedades.deuda_socios` desde el último balance de cada sociedad, para que también se corrijan las tarjetas y la ficha. Idempotente.

#### `@alsari/financiero` — Balances importados agrupados por sociedad (2026-06-15)

- El "Historial importado" de Datos Maestros → Contabilidad pasa de lista plana (todas las sociedades mezcladas, ordenadas por fecha) a **agrupado por sociedad**: cada sociedad es una tarjeta con su recuento de balances y sus períodos ("Inicial" primero con su chip "Partida", luego meses de más reciente a más antiguo).
- El borrado de un balance ahora **pide confirmación inline** ("¿Borrar? · Sí, borrar / Cancelar") en vez de eliminar al primer clic.

#### `@alsari/financiero` — Balance "Inicial" por sociedad (2026-06-15)

- El balance de sumas y saldos más antiguo de cada sociedad se etiqueta como **"Inicial"** (balance de partida tomado de un sumas y saldos antiguo); los posteriores se nombran por su mes/año. Migración `202606151200_balance_inicial.sql`: el `periodo` mínimo de cada sociedad pasa a la fecha sentinela `1900-01-01` (aplicada al remoto). Idempotente.
- `fmtPeriodo`/`fmtPeriodoCorto` centralizadas en `sumasSaldosImport.ts` (antes 4 copias divergentes, una de ellas sin capitalizar): devuelven "Inicial" para la sentinela. La sentinela ordena primero, así que "Inicial" siempre aparece como primer punto del histórico y del selector de período.
- Resultado: Pavier/Armia/Capellanía tienen solo "Inicial"; Alsari/Perisur tienen "Inicial" (marzo) + "Mayo 2026"; Le Toit "Inicial" (abril) + "Mayo 2026". Las subidas futuras (selector de mes) se nombran por su mes automáticamente.

#### `@alsari/presupuestos` — Eliminar proyecto (2026-06-15)

- Nuevo botón **Eliminar** en la ficha de proyecto (módulo Proyectos), con modal de confirmación informada: muestra cuántos presupuestos, objetivos y tareas se borrarán y avisa de las facturas que se conservarán pero perderán el vínculo. Requiere escribir el nombre del proyecto para confirmar (acción irreversible).
- Borrado limpio en `deleteProyectoCompleto`: elimina primero los presupuestos del proyecto (su FK es `SET NULL`, no cascada — sin esto quedarían huérfanos; al borrarlos cascadean capítulos/partidas/pagos y las facturas se desvinculan solas) y después el proyecto (cascada a objetivos, KRs, tareas, escenarios, análisis financiero y flujos de caja). Antes la función `deleteProyecto` existía en el API pero no estaba conectada a ninguna UI en este módulo.

#### `@alsari/facturas` — Detección de facturas duplicadas (2026-06-12)

- Detector con dos criterios (de fuerte a débil): mismo proveedor + mismo nº de factura, o mismo proveedor + misma fecha + mismo importe. El proveedor se compara por NIF cuando existe; el nº de factura se normaliza (mayúsculas, sin espacios/guiones). Las rechazadas no cuentan — rechazar un duplicado lo resuelve.
- Cuatro superficies de aviso: banner global con el recuento, badge "Duplicada" en la fila (rose si la otra ya está imputada, amber si no), panel comparativo en el detalle con click para saltar a la otra factura, y aviso en el modal de imputación — el punto crítico para no contar el gasto dos veces.
- Al estrenar la detección ya hay 2 duplicados reales en producción (La Vega de Mijas C26VEG0099, Alwazgary 26002317).

#### `@alsari/presupuestos` — Gasto real (facturas) vs presupuesto en proyectos (2026-06-12)

- El detalle de presupuesto compara ahora tres magnitudes en vez de dos: **Presupuestado** (estimación previa), **Gasto real** (la base imponible de las facturas vinculadas + pagos confirmados sin factura) y **Pagado** (salida de caja). Antes el importe real de la factura nunca entraba en la comparación — se comparaba contra el importe previsto del pago.
- Desviación (real − presupuestado) con color semántico en los tres niveles: resumen global (4 tarjetas con barra de ejecución), cabecera de cada capítulo (chip ±) y cada partida.
- Comparación en **base imponible** (el IVA es recuperable, no es coste del proyecto); si una factura no tiene base desglosada, se usa su total como aproximación.
- El flujo ya existente no cambia: crear presupuesto de gastos por proyecto (capítulos/partidas) → vincular facturas a pagos según llegan → la comparación se actualiza sola.

#### `@alsari/financiero` — Histórico de KPIs por sociedad (2026-06-12)

- Nueva sección **"Histórico de KPIs"** en la ficha de cada sociedad: navegador de períodos (selector + flechas), grid de 8 KPIs con variación absoluta y porcentual vs período anterior (color semántico: emerald mejora / rose deterioro según la naturaleza del KPI), y gráfico de evolución temporal con métrica seleccionable (caja, deuda financiera neta, patrimonio neto, fondo de maniobra, activo total).
- Los KPIs de cada período se derivan **al vuelo** desde las líneas guardadas en `balance_sumas_saldos` con la misma lógica del import (`deriveKpis`, ahora exportada): sin tablas nuevas, sin migración, y **retroactivo** — funciona con los balances ya subidos.
- Flujo de uso: subir un sumas y saldos mensual por sociedad (Datos Maestros) → el histórico crece solo.
- **Ficha de gestión accesible desde Entidades**: cada tarjeta de sociedad tiene ahora un botón lápiz que abre la ficha completa in-situ (datos básicos, KPIs, histórico, balances) sin pasar por Datos Maestros. El click en la tarjeta sigue llevando a la visión general como antes. `SociedadDetail` acepta `backLabel` para contextualizar el botón de volver.
- **Selector de período en la vista de entidad (Balance Contable)**: al entrar en una sociedad, un selector `← Mes →` permite viajar en el tiempo: los 5 KPI cards —incluido el consolidado con participadas ponderadas por su % efectivo— se recalculan desde los balances de sumas y saldos del período elegido. Por defecto se muestra el último período (el más reciente); si alguna participada no tiene balance de ese mes, aviso ámbar con la lista (sus importes constan a 0).

#### Estructura societaria real: Perisur directa, duplicado Andalvia y marco "Alsari Capital" (2026-06-12)

**Datos — migración `202606121000_estructura_societaria_real.sql` (aplicada al remoto):**

- **Perisur** colgaba de Alsari Inversiones como filial al 50%; en realidad es participada **directa** de Pavier (25%) y Armia (25%), al mismo nivel que Rialsa y Alsari. Eliminado el `parent_sociedad_id` erróneo — el mapa la pintaba (junto a Capellanía y UTE Lagunas Park) en la rama equivocada.
- Eliminada la fila duplicada **"Transporte" (S-006-2)**: era el nombre antiguo de Andalvia (S-002-2). Sin datos asociados (KPIs todo NULL); se conserva Andalvia.
- Consistencia look-through: Alrive y Andalvia pasan de 0/0 a `pct_pavier`/`pct_armia` 0.20/0.20 (vía Rialsa), igual que Capellanía/UTE llevan su 12,5%. No altera la consolidación (los hijos directos se detectan por `parent_sociedad_id IS NULL`).

**`@alsari/financiero` — CorporateMap:**

- Nuevo marco punteado **"Alsari Capital · denominación comercial"** agrupando Pavier y Armia: documenta en el propio mapa que la marca comercial no es una sociedad constituida.

**Eliminado — vía de carga Excel del maestro:**

- `syncFromExcel` y `parseMaestroDB` eran código muerto (sin llamadas desde la UI) y un riesgo latente: el Excel maestro fue solo el vehículo de carga inicial y quedó anticuado — un reimport accidental habría machacado los datos buenos de Supabase con la estructura antigua. `maestroParser.ts` queda como archivo de tipos; el CRUD desde la app es la única vía de edición de datos maestros.

#### Refresh estético "Quiet Luxury": tokens unificados, rebalanceo tipográfico y componentes UI (2026-06-12)

**Tokens — preset Tailwind compartido (`@alsari/config/tailwind-preset`):**

- Nueva fuente única de verdad para la paleta (zinc custom con tinte navy + token `brand` `#F5F0E1`), animaciones (`fade-in`, `fade-up`, `pulse-subtle`, `shimmer`), fuentes y escala. Los 5 tailwind.config (host + 4 módulos) consumen el preset; eliminadas 5 copias divergentes de la paleta.
- `.glass-panel`/`.glass-header` unificados: el host tenía una definición distinta (`zinc-800/40`, `white/[0.08]`) que competía con la de los módulos según el orden de carga del CSS. Body del host corregido de `zinc-900` a `zinc-950`.
- Scrollbars unificados a tokens de la paleta (3 variantes antes, 1 ahora).

**Tipografía — el cambio más visible:**

- Fuente **Geist Sans + Geist Mono** vía `next/font` (antes: fuente del sistema sin definir). `tabular-nums` global — todas las cifras alinean en columna.
- Rebalanceo completo de pesos: la app tenía 467 `font-black` y 366 `font-bold` frente a 1 `font-light`. Ahora: cifras hero (`text-3xl+`) en `font-light tracking-tight`, `font-black`→`font-semibold`, `font-bold`→`font-medium`. El máximo del sistema es `semibold`.
- Eliminados los 604 tamaños arbitrarios (`text-[8px]`…`text-[13px]`): nuevo token `text-2xs` (10px) como mínimo absoluto de la escala.

**Color semántico:**

- `red`→`rose` en los 4 módulos (208 usos): un solo tono para negativo/error. `violet` documentado como "previsto/simulado". Hex de marca sustituido por token `brand` en LoginForm.

**Componentes — `@alsari/ui` pasa de 1 a 6 componentes:**

- Nuevos: `Button` (primario claro estilo spec, secondary, ghost, danger), `Modal` (backdrop `bg-black/60` + z-50 canónicos, cierre con Escape), `EmptyState`, `Skeleton`/`SkeletonCard` (shimmer), `Badge` (semántica de color del OS).
- `KPICard` realineado al spec: `rounded-2xl` (antes `rounded-[2rem]`), valor en `font-light`, labels `text-2xs font-medium`, transiciones 200ms sin `hover:scale`.
- Iconos Lucide con trazo 1.5 global (`.lucide { stroke-width: 1.5 }`).
- Backdrops de modal existentes normalizados a `bg-black/60` (había 5 opacidades).

**Documentación:**

- `ui-quiet-luxury/SKILL.md` actualizado con los valores reales de la paleta (era documentación aspiracional: describía zinc puro de Tailwind cuando la app usa la paleta navy custom), la escala con `text-2xs`, los pesos máximos, y 4 anti-patrones nuevos.

#### Auditoría técnica: RLS en producción, cliente Supabase centralizado y type-check reparado (2026-06-11)

**Seguridad — RLS (2 migraciones nuevas, aplicadas al remoto):**

- `20260611131000_rls_alsari_knowledge.sql`: la tabla `alsari_knowledge` (documentos confidenciales del sistema de conocimiento Python) estaba **sin RLS en producción** — cualquier petición con la anon key pública podía leer su contenido completo. RLS activado sin política para `anon`; el pipeline Python no se ve afectado porque usa `service_role` (bypasea RLS).
- `20260611130000_rls_proyecto_escenarios_financieros.sql`: la migración de escenarios creó la tabla sin RLS. Activado con la política permisiva estándar del proyecto.
- Verificado contra el remoto: **0 tablas sin RLS** en el schema `public`.

**Producción — 5 migraciones de mayo/junio que nunca se aplicaron al remoto:**

- `20260531000001` (presupuesto maestro), `20260531000002` (tabla de escenarios + vista `metricas_proyecto_resumen` v2), `20260531000003` (horizonte renta), `20260531000004` (plazo total CV) y `20260601000000` (impuesto de sociedades CV) existían en el repo pero no en la BD. Las funcionalidades de presupuesto maestro y escenarios financieros estaban **rotas en producción** (error 42703/42P01 al usarlas). Aplicadas todas con `supabase db query --linked --file`.

**Refactor — `@alsari/supabase-client` implementado de verdad:**

- El paquete existía vacío (solo `.gitkeep`) aunque la documentación afirmaba que centralizaba el acceso a Supabase. Ahora exporta `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `getJwt()` (bridge `window.alsariToken` → `localStorage` → anon), `sbUrl()` y `sbHeaders()`.
- Eliminadas **15 copias** de la URL, la anon key y `getJwt()` repartidas en financiero (8 archivos), contabilidad, facturas y presupuestos (5). Todos los módulos importan ahora del paquete. Rotar la anon key pasa de tocar 16 archivos a tocar 1.
- Los importadores de financiero (`patrimonioImport`, `maestroImport`, `sumasSaldosImport`) firmaban siempre con la anon key; ahora usan `getJwt()` como el resto (usan el token de sesión cuando existe).

**Tooling:**

- `pnpm type-check` reparado: el paquete `supabase-client` no tenía `tsconfig.json` propio y `tsc` subía hasta el raíz, compilando la carpeta legacy `IGNORE/` (~70 errores ajenos al monorepo). Añadido tsconfig propio + `IGNORE` excluido del tsconfig raíz.
- `turbo.json`: `type-check` ya no depende de `^build` — verificar tipos no requiere compilar los módulos Vite (de ~22 s a ~9 s).
- `.gitignore`: añadido `.claude/worktrees/`.
- `apps/modules/contabilidad/Facturas.tsx`: eliminado import dinámico de `contabilidadApi` que convivía con 11 imports estáticos (warning de Vite, chunk inútil).
- `apps/modules/financiero/CLAUDE.md`: schema de `vencimientos` actualizado (`'prestamo'`) y referencia al cliente centralizado.

#### `@alsari/financiero` — Rediseno mapa corporativo: bus compartido + alineacion correcta de holdings (2026-06-11)

**UI — `apps/modules/financiero/src/components/CorporateMap.tsx`:**

- Rediseno completo de `buildLayout()` (commits `deb526b`, `0e07721`, `fd3657f`). La funcion ahora calcula los niveles en orden: L2 primero (filiales directas), L1 a continuacion (holdings anclados a los extremos de L2), L0 al final (personas fisicas alineadas con su holding).
- Nueva funcion `isPersona(idRef)`: detecta personas fisicas por ID-Ref numerico (`"1"` = Javier, `"2"` = Ivan). Garantiza que no aparezcan mezcladas con filiales societarias en el mismo nivel.
- Personas fisicas pasan a **Level 0** (encima de todo), holdings a **Level 1**, filiales directas a **Level 2**. El orden visual es JAVIER->PAVIER (izquierda) | IVAN->ARMIA (derecha) -> bus -> PERISUR · RIALSA · ALSARI.
- Orden de nodos L2 `[solo-Pavier | compartidas | solo-Armia]` elimina cruces de lineas en el diagrama.
- Nuevo componente `SharedBusEdges`: varios padres (Pavier + Armia) convergen en un unico bus horizontal antes de bifurcarse a los hijos compartidos. `BusEdgeGroup` queda reservado para filiales exclusivas de un solo holding.
- Fix de alineacion (`fd3657f`): `pavierX = min(x de todos los hijos L2 de Pavier)` y `armiaX = max(x de todos los hijos L2 de Armia)`. Antes se usaba `centerX(0,2)` y `centerX(1,2)` (x=510 y x=930), que no coincidian con los extremos del bus cuando habia 3 nodos L2 (x=405, x=720, x=1035), produciendo tallos descentrados.
- Porcentaje de participacion visible dentro del nodo de cada filial; ID-Ref ya no aparece visible.

**Modelo de datos — `services/supabase/migrations/20260611090000_activos_patrimonio_campos_fondo.sql`:**

- `ALTER TABLE activos_patrimonio ADD COLUMN fecha_inicio_inversion DATE` y `ADD COLUMN tae_declarada NUMERIC(6,3)`. Resuelve error PGRST204 que ocurria al insertar activos con campos de fondo de inversion o activo cotizado cuando esas columnas no existian en la tabla remota.

#### `@alsari/financiero` — Fix HTTP 400 al guardar vencimientos con tipo prestamo (2026-06-10)

**Causa raíz — migración no aplicada:**

- La migración `20260610090000_vencimientos_tipo_prestamo.sql` existía en el repo pero no estaba ejecutada en el Supabase remoto. El CHECK constraint de la columna `tipo` en `vencimientos` no incluía `'prestamo'`, por lo que cualquier INSERT o PATCH con `tipo = 'prestamo'` devolvía HTTP 400 con código `23514` (check violation).
- Aplicada directamente con `supabase db query --linked`. El directorio `supabase/migrations/` (CLI) sigue vacío por diseño — las migraciones reales están en `services/supabase/migrations/` y se gestionan manualmente.

**Bugs corregidos en frontend — `apps/modules/financiero/src/components/views/VencimientosView.tsx`:**

- `formIsValid()`: añadida validación `socPcts.some(s => !s.sociedad_id)`. Sin este check, una fila con `sociedad_id: ''` (string vacío) pasaba la validación y llegaba al INSERT, causando FK violation (código `23503`) en `vencimiento_sociedades`.
- `handleSave()`: cambiado `primaria?.sociedad_id ?? null` por `primaria?.sociedad_id || null`. El operador `??` solo hace fallback con `null`/`undefined`; un string vacío `''` se propagaba como valor de FK. Con `||`, los strings vacíos también se convierten en `null`.

**Mejora de observabilidad — `apps/modules/financiero/src/lib/vencimientosImport.ts`:**

- `req()`: el mensaje de error ahora incluye el body completo de la respuesta HTTP (`HTTP 400 — {"code":"23514","message":"...","details":"..."}`). Antes solo mostraba el código de estado, lo que ocultaba la causa exacta del error.
- `setVencimientoSociedades()`: añadido `rows.filter(r => r.sociedad_id)` antes del DELETE+INSERT. Filtra rows con `sociedad_id` vacío antes de que lleguen a Supabase, añadiendo una segunda línea de defensa además de `formIsValid()`.

#### Cashflow multi-sociedad + Presupuesto de Ingresos + Recurrencia (2026-06-05)

**Modelo de datos — 5 migraciones aplicadas:**

- `20260604090000`: elimina columna duplicada `sociedad_id_ref` en `vencimientos`, añade `recurrencia` / `fecha_inicio_recurrencia` / `fecha_fin_recurrencia` a `presupuesto_partidas`, crea índice en `presupuestos.sociedad_id_ref`.
- `20260605000000`: nueva tabla `vencimiento_sociedades` (`vencimiento_id`, `sociedad_id`, `porcentaje NUMERIC(5,2)`) con RLS, ON DELETE CASCADE e índices. Permite asignar un vencimiento a N sociedades con distribución porcentual que debe sumar 100.
- `20260605000001`: datos de distribución de todos los vencimientos existentes según el Excel "Calendario de Pagos — Alsari.xlsx". Correcciones: Perisur 5 contratos → Javier 50% / Iván 50%; Fondos Pignorados → Javier 50% / Iván 50%; Earn-out Evariste → ambos tramos a Javier 100%; Precio Aplazado Álvaro → Javier 100% (corregido desde S-002 Rialsa que era incorrecto).
- `20260605000002`: vista `cashflow_consolidado` que unifica `flujos_proyecto_consolidados` + vencimientos distribuidos por sociedad. Un vencimiento compartido al 50% aparece una vez por sociedad con el importe escalado al porcentaje.
- `20260605000003`: vista `flujos_proyecto_consolidados` reconstruida — `COALESCE(presupuestos.sociedad_id_ref, proyectos.sociedad_tenedora)` para heredar sociedad del proyecto; `es_previsto` ampliado a estados `estimado/confirmado/facturado`; excluye filas con `fecha NULL` (estado `sin_fecha`) del timeline.
- `20260605000004`: columna `categoria TEXT ('gasto'|'ingreso')` en `presupuestos` (default `gasto`); columna `factura_emitida_id UUID` en `presupuesto_pagos` (FK a `facturas_emitidas`, nullable); columnas de recurrencia en `presupuesto_partidas` (idempotente con `IF NOT EXISTS`).

**API — `cashflowHoldingApi.ts`:**

- Nueva función `getSociedadesCashflow()`: devuelve lista de sociedades disponibles para el selector.
- `getFlujosHolding()` acepta ahora `sociedadIds: string[]` (array, multi-sociedad) y `desde`/`hasta` (rango de fechas). Sin parámetros = consolidado + sin límite temporal.
- Tipo `SociedadOpcion` añadido.

**API — `vencimientosImport.ts`:**

- Nuevas funciones `getVencimientoSociedades(vencimientoId)` y `setVencimientoSociedades(vencimientoId, rows)`.
- Tipo `VencimientoSociedad` exportado.

**API — `presupuestosApi.ts`:**

- `createPartida()` genera automáticamente los pagos recurrentes si se especifica `recurrencia` + `fecha_inicio_recurrencia` + `fecha_fin_recurrencia`. El importe total se divide a partes iguales entre los periodos generados. La descripción de cada pago incluye el mes/año (ej. "Alquiler oficina (jun. 2026)").
- `createPresupuesto()` acepta ahora `categoria?: PresupuestoCategoria`.
- Función auxiliar `generarFechasRecurrentes()` (privada) calcula las fechas de cada periodo.

**UI — `CashflowView.tsx` (reescritura dirigida):**

- Selector multi-sociedad: dropdown con checkboxes (cierre automático al clicar fuera con `useRef`). "Todas las sociedades" = sin filtro. Se sincroniza con el selector global del OS al montar y cuando cambia.
- Selector horizonte temporal: tabs 3m / 6m / 12m / Todo. La query se relanza al cambiar horizonte o selección de sociedades.
- Meses agrupados en orden cronológico (pasado → futuro). Meses pasados: fondo zinc. Meses futuros: borde y fondo azul tenue con badge "Previsto".
- Saldo acumulado mes a mes: cada cabecera de mes muestra el neto del mes y el saldo acumulado desde el inicio del horizonte.
- KPIs divididos en dos filas: **Reales** (Entradas cobradas · Salidas pagadas · Neto real) y **Previstos** (Por cobrar · Por pagar · Saldo neto total = real + previsto).
- Fuente `vencimiento` añadida con color teal en badges de tipo.
- Nombre de sociedad resuelto en las filas de detalle (antes mostraba el `id_ref` crudo).

**UI — `VencimientosView.tsx`:**

- Formulario de nuevo/editar vencimiento reemplaza el selector único de sociedad por checkboxes multi-sociedad con campo de porcentaje por sociedad. Validación en tiempo real: los porcentajes deben sumar 100 para habilitar el botón Guardar.
- `socMap: Map<vencimientoId, VencimientoSociedad[]>` cargado al montar: muestra las sociedades asignadas en la vista calendario y en la vista lista, con porcentaje si hay más de una.
- Lápiz de edición abre el formulario inmediatamente (antes esperaba un fetch adicional que podía fallar).
- Estado `editingId` para distinguir crear vs editar.

**UI — `TabPresupuesto.tsx`:**

- Nueva prop `categoria: PresupuestoCategoria`. Filtra los presupuestos del proyecto por `categoria`. Genera nombre, tipo e icono adaptativos (Wallet para gastos, TrendingDown para ingresos).

**UI — `DetalleProyecto.tsx` y `ProyectosSidebar.tsx`:**

- Tab única `presupuesto` dividida en `presupuesto-gasto` y `presupuesto-ingreso`. Cada tab renderiza `TabPresupuesto` con la `categoria` correspondiente.

**UI — `DetallePresupuesto.tsx`:**

- Formulario de nueva partida ampliado con sección "Pago recurrente": selector mensual/trimestral/semestral/anual y campos de primer/último pago. Aparece solo si se activa la recurrencia.
- Preview en tiempo real: muestra "Se generarán N pagos de X€" calculado en cliente antes de guardar.
- Botón Guardar deshabilitado si hay recurrencia pero faltan fechas.

**Tipos — `packages/types/src/presupuestos.ts`:**

- `PresupuestoCategoria = 'gasto' | 'ingreso'`.
- `RecurrenciaPartida = 'mensual' | 'trimestral' | 'semestral' | 'anual'`.
- `Presupuesto.categoria: PresupuestoCategoria` añadido.
- `PresupuestoPago.factura_emitida_id: string | null` añadido.

#### Tesorería multi-sociedad: corrección de bugs + selector múltiple + horizonte temporal (2026-06-05)

**Bugs corregidos en la vista `compromisos_tesoreria`:**

- Bug 1: La rama de vencimientos referenciaba la columna `sociedad_id_ref`, que no existe — la columna real de la tabla es `sociedad_id` (la vista fallaba silenciosamente y no mostraba ningún vencimiento en tesorería).
- Bug 2: Los pagos de presupuestos vinculados a un proyecto heredaban `sociedad_id_ref = NULL` del presupuesto aunque el proyecto sí tenía sociedad. Ahora se hace `COALESCE(presupuestos.sociedad_id_ref, proyectos.sociedad_tenedora)` vía `LEFT JOIN`. La sociedad se deriva automáticamente del proyecto sin pedírsela al usuario.
- Bug 3: Los vencimientos con `es_entrada = true` siempre se negaban en importe, tratándolos como salidas. Ahora se respeta la dirección: entradas suman positivo, salidas suman negativo.
- Bug 4: El filtro `fecha >= CURRENT_DATE` en la rama de vencimientos ocultaba los vencidos pendientes. Se elimina para que puedan aparecer como alerta en la UI.

**Modelo de datos — nueva migración `20260604120000_tesoreria_multi_sociedad.sql`:**

- `CREATE OR REPLACE VIEW compromisos_tesoreria` reconstruida con los 4 bugs corregidos.
- Campos nuevos en la vista: `es_entrada`, `estado`, `fuente`, `presupuesto_id`, `partida_id`, `factura_id`, `vencimiento_id` (trazabilidad completa del origen).
- Regla anti-doble conteo mantenida: facturas con `presupuesto_pago_id IS NOT NULL` quedan excluidas de la rama de facturas (ya están en la rama de presupuestos).

**API — `proyectosApi.ts`:**

- `CompromisoTesoreria` ampliado con los nuevos campos (`es_entrada`, `estado`, `fuente`, IDs de trazabilidad).
- `getCompromisosTesoreria(sociedadIds?: string[])` acepta array de IDs. Usa el filtro `in.(...)` de PostgREST para multi-sociedad. Sin parámetros = consolidado.

**UI — `Tesoreria.tsx` (reescritura dirigida):**

- **Selector multi-sociedad**: pills toggle por sociedad. "Todas" = consolidado. Seleccionar N pills = filtra y refetcha. El badge muestra cuántas están activas.
- **Horizonte temporal**: barra de tabs 7d / 15d / 30d / 60d / 90d / 6m / 12m / Todo. Los KPIs y la timeline se recalculan al cambiar.
- **KPIs mejorados**: Caja disponible · Salidas Nd (confirmadas) · Entradas Nd (previstas) · Posición neta Nd con indicador Déficit/Superávit.
- **Vencidos como alerta**: sección roja con lista de compromisos cuya fecha es pasada y siguen pendientes.
- **Aviso "sin sociedad"**: ítems sin `sociedad_id` asignado aparecen como dato incompleto (banner ámbar), no se ocultan.
- **Desglose por sociedad**: tabla de salidas/entradas/neto por cada sociedad dentro del horizonte seleccionado.
- **Desglose por fuente**: cuánto corresponde a presupuestos, vencimientos y facturas dentro del horizonte.

**UI — `VencimientosView.tsx`:**

- Sociedad pasa de campo "(opcional)" a obligatorio en el formulario de nuevo vencimiento: asterisco rojo, borde ámbar si vacío, botón Guardar bloqueado hasta que se seleccione una sociedad.
- El esquema BD mantiene `sociedad_id` nullable para no romper datos existentes (fondos pignorados insertados sin sociedad por migración histórica).

#### `@alsari/financiero` — Vencimientos: fondos pignorados por tramos + dirección de flujo (2026-06-03)

**Modelo de datos:**

- Nuevo tipo `'pignorado'` en el CHECK de la tabla `vencimientos` (migración `20260601*`).
- Nueva columna `es_entrada: boolean` (default `false`) para distinguir cobros de pagos (migración `20260602*`). Regla: `true` = el holding recibe dinero; `false` = el holding paga.
- **Categorización correcta de todos los vencimientos existentes** según el Excel "Calendario de Pagos - Alsari.xlsx" (columna Prestamista = Acreedor = quien cobra = entrada). Todos los préstamos donde Javier/Iván son prestamistas son entradas; el seguro es salida.

**Fondos pignorados Santander:**

- Eliminada la entrada incorrecta (1.100.000€ todo en oct-2029, tipo "otro").
- Sustituida por **3 tramos reales** según el calendario:
  - Tramo 1: 23-oct-2027 · 550.000€ (50%) — liberación condicionada a no-reclamaciones de Evariste
  - Tramo 2: 23-oct-2028 · 275.000€ (25%)
  - Tramo 3: 23-oct-2029 · 275.000€ (25%) — recuperación total
- Tipo `pignorado`, `es_entrada = true`.
- Contexto de negocio: aval bancario Santander por 1.051.378€ constituido para garantizar responsabilidades de Javier frente a Evariste tras la venta del 57% de Rialsa Obras S.L. El banco bloqueó 1.100.000€ de liquidez de Javier.

**UI:**

- Indicador **↑ verde** (emerald) para entradas, **↓ gris** para salidas en calendario y vista lista.
- Resumen separado: card "Por pagar" (rose) + card "Por cobrar" (emerald).
- Meses con solo entradas: borde esmeralda, icono ↑, sin alarma roja/ámbar.
- Totales por año: muestra obligaciones + ↑ liberaciones separados.
- Formulario: toggle Salida/Entrada al crear nuevos vencimientos.
- Vista lista: texto contextual ("Cobro en X días" / "Por cobrar — X días de retraso").

### Added

#### `@alsari/contabilidad` — Enfrentar factura a partida de presupuesto (2026-05-26)

**Nuevo flujo "Enfrentar a partida de presupuesto"** en el panel de revisión de facturas recibidas (`FacturaReviewPanel`):

- Sección **Presupuesto** al final del panel. Botón "Enfrentar a partida de presupuesto" cuando la factura no está vinculada.
- **Modal de búsqueda con acordeón por capítulo**: las partidas se agrupan por `presupuesto_nombre + capitulo_nombre`. Cada capítulo es un header colapsable. Al buscar, todos los capítulos con resultados se auto-expanden; al borrar la búsqueda, se colapsan.
- Al seleccionar una partida: se crea automáticamente un `presupuesto_pagos` con `importe = base_imponible`, `tipo_iva`, `fecha_prevista = fecha_vencimiento ?? fecha_factura`, `descripcion = "Fra. Nº — proveedor"`, `tipo_flujo = 'gasto'`. Se enlazan los FKs bidireccionales (`presupuesto_pagos.factura_recibida_id` y `facturas_recibidas.presupuesto_pago_id`).
- Estado del pago auto-calculado: `'pagado'` si la factura ya está en estado `pagada`, `'pendiente'` en cualquier otro caso.
- Al vincular exitosamente, se muestra una ficha azul con presupuesto + partida + capítulo.
- Botón de desvinculación (`Unlink`) que limpia ambos FKs.
- Errores surfaced en el banner rojo del panel (antes se silenciaban con `catch {}`).

**Nueva función `crearPagoDesdeFactura`** en `contabilidadApi.ts`:

- POST a `presupuesto_pagos` con todos los campos relevantes.
- PATCH inverso a `facturas_recibidas.presupuesto_pago_id`.
- Mensaje de error detallado incluye el body HTTP de Supabase para depuración.

**Nueva función `searchPartidasPresupuesto`** en `contabilidadApi.ts`:

- 3 queries paralelas (`presupuesto_partidas`, `presupuesto_capitulos`, `presupuestos`) + join en cliente (evita hints FK de PostgREST que fallaban silenciosamente).
- Filtro de texto por presupuesto, descripción, capítulo, proyecto o proveedor esperado.

#### `@alsari/contabilidad` — Fixes de ciclo de vida factura ↔ pago (2026-05-26)

- **Al marcar factura como pagada** (`handlePagar`): si tiene `presupuesto_pago_id`, también se parchea `presupuesto_pagos.estado = 'pagado'` en la misma operación (`Promise.all`). El importe pagado en el presupuesto se actualiza inmediatamente.
- **Al borrar una factura** (`handleDelete` en `Facturas.tsx`): si tiene `presupuesto_pago_id`, se elimina primero el pago vinculado en `presupuesto_pagos` y luego la factura. El pago auto-creado tiene el mismo ciclo de vida que la factura que lo originó.
- Nueva función `marcarPagoComoPagado(pagoId)` en `contabilidadApi.ts`.
- `deleteFacturaRecibida(id, presupuestoPagoId?)` acepta el pago vinculado para cascada.

#### `@alsari/contabilidad` — PGC completo en selector de cuenta (2026-05-26)

- **`CUENTAS_GASTO`**: ampliado de 12 a ~220 cuentas cubriendo **todos los grupos del PGC 2007** (1 al 9): financiación básica, activo no corriente, existencias, acreedores/deudores, cuentas financieras, compras y gastos, ventas e ingresos, patrimonio neto.
- **`SelectField` ahora admite `searchable` prop**: cuando está activo, el dropdown muestra un input de búsqueda en tiempo real que filtra por código o descripción. Auto-foco al abrir. `"Sin resultados"` si no hay coincidencias.
- El selector de cuenta de gasto en `FacturaReviewPanel` usa `searchable`.
- `sugerirCuenta` actualizada: nuevos patrones para transportes, internet, Seguridad Social, amortizaciones, indemnizaciones, seguros, banco/intereses.

#### `@alsari/presupuestos` — Fix botón Home en sidebar (2026-05-26)

- `ProyectosSidebar`: header rediseñado al mismo patrón que `ContabilidadSidebar`. Botón `Home` (icono casa, `window.location.href = '/'`) en la esquina superior izquierda.

---

> **Fase 5 — Módulo Presupuestos: presupuestación por proyecto, cronograma de pagos y control de tesorería forward.**

### Added

#### Módulo `@alsari/presupuestos` — Presupuestos, Pagos y Tesorería Forward (2026-05-25)

**Nuevo módulo completo** para presupuestar proyectos/sociedad, controlar el cronograma de pagos y anticipar la posición de tesorería futura.

**Stack:**

- Vite + React 19 · TypeScript estricto · Tailwind CSS. Puerto `5176`.
- API: PostgREST directo a Supabase. Auth bridge `window.alsariToken` (mismo patrón que `@alsari/contabilidad`).
- Exporta `PresupuestosDashboard`.

**4 vistas principales:**

1. **Dashboard** — 4 KPI cards (presupuestos activos, pagos próximos 30d, total presupuestado pendiente, pagos vencidos). Lista de los 5 próximos pagos con badge de urgencia. Grid de presupuestos activos con barra de progreso (importe comprometido vs presupuestado).
2. **Calendario de Pagos** — Vista cronológica de todos los pagos de todos los presupuestos. Filtros por horizonte (3m/6m/12m/todo), tipo (gasto/ingreso) y estado (pendiente/pagado). Agrupación mensual. Resumen de saldo previsto (ingresos esperados − gastos pendientes). Acción inline "Marcar pagado" / "Deshacer".
3. **Mis Presupuestos** — Lista filtrable por estado (borrador/activo/cerrado). Barra de progreso por presupuesto. Navegación al detalle. Eliminación con confirmación.
4. **Detalle Presupuesto** — Gestión completa jerárquica: presupuesto → capítulos → partidas → pagos. Añadir/editar/eliminar capítulos y partidas inline. Añadir pagos por partida (importe, fecha, tipo gasto/ingreso). Toggle estado pago (pendiente ↔ pagado). Barra de progreso por capítulo y global. Transiciones de estado: borrador → activo → cerrado.
5. **Nuevo Presupuesto** — Formulario con 5 tipos (obra, explotación, capex, corporativo, tesorería) con descripción contextual. Campos: nombre, proyecto, fechas inicio/fin, notas.

**Infraestructura Supabase — 4 tablas nuevas (todas con RLS `authenticated`):**

- `presupuestos` — cabecera (nombre, tipo, proyecto_nombre, estado, fechas).
- `presupuesto_capitulos` — agrupación jerárquica dentro del presupuesto.
- `presupuesto_partidas` — línea de gasto/ingreso dentro de un capítulo (importe presupuestado).
- `presupuesto_pagos` — vencimiento concreto (importe, fecha_prevista, tipo_flujo, estado). FK a `facturas_recibidas` para vincular factura → partida presupuestaria.
- `facturas_recibidas` — nueva columna `presupuesto_pago_id` para la vinculación inversa.

**Host OS — cambios:**

- Nueva ruta `/presupuestos` → `PresupuestosPage` → `PresupuestosDashboard`.
- `OSSidebar`: nuevo item "Presupuestos" con icono `Wallet`.
- `Home` (`/`): nueva card Presupuestos (verde esmeralda).
- `next.config.ts`: `@alsari/presupuestos` añadido a `transpilePackages`.

**Supabase PAT:**

- Almacenado en `.env.local` como `SUPABASE_PAT`. Permite a Claude Code aplicar migraciones directamente vía Management API sin acceso al Dashboard.

> **Rama:** `feat/presupuestos-module` · Type-check limpio en `@alsari/presupuestos`, `@alsari/types` y `@alsari/host`.

---

> **Fase 4 (continuación) — Facturas Emitidas: editor completo estilo Holded, generación de PDF A4 profesional, cuentas bancarias por sociedad, datos legales en factura, gestión "Mis Empresas".**

### Added

#### Módulo `@alsari/contabilidad` — Facturas Emitidas completas (2026-05-22)

**Editor de facturas emitidas (Holded-style):**

- Vista `FacturasEmitidas` refactorizada: patrón `view: 'list' | 'editor'` en lugar de modal. El editor ocupa la pantalla completa al crear o editar.
- `FacturaEmitidaEditor` — componente de ~1.600 líneas con:
  - Búsqueda de contacto con autocompletado (nombre / NIF).
  - Auto-numeración por serie (F, A, R...) editable manualmente.
  - Tabla de líneas drag-and-drop: tipos `linea` y `titulo`, multi-impuesto (IVA 21/10/4/0%, retención 15/7%, recargo de equivalencia), descuento global (% o €).
  - Sección de texto del documento (rich text inline).
  - Sección de mensaje final al cliente.
  - Método de pago: selector tipado. Cuando es "Transferencia bancaria" aparece el selector de cuentas bancarias de la sociedad emisora con formulario inline para añadir nuevas cuentas.
  - Categorización: cuenta contable PGC, etiquetas, nota interna.
  - Botón "Guardar borrador" y botón "Aprobar" con dropdown (Guardar como emitida / Guardar como cobrada / Cancelar).
  - **Vista previa en overlay** con el mismo diseño que el PDF.
  - **Descarga PDF** vía `window.open` + `document.write` + `window.print()`.

**Factura PDF (diseño profesional — "Pin Box"):**

- Cabecera oscura (`#111827`) con logo Alsari Capital (siempre `/logo.png`), nombre legal de la sociedad emisora, CIF, domicilio social y email.
- Columna derecha: "Factura" en 36px bold, nº de documento, fecha y vencimiento.
- Sección "Facturado a" + "Total a cobrar" (dos columnas).
- Tabla de líneas con columnas Descripción / Precio / Cant. / Total. Soporte de filas título (fondo gris).
- Totals: Subtotal → IVA → Retención → separador → Grand Total.
- Sección "Datos para el pago" (solo si método = Transferencia y hay IBAN): titular, IBAN formateado, banco.
- Pie de página con branding Alsari Capital OS.
- **A4 completo**: `.page { min-height: 297mm; display: flex; flex-direction: column }` + spacer `flex: 1` entre contenido y pie. `@page { size: A4; margin: 0 }`.

**Ficha de sociedad y cuentas bancarias:**

- Migración `20260522120000_sociedades_ficha_bancaria.sql`:
  - `ALTER TABLE sociedades` — añadidos: `domicilio`, `localidad`, `codigo_postal`, `pais`, `email`, `telefono`, `logo_url`.
  - Nueva tabla `cuentas_bancarias_sociedad` (id, sociedad_id_ref, alias, titular, banco, iban, swift, activa). RLS `authenticated`.
  - `ALTER TABLE facturas_emitidas` — añadidos: `metodo_pago`, `cuenta_bancaria_iban`, `cuenta_bancaria_alias`, `cuenta_bancaria_titular`. Reemplaza el antiguo patrón `[MÉTODO PAGO] X` codificado en `notas`.
- Nuevos tipos en `@alsari/types`: `SociedadContabilidad`, `CuentaBancariaSociedad`. `FacturaEmitida` extendida con campos de pago.
- API: `getSociedadesContabilidad()`, `updateSociedad()`, `getCuentasBancarias()`, `createCuentaBancaria()`, `deleteCuentaBancaria()`.

**Vista "Mis Empresas" (nueva):**

- Nueva sección **CONFIGURACIÓN** al final del sidebar de Contabilidad.
- Item "Mis Empresas": card por cada sociedad con todos sus datos legales editables inline (nombre, CIF, domicilio, localidad/CP, país, email, teléfono).
- Lista de cuentas bancarias por sociedad con botón eliminar.
- Formulario inline para añadir cuentas (alias, titular, IBAN, banco, SWIFT).
- Separada del flujo operativo contable — se configura una vez.

**Auth token bridge (`window.alsariToken`):**

- `AppShell.tsx` expone `window.alsariToken` leyendo la sesión de Supabase via `getSession()` + `onAuthStateChange`. Se mantiene siempre actualizado.
- `getJwt()` en `contabilidadApi.ts`: lee `window.alsariToken` primero, fallback a `localStorage`, fallback a anon key. Resuelve los 401 en POST/PATCH de módulos Vite embebidos en el host Next.js (`@supabase/ssr` guarda sesión en cookies, no en localStorage).

**Dark mode más luminoso:**

- `globals.css`, `AppShell`, `ContabilidadLayout`, `ContabilidadSidebar`: fondo `zinc-950` → `zinc-900`, bordes y opacidades subidas. Aspecto más próximo a apps oscuras estándar.

> **Rama:** `feat/contabilidad-workflow` · Type-check limpio en `@alsari/contabilidad` y `@alsari/types`.

---

> **Fase 4 — Módulo Contabilidad: OCR de facturas, workflow de aprobación multi-paso, asientos contables automáticos, movimientos bancarios y reconciliación.** > `@alsari/contabilidad` reemplaza y fusiona el antiguo `@alsari/facturas` (nunca construido).
> 10 tablas nuevas en Supabase · Edge Function `procesar-factura` con Claude Vision.

### Added

#### Módulo `@alsari/contabilidad` — OCR + Workflow + Contabilidad (2026-05-21)

**Fusión de módulos:**

- `@alsari/facturas` (módulo Fase 1, solo lista básica) absorbido en `@alsari/contabilidad`.
- `/facturas` en el OSSidebar eliminado. La ruta redirige automáticamente a `/contabilidad`.

**Stack del módulo:**

- Vite + React 19 · TypeScript estricto · Tailwind CSS.
- API: PostgREST directo a Supabase (sin CF Worker). Anon key pública; RLS controla acceso.
- Export: `ContabilidadDashboard`.

**5 vistas principales:**

1. **Dashboard** — KPIs en tiempo real (movimientos sin revisar, pendiente de pago, asientos borrador),
   flujo de caja (entradas / salidas de los últimos 50 movimientos), tabla de movimientos recientes,
   panel de facturas vencidas con alerta roja.
2. **Movimientos bancarios** — Tabla con filtros (sociedad, fecha, categoría, revisado/pendiente).
   Importación de extractos CSV de Santander, BBVA, CaixaBank y Caja Rural. Motor de categorización
   automática (15 reglas locales + reglas de BD) con detección de operaciones intragrupo.
   Inline edit de categoría y notas. Marcado de revisado.
3. **Facturas recibidas** — Subida de PDF / imagen → OCR con Claude Vision (Edge Function) →
   borrador con 12 campos extraídos (proveedor, NIF, número, fechas, importes, concepto) y puntuaciones
   de confianza por campo. Panel de revisión lateral con:
   - Tarjetas grises separadas por sección (Datos · Importes · Asiento · Notas).
   - Selector de cuenta de gasto PGC (600–642) con sugerencia automática basada en palabras clave.
   - Vista previa del asiento en tiempo real (debe/haber).
   - Al dar visto bueno → crea `asiento_borrador` automáticamente.
   - Workflow multi-paso: `borrador_ocr → revision_javi → pendiente_pago → pagada`.
   - Umbral configurable (default €1.000): facturas mayores pasan por revisión de Javi.
   - Sistema de aprendizaje OCR: cada aprobación registra si los campos fueron correctos.
4. **Diario Borrador** — Lista de asientos generados automáticamente, con filtros de fecha y
   estado. Visualización de líneas (debe/haber) por asiento. Confirmación/rechazo de borrador.
5. **Reconciliación** — Comparativa asientos borrador vs oficiales importados desde gestoría.
   Score de similitud, tabla de diferencias, marcado de resuelto.

**Infraestructura Supabase — 10 tablas nuevas (todas con RLS `authenticated`):**

| Tabla                        | Propósito                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| `movimientos_bancarios`      | Transacciones de extractos CSV (multi-banco)               |
| `facturas_recibidas`         | Facturas de proveedor con soporte OCR y workflow           |
| `facturas_emitidas`          | Facturas emitidas por el grupo                             |
| `asientos_borrador`          | Asientos contables generados automáticamente               |
| `asientos_oficiales`         | Asientos importados desde gestoría (A3/Sage/CSV)           |
| `plan_cuentas`               | PGC por sociedad (personalizable)                          |
| `reglas_categorizacion`      | Motor de categorización con aprendizaje (seed: 30+ reglas) |
| `reconciliacion_log`         | Log de comparativas borrador vs oficial                    |
| `configuracion_contabilidad` | Single-row config (umbral aprobación, emails)              |
| `ocr_accuracy_stats`         | Estadísticas de acierto OCR por campo                      |

**Edge Function `procesar-factura`** (Deno, desplegada en `swtyxysvnfcfxziclteq`):

- Recibe PDF o imagen vía `multipart/form-data`.
- Convierte a base64 y llama a Claude `claude-sonnet-4-6` con soporte de documentos (`pdfs-2024-09-25`).
- Extrae 12 campos con puntuaciones de confianza (0–1) por campo.
- Crea registro `borrador_ocr` en `facturas_recibidas` con `SUPABASE_SERVICE_ROLE_KEY`.
- Secreto `ANTHROPIC_API_KEY` configurado en el proyecto Supabase.

**Asiento contable automático:**

- Lógica: `6xxx (gasto) + 472 (IVA) → 4751 (retención, si aplica) + 400 (proveedores)`.
- Cuenta de gasto sugerida por palabras clave del concepto y proveedor.
- Asiento creado en `asientos_borrador` al dar visto bueno a la factura.

**Motor de categorización (`categorizacion.ts`):**

- 15 reglas hardcoded para el contexto Alsari (intragrupo, fiscal, notaría, rentas, bancarios…).
- Aplica reglas de BD (`reglas_categorizacion`) con prioridad descendente.
- Actualiza `confirmaciones` en cada regla correctamente aplicada.

**Parsers CSV bancarios (`csvParsers.ts`):**

- Santander, BBVA, CaixaBank, Caja Rural, genérico.
- Auto-detección del banco por cabeceras.
- Normalización de fechas (DD/MM/YYYY → YYYY-MM-DD), importes con coma decimal.

**API (`contabilidadApi.ts`):**

- CRUD completo para las 8 entidades principales via PostgREST.
- `procesarFacturaPdf()` — llamada a la Edge Function OCR.
- `avanzarEstadoFactura()` — transición de estados con actualización parcial.
- `getCurrentUserEmail()` — lee token de sesión de localStorage para identificar el rol.

**Tipos nuevos en `@alsari/types`:**

- `FacturaRecibida` extendida: `ocr_confianza`, `cuenta_gasto`, workflow states.
- `MovimientoBancario`, `FacturaEmitida`, `AsientoBorrador`, `AsientoOficial`.
- `LineaAsiento`, `PlanCuenta`, `ReglaCategorizacion`, `ReconciliacionItem`.
- `ConfiguracionContabilidad`, `OcrConfianza`, `RolAprobacion`.

**Integración en el Host:**

- `apps/host/src/app/(app)/contabilidad/page.tsx` — carga `ContabilidadDashboard`.
- `apps/host/next.config.ts` — `@alsari/contabilidad` añadido a `transpilePackages`.
- `apps/host/src/app/globals.css` — `.field-input` / `.field-label` con `color-scheme: dark`.
- `OSSidebar` actualizado: 3 items (Inicio / Financiero / Contabilidad).

> **Rama:** `feat/contabilidad-workflow` · Type-check limpio en `@alsari/contabilidad` y `@alsari/types`.

---

> **Fase 3 — Módulo Financiero: navegación Entidades, Cashflow, Vencimientos, Sumas y Saldos**
> Arquitectura de navegación refactorizada (galería Entidades + módulos globales),
> nuevas vistas Cashflow y Vencimientos, e importación de Sumas y Saldos contables
> para derivar KPIs automáticamente desde el PGC — eliminando dependencia de Excel.

### Added

#### Importación Sumas y Saldos + derivación KPIs PGC (2026-05-20)

- **`services/supabase/migrations/20260520130000_balance_sumas_saldos.sql`** —
  tabla `balance_sumas_saldos` con UNIQUE(sociedad_id, periodo, cuenta), índice
  parcial e índice de búsqueda. Vista `v_balance_periodos` (GROUP BY) para listar
  períodos importados sin traer miles de filas al cliente. RLS anon read/insert/delete.
- **`apps/modules/financiero/src/lib/sumasSaldosParser.ts`** — parser SheetJS
  flexible: detecta columnas por fuzzy matching (normaliza acentos, mayúsculas).
  Compatible con Sage, A3, ContaPlus y formatos genéricos. Maneja formatos
  numéricos españoles ("1.234,56"). Derivación de 14 KPIs por códigos PGC:
  caja (57x), deuda bancaria LP (17x) y CP (52x), deuda socios (55x),
  patrimonio neto (10-14x), activo/pasivo corriente y no corriente, fondo de maniobra.
- **`apps/modules/financiero/src/lib/sumasSaldosImport.ts`** — operaciones Supabase:
  `uploadSumasSaldos()` (delete período → insert en chunks → upsert kpis_sociedades),
  `getPeriodosImportados()` (vía v_balance_periodos), `deletePeriodo()`.
- **`MaestroView.tsx` — tab "Contabilidad"**: selector sociedad + período (type="month"),
  drag & drop Excel, preview con 6 KPI cards calculados antes de confirmar, historial
  de períodos importados con opción de borrar. KPIs fluyen automáticamente a
  EntidadesView, Overview y CashflowView sin configuración adicional.

#### Arquitectura de navegación — galería Entidades (2026-05-20)

- **Eliminado dropdown de sociedades del sidebar.** La sociedad activa ya no se
  selecciona en la barra lateral, evitando la confusión de ver "Pavier S.L." en
  el header al ver Cashflow global.
- **`EntidadesView.tsx`** (nuevo) — galería de cards por entidad, agrupada en
  Personas / Consolidado / Holdings / Filiales. Cada card muestra KPIs (caja,
  deuda, neto) y contador de proyectos. Clic en card navega a `overview` de
  esa entidad.
- **`FinancialSidebar.tsx`** (reescrito) — secciones agrupadas: GENERAL
  (Entidades, Mapa), FINANZAS (Cashflow, Workspace), PATRIMONIO (Activos,
  Vencimientos), GESTIÓN (Maestro). Sección "Entidad activa" aparece solo
  cuando se está dentro del contexto de una entidad (overview o proyecto).
- **`DashboardLayout.tsx`** — `GLOBAL_VIEWS` set distingue módulos globales de
  vistas de entidad. Header muestra nombre del módulo en vistas globales y nombre
  de la entidad en vistas de entidad. Breadcrumb con link clicable a Entidades.
  Vista por defecto: `'entidades'`.
- **`App.tsx`** — filtrado mejorado de personas físicas: detecta filas `javier_persona`
  e `ivan_persona` para excluirlas de Filiales. Personas aparecen una sola vez.
  KPIs consolidados para Alsari Capital (idRef === null) sumando todas las sociedades.

#### Módulo Cashflow (2026-05-20)

- **`services/supabase/migrations/20260520100000_vencimientos.sql`** — tabla
  `vencimientos` (titulo, tipo, fecha_vencimiento, importe, sociedad_id, estado,
  recurrencia) con RLS. Tabla `flujos_caja_proyectos` con tipos de flujo tipados.
- **`CashflowView.tsx`** (nuevo) — posición actual (caja/deuda desde kpis_sociedades),
  flujos agrupados por mes con CRUD. Vista consolidada cuando idRef === null.
- **`cashflowImport.ts`** (nuevo) — CRUD sobre `flujos_caja_proyectos`.

#### Módulo Vencimientos (2026-05-20)

- **`VencimientosView.tsx`** (nuevo) — CRUD completo de vencimientos. Código de
  color por urgencia (rojo = vencido, ámbar ≤ 30 días, verde > 30 días).
  Filtro por tipo. Toggle estado pendiente ↔ gestionado on hover. Badge con
  count de próximos vencimientos.
- **`vencimientosImport.ts`** (nuevo) — CRUD sobre `vencimientos`.

#### Overview + PersonaView (2026-05-20)

- **`PersonaView.tsx`** — vista dedicada para Javier/Iván Alarcón como personas
  físicas. Muestra patrimonio personal sin KPIs societarios.
- **`Overview.tsx`** — eliminada sección duplicada "Cartera de Proyectos" y
  sección Contabilidad (movida a ficha de sociedad). Solo muestra NAVSection +
  Balance Contable KPI cards.

### Added

#### Migración datos maestros a Supabase (2026-05-18)

- **`services/supabase/migrations/20260518120000_holding_structure.sql`** —
  tablas `sociedades`, `proyectos`, `kpis_sociedades`, `kpis_proyectos` con RLS
  `anon + authenticated`. Índices en `sociedad_tenedora` para filtrado en dashboard.
- **`scripts/migrate_alsari_db.py`** — script Python que lee `Alsari_DB.xlsx`
  (data_only=True), parsea las 4 hojas relevantes y hace upsert en Supabase via
  REST API. Migra 12 sociedades, 4 proyectos, 10 KPIs de sociedad, 3 KPIs de
  proyecto. Re-ejecutable (upsert idempotente).
- **`apps/modules/financiero/src/App.tsx`** — reemplaza `fetch(CF Worker)` por
  4 queries paralelas a Supabase (`Promise.all`). Mappers `mapSociedad`,
  `mapProyecto`, `mapKpisSoc`, `mapKpisProj` convierten snake_case → claves
  españolas que esperan los componentes downstream. Cache localStorage preservada
  para modo offline.

#### Módulo financiero — Balance PGC + libro mayor (2026-05-18)

- **`services/supabase/migrations/20260518000000_financial_module.sql`** —
  tablas `import_batches`, `journal_entries`, `account_mappings` con seed de
  reglas PGC validadas por gestoría.
- **`apps/modules/financiero/src/lib/mayorParser.ts`** — parser SheetJS del
  libro mayor jerárquico. Auto-detecta fila de inicio (rows 2-20). Regex
  `/^(\d{4,8})(?:\s+(.+))?$/` para código+nombre en misma celda. `isEmpty(0)`
  correcto para celdas Excel con valor 0.
- **`apps/modules/financiero/src/lib/pgcEngine.ts`** — motor de clasificación PGC.
  Categorías: caja, deuda*bancaria*{cp,lp}, deuda*partes_vinc*{cp,lp},
  patrimonio*neto, activo*{corriente,no*corriente}, pasivo*{corriente,no_corriente},
  resultado_ejercicio (grupos 6+7). `patrimonioNeto = base + resultado`.
- **`apps/modules/financiero/src/lib/supabaseImport.ts`** — `saveImport()` con
  bulk-insert en chunks de 500, rollback de batch en fallo, detección de
  duplicados (código 23505).
- **`apps/modules/financiero/src/components/views/BalanceView.tsx`** — vista de
  upload + balance PGC calculado. Props `entityId`/`entityName` opcionales.
  DebugPanel cuando el parser devuelve 0 asientos. SavePanel con UUID de batch.
- Vista "Balance PGC" integrada en `availableViews` (siempre disponible) y
  enrutada en `DashboardLayout`. Degradación correcta cuando Supabase offline:
  banner rojo + BalanceView standalone. Caché amber banner cuando hay datos.

#### Anteriores (2026-05-17)

> **Fase 2 parcial + cierre estructural** — Auth Supabase, reorganización de
> servicios, home launcher, sidebar expandable, governance completa por módulo.

### Added

#### Home page + sidebar expandable (2026-05-17)

- **`apps/host/src/app/(app)/page.tsx`** — home page tipo launcher. Grid de cards
  por módulo activo (Financiero, Proyectos, Facturas) con icono grande,
  descripción, indicador de estado y CTA. Logo "ALSARI CAPITAL" sobre el saludo.
- **`apps/host/src/components/OSSidebar.tsx`** — sidebar overlay `fixed z-50`
  con toggle de expansión animado (w-16 ↔ w-56). Expandido muestra logo + nombres
  de módulos; colapsado solo iconos. Auto-colapsa al navegar. Añadido item "Inicio".
- **`apps/host/public/logo.png`** — logo Alsari Capital crema (recuperado del
  proyecto legacy `Alsari Database/`).
- **`apps/host/src/components/AppShell.tsx`** — `main` con `ml-16` fijo porque
  el sidebar es overlay (no empuja el layout, no desalinea `FinancialSidebar`).
- Eliminado `apps/host/src/app/page.tsx` raíz que conflictaba con `(app)/page.tsx`
  para la ruta `/`.

#### Limpieza estructural del monorepo (2026-05-17)

- **Capa de gobernanza por módulo** — `CLAUDE.md`, `README.md`, `ARQUITECTURA.md`,
  `CHANGELOG.md` y `ways-of-working-local/README.md` añadidos a los tres módulos
  activos (`financiero`, `facturas`, `proyectos`) con contenido específico real
  (no plantillas).
- **`packages/config/package.json`** y **`packages/supabase-client/package.json`** —
  placeholders mínimos para que pnpm resuelva el glob `packages/*` correctamente.
- **`services/workers/cf-api/package-lock.json`** eliminado (archivo `npm` en
  monorepo `pnpm`).
- **Root `package.json`** — añadido `!apps/modules/_template` a `workspaces` para
  consistencia con `pnpm-workspace.yaml`.
- **`apps/host/tailwind.config.ts`** — comentario explicativo del requisito de
  escanear `../modules/*/src/`.
- **`apps/modules/_template/ways-of-working-local/README.md`** — documentado el
  patrón Tailwind para futuros módulos.
- **`apps/host/next-env.d.ts`** añadido al repo (generado por Next.js).
- **`IGNORE/`** — carpeta consolidada para legacy (`Alsari Database/`,
  `App financiera/`). Añadida al `.gitignore`.

#### Fase 2 — Autenticación con Supabase (rama `feat/fase2-reorganizacion-servicios`)

- **`apps/host/src/lib/supabase/client.ts`** — cliente browser con `@supabase/ssr`.
- **`apps/host/src/lib/supabase/server.ts`** — cliente server-side con cookies.
- **`apps/host/src/middleware.ts`** — protege todas las rutas; redirige a `/login`
  si no hay sesión y de `/login` a `/financiero` si ya autenticado.
- **`apps/host/src/app/login/page.tsx` + `LoginForm.tsx`** — formulario Quiet
  Luxury con email/password, `signInWithPassword` y redirección post-login.
- **`apps/host/src/app/(app)/`** — route group para rutas autenticadas; `layout.tsx`
  envuelve el contenido en `AppShell`, dejando `/login` sin shell.
- **`apps/host/src/components/AppShell.tsx`** — añadido `signOut` con redirección
  a `/login` y `router.refresh()`.

#### Fase 2 — Reorganización de servicios al monorepo

- **`services/workers/cf-api/`** — CF Worker (Wrangler v3) migrado desde la carpeta
  legacy `App financiera, control de facturas/backend/`. Incluye `worker.ts`,
  `auth.ts` (JWT Google), `sheets.ts`, `transform.ts`, `services/imap-ingestion.ts`,
  `services/email-service.ts`, `services/drive-service.ts`, `email-server.ts`.
  - **`.dev.vars`** local (gitignored) con `GCP_PRIVATE_KEY` real.
  - **`.dev.vars.example`** documenta los secrets necesarios.
  - `wrangler.toml` sanitizado: clave privada movida a `.dev.vars`.
- **`services/python/`** — Sistema RAG Python (Alsari Database) migrado desde
  `Alsari Database/`. Incluye `app.py` (Streamlit), `src/`, `scripts/`,
  `scheduler/`, `pages/`, `static/`, `pyproject.toml`.
  - **`.env`** local (gitignored) con credenciales Supabase + OpenAI.
  - **`.env.example`** documenta variables necesarias.

#### Fase 2 — Fix crítico de Tailwind para módulos workspace

- **`apps/host/tailwind.config.ts`** — añadido `'../modules/*/src/**/*.{ts,tsx}'`
  al `content`. Sin esto, las clases Tailwind usadas exclusivamente en los módulos
  (`absolute`, `fixed`, `z-50`, `top-full`, etc.) no se generaban como CSS y los
  componentes renderizaban sin estilos críticos (dropdowns en flujo normal,
  sidebars sin posicionamiento).
  - Restringido a `*/src/**/*` para no escanear `node_modules/` ni `dist/` de
    cada módulo (causaba Internal Server Error).
- **`apps/modules/{financiero,proyectos,facturas}/src/App.tsx`** —
  `import.meta.env['VITE_API_URL']` → `import.meta.env?.['VITE_API_URL']` con
  optional chaining; Next.js no inyecta `import.meta.env` al transpilar módulos
  Vite, así que sin el `?.` crasheaba en runtime.

#### Fase 2 — Ajustes de layout para integración Host + módulos

- **`apps/host/src/components/OSSidebar.tsx`** — siempre `w-16` (icon-only); ya no
  se expande a `w-56` en pantallas grandes. Solo iconos con `title` tooltip.
- **`apps/modules/financiero/src/components/FinancialSidebar.tsx`** —
  `fixed left-0 top-0` → `fixed left-16 top-0` para hacer hueco al rail de 64px
  del OSSidebar. Resto idéntico al original.

### Lessons Learned

- **Lección 3** (`2026-05-17`) — Tailwind del host no escanea `apps/modules/`
  automáticamente; debe añadirse explícitamente al `content` con path restringido
  a `src/`. Ver `.claude/skills/lessons-learned/log.md` para detalle completo.

---

## [0.3.0-pre] — Fase 1 (consolidado)

> **Fase 1 completada** — Los 8 pasos de migración de la app actual al monorepo
> están terminados.

### Added

#### Paso 8 — Verificación, docs y cierre de Fase 1

- Documentación actualizada: `ARQUITECTURA.md`, `CHANGELOG.md`, `ROADMAP.md`.
- ADR 0002 marcado como completado.
- Type-check limpio en todos los módulos y en host (`@alsari/proyectos`,
  `@alsari/facturas`, `@alsari/host`).

#### Paso 7 — `@alsari/facturas`

- **`@alsari/facturas`** (`apps/modules/facturas/`, puerto 5176) — módulo de
  gestión de facturas del holding (Fase 1).
  - Lista de facturas con búsqueda por texto libre y filtros por estado.
  - Estados: `pending`, `en_propiedad`, `en_finanzas`, `paid`, `paid_archived`, `rejected`.
  - KPIs: total facturas, pendientes de pago, importe pendiente, pagadas este mes.
  - Detalle de factura en panel lateral.
  - Consume `@alsari/types` (`Invoice`, `InvoiceStatus`), `@alsari/ui`, `@alsari/utils`.
- **`apps/host/src/app/facturas/page.tsx`** y `FacturasAppClient.tsx` — integración
  en host con wrapper `'use client'`.

#### Paso 6 — `@alsari/proyectos`

- **`@alsari/proyectos`** (`apps/modules/proyectos/`, puerto 5175) — dashboard de
  proyectos del holding (Fase 1).
  - Grid de tarjetas con capital expuesto, valoración y margen por proyecto.
  - Vista de detalle con Recharts (gráfico de barras inversión vs valoración).
  - Enriquecimiento de datos: `cleanProjects` une `Project` + `FinancialProject`.
  - Consume `@alsari/types` (`Project`, `FinancialProject`), `@alsari/ui`, `@alsari/utils`.
- **`apps/host/src/app/proyectos/page.tsx`** y `ProyectosDashboardClient.tsx` — integración
  en host con wrapper `'use client'`.

#### Paso 5 — `@alsari/financiero`

- **`@alsari/financiero`** (`apps/modules/financiero/`) — migración completa del
  dashboard financiero SPA standalone al monorepo (Fase 1).
  - Vistas: Overview (KPIs + cartera), CorporateMap (SVG interactivo), ProjectView
    (detalle + Recharts), Contabilidad (libro mayor), Workspace (semanas).
  - Consume `@alsari/ui`, `@alsari/utils`, `@alsari/types`.
  - Modo privado (`isPrivateMode`) implementado en KPIs y tablas.
  - Type-check estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
  - `/// <reference types="vite/client" />` en App.tsx para compatibilidad con host.
- **`apps/host/src/app/financiero/page.tsx`** y `FinancieroDashboardClient.tsx` —
  conectado via wrapper `'use client'`.
- **`packages/ui/KPICard`** — `secondaryValue?: T | undefined` para compatibilidad
  con `exactOptionalPropertyTypes`.

---

## [0.2.0] — 2026-05-15

### Added

- **Constitución completa del agente** movida a `.claude/CLAUDE.md`; el archivo
  raíz `CLAUDE.md` queda como puntero corto.
- **`.claude/settings.json`** — configuración central de Claude Code (hooks,
  permisos de tools, MCPs).
- **`.claude/hooks/`** — guardrails deterministas (shell scripts):
  - `PreToolUse.sh` bloquea comandos peligrosos (`rm -rf`, `git push --force`,
    acceso a `.env`).
  - `PostToolUse.sh` auto-formatea código tras edición y audita cambios críticos.
  - `SessionStart.sh` imprime estado del repo al arrancar.
  - `Stop.sh` recuerda registrar lecciones aprendidas.
- **`.claude/agents/`** — subagents especializados con contexto aislado:
  - `code-reviewer` (revisión contra ways-of-working).
  - `test-runner` (ejecuta tests y consolida resultados).
  - `migration-checker` (valida migraciones SQL).
  - `architecture-explorer` (mapea zonas del monorepo).
- **`.claude/commands/`** — slash commands custom:
  - `/nueva-leccion` (registrar lección en lessons-learned).
  - `/nuevo-modulo <nombre>` (crear módulo desde plantilla).
  - `/reporte-semana` (generar Reporte de Semana ejecutivo).
  - `/revisar-cambios` (invocar code-reviewer sobre diff).

### Changed

- **Refactor estructural completo:**
  - `core-host/` → `apps/host/`.
  - `modulos/_template-modulo/` → `apps/modules/_template/`.
  - `modulos/*` → `apps/modules/*`.
  - `ways-of-working-global/` → `.claude/docs/ways-of-working/`.
- **Distinción `.claude/docs/` (para Claude) vs `docs/` (para humanos).**
- `package.json` y `pnpm-workspace.yaml` actualizados con nuevas rutas.
- Todos los archivos referencian las nuevas rutas (CLAUDE.md, ways-of-working,
  README, scripts).
- VSCode `settings.json` actualizado con nuevas rutas de ESLint.
- Script PowerShell `setup-alsari-os.ps1` regenerado para validar v0.2.

### Rationale

- La estructura `apps/` + `packages/` es el estándar de la industria (Turborepo,
  Vercel) y mejora el reconocimiento universal frente a `core-host` + `modulos`.
- Mantener `apps/host/` separado de `apps/modules/` preserva la metáfora visual
  "tronco + ramas" que pidió Guille, sin sacrificar el patrón estándar.
- Mover todo lo del agente a `.claude/` aprovecha la convención oficial de
  Anthropic y permite auto-carga sin configuración manual.
- Los hooks añaden una capa de seguridad imposible de saltarse (las reglas de
  `ways-of-working` ya no dependen solo de la buena voluntad de Claude).
- Los subagents permiten delegar tareas pesadas sin contaminar el contexto
  principal.

---

## [0.1.0] — 2026-05-14

### Added

- **Estructura inicial del monorepo** con pnpm workspaces + Turborepo.
- **Ways of Working globales** (10 archivos): rol y autoridad, arquitectura, código,
  git workflow, UI/UX, seguridad, testing, documentación, glosario, protocolo de
  aprendizaje.
- **Claude Skills globales** (5 skills): `corporate-context`, `financial-formulas`,
  `git-protocol`, `ui-quiet-luxury`, `lessons-learned`.
- **Sistema de aprendizaje vivo** con `lessons-learned/log.md` y protocolo de captura.
- **Documentación maestra inicial:** `CLAUDE.md`, `README.md`, `ARQUITECTURA.md`,
  `ROADMAP.md`, primer ADR (`0001-stack-tecnico.md`).
- **Configuración base:** `tsconfig.json`, `.prettierrc`, `.editorconfig`,
  `.gitignore`, `.env.example`, `.nvmrc`.
- **CI/CD:** workflow de GitHub Actions con type-check, lint, format, test, build.
- **Plantillas:** `PULL_REQUEST_TEMPLATE.md`, issue templates para bug y feature.
- **VSCode/Antigravity:** `settings.json` y `extensions.json` recomendados.
- **Plantilla de módulo** para crear nuevos módulos rápidamente.
- **Script PowerShell** para validar la estructura en Windows.

### Notas

- Esta es la **versión 0 conceptual**: la infraestructura está montada pero el
  código de aplicación (Host OS y módulos) aún se va a generar/migrar en sesiones
  posteriores.
- El branding "Quiet Luxury" (zinc-950 + crema `#F5F0E1` + glassmorphism) se ha
  codificado a partir de la app actual de Guille (Neural Finance V3.0).
