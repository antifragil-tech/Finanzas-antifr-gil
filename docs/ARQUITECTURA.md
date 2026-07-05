# Arquitectura — Alsari Capital OS

> Documento vivo. Estado técnico actual del sistema.
> **Claude actualiza este archivo inmediatamente cuando cambia algo relevante.**

**Última actualización:** v0.4.6 · 2026-06-11 — Rediseno mapa corporativo: personas fisicas en L0, holdings anclados a extremos del bus L2 (`SharedBusEdges`), `buildLayout()` refactorizado para calcular L2 antes que L1. Migración `20260611090000` añade `fecha_inicio_inversion` y `tae_declarada` a `activos_patrimonio`.
**Mantenedor técnico:** Claude (con validación de Guille)

---

## 🗺️ Visión general

Alsari Capital OS es un **monorepo** que aloja un ecosistema digital privado del
holding Alsari Capital. Está compuesto por:

- Un **Host OS** (`apps/host`, Next.js 15) que es el cascarón unificador:
  autenticación, navegación, routing entre módulos, manejo de errores transversal.
- Una colección de **módulos independientes** (`apps/modules/*`, Vite + React 19),
  cada uno una herramienta de negocio aislada que el Host carga bajo demanda.
- **Packages compartidos** (`packages/*`: ui, utils, types, supabase-client, config)
  que aportan consistencia sin acoplar los módulos entre sí.
- **Servicios** (`services/`: Supabase como BaaS, Edge Functions, integraciones MCP)
  que constituyen el backend.
- **Capa de agente Claude** (`.claude/`) con constitución, skills, hooks, subagents,
  commands y reglas operativas (ways-of-working).

---

## 🏗️ Diagrama de alto nivel

```
┌───────────────────────────────────────────────────────────────┐
│                       Navegador / Cliente                     │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│              apps/host  ·  Next.js 15 (App Router)            │
│   ┌─────────────────────────────────────────────────────────┐ │
│   │  Auth · Sidebar · Routing · Error Boundaries · Theming  │ │
│   └─────────────────────────────────────────────────────────┘ │
│            │                  │                  │            │
│   ┌────────▼──────┐   ┌───────▼───────┐  ┌──────▼────────┐   │
│   │ apps/modules/ │   │ apps/modules/ │  │ apps/modules/ │   │
│   │  financiero   │   │ contabilidad  │  │  proyectos    │   │
│   │  Vite+React   │   │  Vite+React   │  │  Vite+React   │   │
│   └───────────────┘   └───────────────┘  └───────────────┘   │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│              packages/  (librerías internas)                  │
│   ui · utils · types · supabase-client · config               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                       Supabase                                │
│   PostgreSQL · Auth · Storage · Edge Functions · RLS          │
└───────────────────────────────────────────────────────────────┘
```

---

## 🧱 Componentes principales

### Host OS (`apps/host/`)

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind CSS.
**Responsabilidades:**

- Autenticación de usuarios (Supabase Auth + middleware).
- **Home launcher** (`/`): grid de cards por módulo activo con icono, descripción y CTA.
- Navegación entre módulos vía sidebar expandable (overlay `fixed z-50`).
  - Colapsado (`w-16`): solo iconos.
  - Expandido (`w-56`): logo Alsari + nombres. Auto-colapsa al navegar.
- Routing top-level (`/`, `/financiero`, `/contabilidad`, `/proyectos`, `/presupuestos`). `/facturas` redirige a `/contabilidad`.
- Carga lazy de módulos envueltos en Error Boundaries.
- Theming global (Dark Mode, tokens de Quiet Luxury).
- Boot screen unificado.

**No hace:** lógica interna de módulos, cálculos financieros, queries específicas
de cada dominio.

### Módulos (`apps/modules/*`)

**Stack:** Vite 5 · React 19 · TypeScript · Tailwind CSS · Zustand · Zod.
**Responsabilidades por módulo:**

- Su propio enrutado interno.
- Sus queries a Supabase (a través de `@alsari/supabase-client`).
- Su propio estado local (Zustand stores aislados).
- Sus propios tests.

**Reglas duras:**

- Un módulo NO importa código de otro módulo.
- Un módulo NO accede al `apps/host`.
- Si dos módulos necesitan compartir lógica, esa lógica va a `packages/*`.

**⚠️ Gotcha crítico — Tailwind y módulos workspace:**
El `content` de Tailwind del host **DEBE** incluir `'../modules/*/src/**/*.{ts,tsx}'`.
Sin esto, las clases Tailwind usadas exclusivamente en los módulos (`absolute`,
`fixed`, `z-50`, etc.) **no se generan como CSS** y los componentes renderizan
sin estilos de posicionamiento. **NO** usar `'../modules/**/*.{ts,tsx}'` sin
restringir a `src/` — escanea `node_modules/` de cada módulo y cuelga el dev
server. Ver lección 3 en `.claude/skills/lessons-learned/log.md`.

**Gotcha de runtime:**
Cuando Next.js transpila código de módulos Vite, `import.meta.env` puede ser
`undefined`. Usar siempre optional chaining: `import.meta.env?.['VITE_API_URL']`.

**Módulos activos:**

- `financiero` ✅ — Dashboard financiero completo (Fase 3). Navegación por **galería
  Entidades** (personas, holding, filiales). Módulos globales: **Cashflow**,
  **Vencimientos**, **Patrimonio**, **Workspace**, **Mapa corporativo**.
  Vistas por entidad: Overview, detalle de proyecto. **Importación Sumas y Saldos**
  (tab Contabilidad en Maestro): sube Excel contable → parser PGC → KPIs derivados
  automáticamente en `kpis_sociedades`. Sin dependencia de Excel externo ni CF Worker.
  **Datos 100% en Supabase**: `sociedades`, `proyectos`, `kpis_sociedades`,
  `kpis_proyectos`, `balance_sumas_saldos`, `vencimientos`, `vencimiento_sociedades`, `flujos_caja_proyectos`, `activos_patrimonio`.
  Exporta `FinancieroDashboard`.
  **Mapa corporativo (`CorporateMap.tsx`)**: SVG puro, layout calculado en `buildLayout()` (sin d3). Niveles: L0 = personas fisicas (Javier/Ivan, detectadas por ID-Ref numerico), L1 = holdings (Pavier/Armia), L2 = filiales directas, L3 = subsidiarias de segundo nivel. Holdings se anclan al nodo L2 mas extremo de sus hijos respectivos. Filiales compartidas (Pavier + Armia) usan `SharedBusEdges`; filiales exclusivas usan `BusEdgeGroup`.
  **Schema `vencimientos`** (tabla clave, ver migraciones `20260520*`, `20260601*`, `20260602*`, `20260605*`):
  - `tipo`: `'seguro'|'deuda'|'prestamo'|'contrato'|'impuesto'|'compromiso'|'otro'|'pignorado'`
  - `es_entrada` (bool): `true` = cobro/entrada de caja, `false` = pago/salida. Todos los préstamos donde el holding es prestamista son entradas. Los seguros y gastos son salidas.
  - **Fondos pignorados Santander**: 3 tramos reales (no uno solo) — oct-2027 550k€, oct-2028 275k€, oct-2029 275k€. Tipo `pignorado`, `es_entrada=true`. Condicionados a no-reclamaciones de Evariste (aval bancario por venta de Rialsa).
  - **Multi-sociedad**: tabla `vencimiento_sociedades` (vencimiento_id, sociedad_id, porcentaje). Un vencimiento puede asignarse a N sociedades con distribución porcentual que debe sumar 100. Perisur y Fondos Pignorados van al 50% Javier / 50% Iván.
  - Regla operativa: al añadir un nuevo vencimiento, asignar sociedades con porcentaje. El botón Guardar queda bloqueado hasta que los porcentajes sumen 100.
    **Vista `cashflow_consolidado`** (creada migración `20260605000002`): unifica `flujos_proyecto_consolidados` (facturas recibidas, presupuesto_pagos, flujos manuales) y vencimientos distribuidos por sociedad según porcentaje. Usada por `CashflowView.tsx` con selector multi-sociedad (dropdown checkboxes) y selector de horizonte (3m/6m/12m/todo). Meses futuros con fondo azul. KPIs dobles: reales (cobradas/pagadas/neto) y previstos (por cobrar/por pagar/saldo neto total). Saldo acumulado mes a mes.
- `contabilidad` ✅ — Módulo de contabilidad operativa (Fase 4). Fusiona y reemplaza
  el antiguo `facturas`. **7 vistas** en dos secciones sidebar:
  - **CONTABILIDAD**
    - **Dashboard** — KPIs (sin revisar, pendiente pago, asientos borrador), flujo caja, movimientos recientes, alertas de facturas vencidas.
    - **Movimientos bancarios** — Importación CSV (Santander/BBVA/CaixaBank/Caja Rural), categorización automática con 30+ reglas + aprendizaje, inline edit.
    - **Facturas** — OCR con Claude Vision (Edge Function `procesar-factura`), workflow multi-paso (`borrador_ocr → revision_javi → pendiente_pago → pagada`), asiento contable automático al aprobar, selector de cuenta PGC con búsqueda en tiempo real (**PGC 2007 completo: 9 grupos, ~220 cuentas**).
      **Vincular factura a partida de presupuesto:** desde el panel de revisión de una factura se puede buscar y asignar una partida presupuestaria. Al vincular → se crea automáticamente un `presupuesto_pagos` con los datos de la factura. Ciclo de vida **100% acoplado**: si la factura se marca como pagada → el pago vinculado pasa a `estado: pagado` (actualiza el importe pagado en el presupuesto); si la factura se elimina → el pago vinculado también se elimina (sin pagos huérfanos). La modal de vinculación agrupa las partidas por capítulo con acordeón expandible y buscador.
    - **Facturas Emitidas** — Generación de facturas numeradas por sociedad, líneas con IVA/IRPF, preview en tiempo real, descarga PDF (A4, logo Alsari, datos legales de la sociedad emisora, detalle de cuenta bancaria si el pago es por transferencia). Editor completo con historial y estados.
    - **Diario Borrador** — Visualización y confirmación de asientos generados automáticamente.
    - **Reconciliación** — Comparativa borrador vs oficial importado desde gestoría.
  - **CONFIGURACIÓN**
    - **Mis Empresas** — Ficha legal de cada sociedad (CIF, domicilio social, localidad, CP, email). Gestión de cuentas bancarias por sociedad (alias, titular, IBAN, banco, SWIFT). Datos usados en facturas emitidas y comunicaciones.
      Datos 100% en Supabase (12 tablas: +`cuentas_bancarias_sociedad`, +campos en `sociedades` y `facturas_emitidas`). Exporta `ContabilidadDashboard`.

  > **Saneamiento de facturas (PR A, 2026-06-19).**
  >
  > - **Módulo vivo de facturas/contabilidad = `apps/modules/contabilidad`** (`@alsari/contabilidad`). El antiguo **`apps/modules/facturas` (`@alsari/facturas`) está ARCHIVADO y desconectado** del host (sin dependencia ni `transpilePackages`); la ruta `/facturas` redirige a `/contabilidad`.
  > - **Estados técnicos canónicos** (BD viva + types + UI + Edge Function): `borrador_ocr` (Validación Guille) · `revision_javi` (Revisión Javi) · `pendiente_pago` (Pendiente de pago) · `pagada` · `rechazada`. Labels visibles en **fuente única** `ESTADO_FACTURA_RECIBIDA_LABEL` (`@alsari/types`).
  > - **Drift neutralizado**: la migración huérfana `20260521130000_facturas_estados_v2` (renombraba a `validacion/revision/pago`) **nunca se reflejó en código**; `202606191000_facturas_pra_saneamiento` reafirma de forma idempotente el CHECK y el default canónicos y remapea defensivamente `validacion→borrador_ocr`, `revision→revision_javi`, `pago→pendiente_pago`. **No se renombra nada que use la app.**
  > - **`configuracion_contabilidad.notifications_enabled` (default `false`)**: interruptor maestro de notificaciones externas. **Hoy no hay ningún envío real implementado**; el flag solo formaliza la fase futura. Mientras sea `false`, las notificaciones viven como bandejas/badges internos (sin emails a Javi/Alicia).
  > - **Storage**: en PR A se centralizó el acceso al PDF en un helper único como preparación. **Resuelto en PR A2** (ver "Storage privado de facturas" más abajo): al diagnosticar se verificó que el bucket `facturas` **no existía** y que ninguna factura tenía PDF persistido → **no había fuga pública activa**; el riesgo era latente.
  > - **Fuera del PR A** (fases posteriores): Gmail, Drive, pagos parciales, justificantes, reglas de proveedor, paquete gestoría y notificaciones reales.

  > **Auditoría de facturas (PR B, 2026-06-19).**
  >
  > - Tabla **`factura_aprobaciones`** = log **inmutable** de transiciones (quién/cuándo/acción/estado_anterior→estado_nuevo/comentario/motivo). RLS: solo `SELECT` para autenticados; **sin INSERT/UPDATE/DELETE directos** → el cliente no puede falsificar eventos.
  > - **RPC `avanzar_estado_factura_con_auditoria` (security definer)**: cambia el estado **e** inserta el evento en la **misma transacción** (atómico, no se pierden eventos). El **actor se deriva de `auth.jwt()` en el servidor** (no spoofable); el rol se infiere comparando el email de sesión con la config. Valida la transición **y la autorización rol→acción** dentro de la RPC (valida=Guille · aprueba=Javi/Guille · marca_pagada=Alicia · rechaza=quien puede actuar en ese estado), salvo modo single-operator (3 emails iguales). `cambia_estado` **no** se permite vía RPC (reservada al service role/admin).
  > - Eventos: `crea_borrador_ocr` (sistema, desde la Edge Function `procesar-factura` — requiere redeploy) · `valida` (Guille) · `aprueba` (Javi) · `marca_pagada` (Alicia) · `rechaza` (con motivo) · `registra_pago`/`crea_incidencia`/`resuelve_incidencia` (PR C) · `cambia_sociedad` (PR D.1) · `cambia_estado`/`solicita_aclaracion` (reservados).
  > - UI: sección **"Trazabilidad"** (timeline) en el panel de factura. Para facturas antiguas sin evento de creación, se muestra una línea **sintética informativa** desde `created_at` (marcada como "informativo", no auditada).
  > - Tests (vitest en contabilidad): máquina de estados (`calcularEstadoNuevo`/`accionDeAvance`). **PR B no incluye** pagos parciales, justificantes, Gmail, Drive, Storage privado ni notificaciones reales.

  > **Storage privado de facturas (PR A2, 2026-06-19).**
  >
  > - **Hallazgo (verificado en remoto antes de implementar):** el bucket `facturas` **nunca se creó**; la subida de la Edge Function fallaba en silencio y **ninguna factura tenía PDF persistido** (0/16 con `archivo_url`). Por tanto **no había fuga pública activa de facturas** — el riesgo era latente. El único bucket público real con datos es **`proyecto-documentos`** (módulo presupuestos) → **abordado en PR A2-bis** (2026-06-22): visor firmado + migración `202606192300` (políticas `authenticated`, RLS tabla `authenticated`, bucket privado), que se aplica post-merge tras verificar el visor en producción.
  > - **Bucket `facturas` privado** creado de origen (migración `202606192000`), columna **`storage_path`** en `facturas_recibidas`, y política RLS de `SELECT` en `storage.objects` para que los autenticados puedan **firmar URLs temporales**. La subida la realiza la Edge Function con service role (bypassa RLS) → no se crea política de escritura para el cliente (mínimo privilegio).
  > - **Persistencia real corregida**: `procesar-factura` ahora guarda `storage_path` (ya no intenta una URL pública). **Requiere redeploy.**
  > - **Acceso al PDF centralizado**: `resolveFacturaPdfSource(factura)` (puro: `storage_path` > `archivo_url` legado > nada, en `lib/facturaPdf.ts`) + `getFacturaPdfUrl()` async que firma una URL temporal (1 h). Visor `FacturaModal` con estados loading/error/reintento; el botón "abrir" del panel firma una URL fresca al clic. Facturas antiguas sin PDF mantienen la zona de drop manual (sin cambio).
  > - **Sin backfill** (0 facturas con `archivo_url`). **No toca** workflow, estados, aprobaciones ni notificaciones. **No incluye** `proyecto-documentos`, pagos parciales, justificantes, Gmail ni Drive.

  > **Pagos de factura (PR C, 2026-06-19).**
  >
  > - **Libro de tesorería** `factura_pagos` (append-only) + **`factura_incidencias`** (descuadres, ciclo `resuelta`), distinto de `presupuesto_pagos` (presupuesto, base imponible). Referencia de pago = **`total_a_pagar`** (= total − retención). Ambas tablas **RLS SELECT-only**; toda escritura por RPC.
  > - **Estado de pago DERIVADO** (NO toca el enum de `facturas_recibidas.estado`): `sin_pagos | pago_parcial | pagada | sobrepagada | descuadrada`, con `TOLERANCIA_PAGO_EUR = 0,50 €`. Lógica pura en `lib/facturaPagos.ts` (espejo de la RPC).
  > - **RPC `registrar_pago_factura`** (security definer, atómica): actor server-side; **solo Alicia** (o single-operator); estados `pendiente_pago` (normal) y `pagada` (solo `regularizacion`); pago + auditoría `registra_pago` + incidencia `sobrepago`/`infrapago` (un pago parcial **no** es incidencia) + transición a `pagada` dentro de tolerancia + sync del `presupuesto_pago` vinculado. RPC `resolver_incidencia_factura` (+ `resuelve_incidencia`). `accion` de `factura_aprobaciones` ampliada (`+registra_pago`/`crea_incidencia`/`resuelve_incidencia`).
  > - **Justificantes** en el bucket privado `facturas` (`recibidas/{fid}/pagos/{pid}/{file}`), política Storage **`INSERT` acotada** a ese prefijo (sin `UPDATE`/upsert), apertura por signed URL. `pago_id` generado en cliente para casar la ruta; subida → RPC (riesgo de huérfano documentado). **No toca la Edge Function.**
  > - UI: sección **"Pagos"** en el panel de factura. **No incluye** OCR de justificantes, conciliación, Gmail, Drive, notificaciones, recurrentes/domiciliaciones ni `proyecto-documentos`.

  > **Archivo en Google Drive (PR D, 2026-06-22).**
  >
  > - **Drive = archivo SECUNDARIO** (Supabase Storage sigue siendo la fuente operativa; si Drive falla no rompe OCR/pagos/estados/trazabilidad). **Service Account + Shared Drive** (server-to-server, sin tokens personales ni caducidad). Edge Function **`archivar-en-drive`** (Deno): JWT RS256 del SA → token → estructura idempotente `Contabilidad/{Sociedad}/{Año}/{Mes}/{fecha}_{prov}_{num}/` → descarga de `facturas` (service role) → subida; guarda `drive_file_id/web_link/estado`. Idempotente (`drive_file_id` presente → no re-sube). **Requiere deploy + secrets post-merge.**
  > - **Migración `202606192400`**: columnas `drive_*` en `facturas_recibidas` y `factura_pagos`. Builder puro `lib/drivePaths.ts` (espejo de la Edge Function, testeado).
  > - UI "Archivo en Drive" en el panel + **auto-archivo al pasar a `pagada`** (best-effort). Secrets de Google **solo en la Edge Function** (`.sa-key.json` gitignored). **No incluye** Gmail, notificaciones, recurrentes, OCR de justificantes ni `proyecto-documentos`.

  > **Sociedad receptora correcta (PR D.1, 2026-06-22).**
  >
  > - **Fallo corregido**: el OCR detectaba bien el receptor pero la factura se asignaba a `sociedades[0]` (la primera de la lista) cuando el NIF no casaba por formato (`B93626158` vs `B-93626158`), archivándose en Drive bajo la sociedad equivocada. **Eliminado el fallback**: sin match único → factura **pendiente de validar**, nunca una sociedad por defecto.
  > - **Mapeo NIF** en módulo puro `lib/sociedadMatch.ts` (`normalizeNif` = mayúsculas + sólo `A-Z0-9`; match **único**), replicado en la Edge Function `procesar-factura` (**requiere redeploy**). `sociedad_id_ref` pasa a **nullable**; nueva columna **`sociedad_validada`** (`false` = pendiente); migración **`202606192500`** (las facturas históricas quedan `validada=true`).
  > - **RPC `cambiar_sociedad_factura`** (security definer, atómica, actor server-side): reasigna sociedad, marca `sociedad_validada=true` e inserta evento **`cambia_sociedad`** con CIF anterior/nuevo (auditado, no en `notas`).
  > - **UI** panel "Sociedad receptora": sociedad vinculada + CIF, receptor OCR + NIF, alerta de discrepancia, selector de reasignación (vía RPC) y preview de la ruta de Drive. **Bloquea** el visto bueno y el archivo en Drive mientras la sociedad esté pendiente.

  > **Proveedores recurrentes / reglas de facturación (PR E, 2026-06-23).**
  >
  > - **Tabla `proveedores_reglas`** (migración `202606230900`) anclada a **`(contacto_id, sociedad_id_ref)`**: sociedad concreta = regla específica; `null` = regla **global** del proveedor (fallback). Índices únicos parciales (una activa por sociedad + una global por contacto), RLS `authenticated`, `updated_at` por trigger. Columnas aditivas en `facturas_recibidas`: `es_domiciliada`, `regla_aplicada_id`.
  > - **Solo SUGERENCIAS en v1** (decisión Guille): nada se auto-valida/aprueba/paga; `auto_validar` INERTE; `requiere_aprobacion_javi` solo **aviso** (no toca la RPC de aprobaciones). Lógica pura `lib/proveedorReglas.ts` (selección específica>global, sugerencias, alerta de importe con `importe_habitual`+`tolerancia_importe_pct`, sub-estado domiciliada). **No se toca `procesar-factura`**: las reglas se aplican como sugerencias en el cliente al abrir la factura. La regla **nunca** pisa una sociedad validada (PR D.1).
  > - **Domiciliadas**: sin estados nuevos. Sub-estado **DERIVADO** `pendiente_cargo | cargada_sin_justificante | pagada`; el cargo se registra como `factura_pago` con `metodo_pago='domiciliacion'` (RPC existente) → `pagada` → Drive archiva igual. Sin pago automático.
  > - **UI**: card "Sugerencias del proveedor" + "Crear regla desde esta factura" + toggle/banner domiciliada en el panel; **Contactos › Reglas de facturación** (CRUD por proveedor); filtro/badge "Domiciliadas · pendientes de cargo" en la lista. **No incluye** Gmail, conciliación bancaria, paquete gestoría, notificaciones ni routing real de Javi.

  > **Importación de extractos bancarios (PR F, 2026-06-23).**
  >
  > - **Extiende** la infraestructura existente (`movimientos_bancarios`, parsers `lib/csvParsers.ts`, categorización `lib/categorizacion.ts`, vista `MovimientosBancarios`) en vez de duplicarla. **Solo importa y normaliza**: no concilia.
  > - **Nueva tabla `extractos_bancarios`** (migración `202606231000`): sociedad/cuenta/banco/IBAN/mes-año/archivo + `archivo_hash` + métricas + rango + **estado** (`importado|pendiente_revision|listo_conciliacion|deshecho`). Columnas aditivas en `movimientos_bancarios`: `extracto_id`, `hash`, `referencia`, `tipo_movimiento`, `cuenta_bancaria_id`.
  > - **Dedup doble hash**: `archivo_hash` (fichero) + `hash` por fila `sha256(sociedad|iban|fecha|importe|concepto_norm|saldo|referencia)`, ambos con índice único parcial. Lógica pura `lib/extractoImport.ts` (canónico + Web Crypto + adaptador XLSX→filas con `xlsx` lazy + rango/avisos). `movimientos_bancarios` estaba vacía → sin backfill.
  > - **RPC `importar_extracto_bancario`** (atómica, security definer): crea extracto + inserta no-duplicados (`on conflict por hash`) + devuelve `{total,importados,duplicados,errores,extracto_id,ya_importado}`. **RPC `deshacer_importacion_extracto`**: borra movimientos del extracto + marca `deshecho` (soft, sin CASCADE).
  > - **UI**: pestañas Movimientos/Extractos; importador CSV/XLSX con cuenta+mes/año y preview (total/nuevos/duplicados/rango/avisos); lista de extractos con estado, filtro por extracto y deshacer. **No toca** OCR, Drive, Gmail, pagos, facturas ni conciliación. **Fase 2**: Norma 43, PDF-OCR, conciliación, gestoría.

- `presupuestos` ✅ — Módulo de presupuestación y tesorería forward (Fase 5). **5 vistas:**
  - **Dashboard** — KPIs (presupuestos activos, pagos próximos 30d, total presupuestado, vencidos), próximos 5 pagos, grid de presupuestos activos con barra de progreso.
  - **Calendario de Pagos** — Cronograma mensual de todos los pagos con filtros de horizonte (3m/6m/12m/todo), tipo (gasto/ingreso) y estado. Saldo previsto (ingresos − gastos pendientes). Acción inline marcar pagado.
  - **Mis Presupuestos** — Lista filtrable con progress bars. Detalle jerárquico completo: capítulos → partidas → pagos. Gestión inline de toda la jerarquía. Transiciones de estado borrador→activo→cerrado.
    **Modelo de pagos:** los `presupuesto_pagos` se pueden generar de dos formas: (1) vinculando una factura recibida a una partida desde el módulo de Contabilidad; (2) al crear una **partida recurrente** — el sistema genera automáticamente los pagos individuales según la frecuencia y el rango de fechas. Botón Home en sidebar para volver al OS.
  - **Nuevo Presupuesto** — 5 tipos con descripción contextual (obra, explotación, capex, corporativo, tesorería).
  - **Tesorería forward** — Posición neta proyectada consolidando tres fuentes sin doble conteo.
    - **Multi-sociedad**: selector de pills (toggle individual + "Todas"). Refetch automático al cambiar.
    - **Horizonte temporal**: tabs 7d / 15d / 30d / 60d / 90d / 6m / 12m / Todo.
    - **KPIs**: Caja disponible · Salidas Nd · Entradas Nd · Posición neta (déficit/superávit).
    - **Alertas**: sección de vencidos sin pagar (pasados) + aviso de posición negativa futura + aviso de ítems sin sociedad.
    - **Desgloses**: por sociedad (salidas/entradas/neto) y por fuente (presupuestos / vencimientos / facturas).
    - **Anti-doble conteo**: facturas ya vinculadas a un `presupuesto_pago_id` no aparecen en la rama de facturas.
    - **Derivación de sociedad**: un presupuesto creado desde un proyecto hereda `proyectos.sociedad_tenedora` automáticamente sin pedirla al usuario (`COALESCE` en la vista SQL).
      **Presupuesto de Ingresos** (añadido sesión 2026-06-05): tab "Presupuesto Ingreso" separada de "Presupuesto Gasto" en cada proyecto. Misma estructura jerárquica (capítulos → partidas → pagos). Columna `categoria` en `presupuestos` (`gasto`|`ingreso`). Columna `factura_emitida_id` en `presupuesto_pagos` para vincular cobros a facturas emitidas (ciclo UI pendiente).
      **Recurrencia automática** (añadido sesión 2026-06-05): al crear una partida se puede activar recurrencia (mensual/trimestral/semestral/anual) con fecha de primer y último pago. La API genera los pagos automáticamente, distribuyendo el importe a partes iguales. Preview en tiempo real en el formulario.
      **Datos en Supabase (4 tablas + vista consolidada):** `presupuestos` (+`categoria`), `presupuesto_capitulos`, `presupuesto_partidas` (+`recurrencia`, `fecha_inicio_recurrencia`, `fecha_fin_recurrencia`), `presupuesto_pagos` (+`factura_emitida_id`). FK bidireccional: `facturas_recibidas.presupuesto_pago_id` ↔ `presupuesto_pagos.factura_recibida_id`. Vista `compromisos_tesoreria` consolida pagos + vencimientos + facturas con derivación de sociedad. Puerto 5176. Exporta `PresupuestosDashboard`.
- `proyectos` ✅ — Dashboard de proyectos del holding (migrado Fase 1). Vista de
  tarjetas por proyecto con KPIs (capital expuesto, valoración, margen) y detalle
  individual. Puerto 5175. Exporta `ProyectosDashboard`.

**Módulos futuros (roadmap):**

- `tesoreria` — Posición de tesorería en tiempo real.
- `contratos` — Repositorio y vencimientos.
- `socios` — Reportes a socios (Reporte de Semana automatizado).
- `salud` (CENS) — Si el proyecto de salud requiere herramienta dedicada.

_El módulo `financiero` y `contabilidad` consumen datos exclusivamente de Supabase.
El módulo `proyectos` aún consume el CF Worker — su migración a Supabase es trabajo de Fases siguientes._

### Packages (`packages/*`)

| Package                   | Propósito                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@alsari/ui`              | Design system: GlassPanel, KPICard, Button, Sidebar, etc.                                                                                                               |
| `@alsari/utils`           | Utilities puras: `formatCurrency`, `cn`, cálculos financieros                                                                                                           |
| `@alsari/types`           | Tipos compartidos: entidades, schemas Zod canónicos. Incluye `SociedadContabilidad` (ficha legal completa) y `CuentaBancariaSociedad` (cuentas bancarias por sociedad). |
| `@alsari/supabase-client` | Punto único de acceso a Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `getJwt()` (auth bridge), `sbUrl()`, `sbHeaders()`                                               |
| `@alsari/config`          | Configs compartidas: TS base, ESLint, Tailwind preset, env Zod                                                                                                          |

### Services (`services/`)

| Carpeta                | Propósito                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workers/cf-api/`      | **CF Worker (Wrangler v3)** — backend operativo de Fase 2. Lee Google Sheets vía JWT de service account, gestiona ingesta IMAP de facturas con Gemini, sube a Drive, envía emails vía sidecar. Puerto `8787` en local. `GCP_PRIVATE_KEY` en `.dev.vars` (gitignored).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `python/`              | **Sistema RAG (Streamlit + LangChain + OpenAI + pgvector)** — base de conocimiento vectorial del holding sobre Supabase. Scheduler para ingestas periódicas, scripts de mantenimiento. `.env` local (gitignored) con credenciales.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `supabase/migrations/` | Migraciones SQL versionadas. **Importante:** el directorio `supabase/migrations/` que gestiona el Supabase CLI está vacío por diseño — las migraciones reales del proyecto están en `services/supabase/migrations/` y se aplican **manualmente** con `supabase db query --linked < archivo.sql` o `npx supabase db query --linked "SQL..."`. El comando `supabase migration list --linked` devuelve tabla vacía; no es un error. Para saber qué está aplicado hay que comparar contra los archivos en `services/supabase/migrations/`. `20260518*`: libro mayor y datos maestros. `20260519*`: detalle proyecto y patrimonio. `20260520*`: vencimientos, cashflow, sumas y saldos, CAPEX activos. `20260521*`: módulo contabilidad completo (movimientos, facturas, asientos, plan cuentas, reglas, reconciliación, OCR workflow). `20260522*`: ficha legal de sociedades (domicilio, email, teléfono, logo_url) + tabla `cuentas_bancarias_sociedad` + campos de pago en `facturas_emitidas`. `20260525*`: módulo presupuestos (4 tablas + FK en facturas_recibidas). `20260526*`: correcciones ciclo de vida factura↔pago (FK bidireccional, default correcto en `presupuesto_pago_id`). `20260601*`: añade tipo `pignorado` al CHECK de `vencimientos`, inserta 3 tramos fondos pignorados Santander. `20260602*`: añade columna `es_entrada` (bool, default false) a `vencimientos`, marca pignorados como entradas. `20260604*`: (1) limpia columna `sociedad_id_ref` duplicada en vencimientos, añade `recurrencia` a `presupuesto_partidas`; (2) reconstruye `compromisos_tesoreria` con 4 bugs corregidos — columna de sociedad en vencimientos, derivación COALESCE desde proyecto, dirección `es_entrada`, eliminación del filtro de fecha pasada. Añade campos de trazabilidad: `es_entrada`, `estado`, `fuente`, IDs de origen. `20260605*`: (0) tabla `vencimiento_sociedades` con RLS + índices; (1) datos de distribución por sociedad de todos los vencimientos existentes; (2) vista `cashflow_consolidado` unificando flujos + vencimientos distribuidos por porcentaje; (3) reconstrucción de `flujos_proyecto_consolidados` con COALESCE sociedad, estados `estimado/confirmado/facturado`, exclusión de `sin_fecha`; (4) columna `categoria` en `presupuestos`, `factura_emitida_id` en `presupuesto_pagos`. `20260610*`: añade `'prestamo'` al CHECK constraint de `vencimientos.tipo` (la migración existía en el repo pero no estaba aplicada al remoto — causaba HTTP 400 al crear/editar vencimientos de tipo préstamo). Aplicadas vía `supabase db query --linked` (CLI v2.103+ conectado al proyecto remoto — no requiere PAT, usa sesión del CLI). `20260611*`: añade columnas `fecha_inicio_inversion DATE` y `tae_declarada NUMERIC(6,3)` a `activos_patrimonio` — resuelve PGRST204 al insertar activos de fondo o cotizado. |
| `supabase/functions/`  | Edge Functions (TypeScript, Deno runtime). `procesar-factura`: OCR de facturas PDF/imagen con Claude Vision → crea `borrador_ocr` en BD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `integrations/`        | MCPs, conectores externos (Gmail, Drive, etc.) — pendiente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Capa Claude (`.claude/`)

Esta capa hace que Claude Code opere de forma consistente:

| Subcarpeta              | Función                                        |
| ----------------------- | ---------------------------------------------- |
| `CLAUDE.md`             | Constitución detallada del agente              |
| `settings.json`         | Config central (hooks, permisos, MCPs)         |
| `skills/`               | Conocimiento on-demand auto-cargado            |
| `agents/`               | Subagents con contexto aislado                 |
| `hooks/`                | Scripts shell ejecutados en eventos del agente |
| `commands/`             | Slash commands custom                          |
| `docs/ways-of-working/` | Reglas técnicas detalladas                     |

---

## 🔄 Flujos clave

### 1. Arranque y autenticación (Fase 2)

```
Usuario abre la app en /
  → middleware.ts intercepta la request
  → createServerClient(@supabase/ssr) lee cookies de sesión
  → Si NO hay sesión → redirect a /login
      → /login renderiza fuera del route group (app) → sin AppShell
      → LoginForm.tsx llama supabase.auth.signInWithPassword()
      → On success → router.push('/financiero') + router.refresh()
  → Si HAY sesión y el usuario va a /login → redirect a /financiero
  → Si HAY sesión → route group (app)/layout.tsx envuelve en <AppShell>
      → AppShell muestra BootScreen 2.5s, luego sidebar + main
      → OSSidebar siempre w-16 (icon-only): Financiero, Contabilidad + Salir
```

**Logout:** `AppShell.handleLogout()` llama `supabase.auth.signOut()` y empuja a `/login`.

**Clientes Supabase:**

- `lib/supabase/client.ts` — browser (`createBrowserClient`).
- `lib/supabase/server.ts` — server-side, cookies de Next.js (`createServerClient`).

**Auth bridge para módulos Vite (`window.alsariToken`):**
`@supabase/ssr` almacena la sesión en cookies HTTP, no en `localStorage`. Los módulos Vite embebidos (importados como paquetes workspace en el host) no pueden acceder a esas cookies directamente. Solución:

- `AppShell.tsx` expone el access token en `window.alsariToken` tras cada `onAuthStateChange`.
- Los módulos leen `getJwt()` de `@alsari/supabase-client`, que busca primero en `window.alsariToken` y hace fallback a `localStorage`.
- Esto evita que cada módulo necesite gestionar su propia sesión Auth.
- **Regla:** cualquier módulo nuevo que haga queries a Supabase debe usar `getJwt()` — nunca leer `localStorage` directamente.

### 2. Carga de un módulo

```
Usuario está en / (home launcher) o expande sidebar
  → Click en card "Financiero" (home) o item del sidebar
  → apps/host navega a /financiero
  → Sidebar se auto-colapsa (overlay desaparece)
  → Lazy load del módulo (code split)
  → Suspense muestra skeleton mientras carga
  → Error Boundary envuelve el módulo
    → Si el módulo falla en render → fallback panel + el resto del OS sigue vivo
    → Si el módulo funciona → renderiza su UI
```

### 3. Query a Supabase desde un módulo

```
Componente del módulo financiero quiere "ingresos del Q4 por entidad"
  → Llama a hook `useMonthlyRevenue()` (en src/hooks/)
  → Hook llama a `getMonthlyRevenue()` (en src/api/)
  → API usa cliente compartido `@alsari/supabase-client`
  → Supabase aplica RLS (filtra por permisos del usuario)
  → Datos vuelven, se parsean con Zod, se cachean
  → Hook devuelve { data, loading, error }
```

### 4. Sesión de trabajo con Claude

```
Guille abre Antigravity en la carpeta del proyecto
  → Claude Code lee CLAUDE.md raíz → delega a .claude/CLAUDE.md
  → SessionStart.sh hook imprime estado del repo
  → Claude carga skills relevantes según el contexto
  → Guille escribe la tarea
  → Antes de cada tool call → PreToolUse.sh decide si permitir
  → Después de cada edición → PostToolUse.sh formatea
  → Si Guille corrige a Claude → entrada en lessons-learned/log.md
  → Al cerrar → Stop.sh recuerda registrar lecciones pendientes
```

---

## 🌐 Dependencias externas

| Servicio              | Uso                                                                | Sensibilidad              |
| --------------------- | ------------------------------------------------------------------ | ------------------------- |
| **Supabase**          | BD + Auth + Storage + Edge Functions                               | Alta (datos del holding)  |
| **GitHub**            | Repositorio privado, CI/CD                                         | Alta (código propietario) |
| **Vercel**            | Hosting del Host OS — `https://alsari-capital-os-host.vercel.app/` | Media                     |
| **Anthropic API**     | Claude embebido en módulos (futuro)                                | Media (API key)           |
| **Resend** (opcional) | Emails transaccionales                                             | Media                     |

---

## 📊 Estado actual de implementación

> **Esta sección es la "fotografía" del proyecto en cada momento.**

| Componente                                     | Estado           | Notas                                                                                                                                                                                                               |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estructura del monorepo                        | ✅ Creado        | apps/ + packages/ + services/                                                                                                                                                                                       |
| Ways of Working                                | ✅ Documentado   | 10 archivos en `.claude/docs/ways-of-working/`                                                                                                                                                                      |
| Claude Skills                                  | ✅ Creado        | 5 skills auto-cargadas                                                                                                                                                                                              |
| Hooks de Claude                                | ✅ Creado        | 4 scripts shell activos                                                                                                                                                                                             |
| Subagents                                      | ✅ Creado        | 4 agents listos para invocar                                                                                                                                                                                        |
| Slash commands                                 | ✅ Creado        | 4 commands disponibles                                                                                                                                                                                              |
| `packages/utils`                               | ✅ Completo      | `cn`, `formatCurrency`, `formatPercent`, helpers financieros                                                                                                                                                        |
| `packages/types`                               | ✅ Completo      | Tipos del holding: entidades, proyectos, facturas, workspace                                                                                                                                                        |
| `packages/ui`                                  | ✅ Completo      | GlassPanel, KPICard, Button, Sidebar — Quiet Luxury Dark                                                                                                                                                            |
| `apps/host`                                    | ✅ Completo      | Next.js 15: boot, home launcher, sidebar expandable, login, middleware                                                                                                                                              |
| `apps/host/public/logo.png`                    | ✅ Añadido       | Logo crema Alsari Capital (sidebar + home)                                                                                                                                                                          |
| `apps/modules/financiero`                      | ✅ Completo      | 5 vistas, modo privado, recharts, governance docs                                                                                                                                                                   |
| `apps/modules/proyectos`                       | ✅ Completo      | Dashboard + detalle por proyecto, governance docs                                                                                                                                                                   |
| `apps/modules/contabilidad`                    | ✅ Completo      | OCR, workflow facturas, movimientos, diario, reconciliación, facturas emitidas (PDF A4), mis empresas, vincular factura↔partida con ciclo de vida acoplado, PGC completo (~220 cuentas)                             |
| `apps/modules/presupuestos`                    | ✅ Completo      | Dashboard, calendario pagos, mis presupuestos (jerarquía + recurrencia + vincular), nuevo presupuesto. Presupuesto de ingresos separado del de gastos. Pagos generados desde facturas o por recurrencia automática. |
| `services/supabase/functions/procesar-factura` | ✅ Desplegado    | Claude Vision OCR → borrador BD                                                                                                                                                                                     |
| Autenticación                                  | ✅ Completo      | Supabase Auth: middleware + login + route group (app) + window.alsariToken bridge para módulos Vite                                                                                                                 |
| Supabase: schema contabilidad                  | ✅ Aplicado      | 12 tablas, RLS, seed reglas categorización, ficha legal sociedades, cuentas bancarias                                                                                                                               |
| Supabase: schema financiero                    | ✅ Aplicado      | kpis, proyectos, sumas_saldos, vencimientos, patrimonio, vencimiento_sociedades, cashflow_consolidado                                                                                                               |
| CI/CD                                          | ✅ Configurado   | Workflow `.github/workflows/ci.yml` listo                                                                                                                                                                           |
| Deploy a producción                            | ✅ En producción | Vercel: `https://alsari-capital-os-host.vercel.app/`                                                                                                                                                                |

**Leyenda:** ✅ Completo · 🚧 En curso · ⏸️ Aplazado · ❌ No iniciado.

---

## 🔐 Modelo de seguridad

Detalle en `.claude/docs/ways-of-working/05-seguridad.md`.

**Resumen:**

- RLS activado en todas las tablas de Supabase.
- Roles: `admin`, `operator`, `viewer` (en `user_metadata.role`).
- Secrets vía variables de entorno validadas con Zod al arranque.
- Headers de seguridad en el Host OS.
- MFA obligatorio para admins.
- Hooks de Claude (`PreToolUse.sh`) bloquean accesos a `.env` y comandos peligrosos.

---

## 🎯 Decisiones arquitectónicas vigentes

| ADR  | Título                    | Estado                     |
| ---- | ------------------------- | -------------------------- |
| 0001 | Stack tecnológico inicial | ✅ Aceptado                |
| 0002 | Plan de migración Fase 1  | ✅ Completado (2026-05-16) |

---

## 🛠️ Comandos operativos

```powershell
# Desarrollo
pnpm install                                    # Instalar todo el monorepo
pnpm dev                                        # Levantar Host OS
pnpm --filter @alsari/financiero dev            # Levantar solo un módulo
pnpm build                                      # Build de todo
pnpm test                                       # Tests
pnpm lint                                       # Lint
pnpm type-check                                 # Comprobación de tipos

# Crear nuevo módulo (slash command en Claude Code)
/nuevo-modulo financiero
```

---

## 📚 Referencias

- `CLAUDE.md` (raíz) — puntero corto para Claude Code.
- `.claude/CLAUDE.md` — constitución completa del agente.
- `.claude/docs/ways-of-working/` — reglas supremas del proyecto.
- `docs/decisiones/` — ADRs.
- `docs/CHANGELOG.md` — historial de cambios.
- `docs/ROADMAP.md` — qué viene después.
