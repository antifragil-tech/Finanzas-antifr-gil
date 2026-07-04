# 01 — Workstreams · Antifrágil OS

> Definición de cada línea de trabajo: objetivo, alcance, fuera de alcance, rama, criterios
> de cierre y riesgos. El **estado** vive en [00-master-tracker.md](00-master-tracker.md);
> aquí vive la **definición**. Una línea no existe hasta que está definida aquí y trackeada allí.

---

## Reservas / Agenda

- **Objetivo:** agenda operativa de la clínica — la herramienta diaria de recepción y dirección.
- **Alcance:** Agenda Hoy (columnas por profesional, KPIs, huecos), Semana/Mes, panel lateral,
  badges, estados de cita, asistencia/no asistencia, Vivofácil (mock → cierre mensual),
  bonos/programas (F2), cobros pendientes (F2), clientes administrativos (F2).
- **Fuera de alcance:** cualquier dato clínico (ver `docs/compliance/00`), backend real
  (hasta que exista el Supabase nuevo), historia clínica, notas de evolución. El **cableado
  al host** tampoco es de esta rama: vive en Demo y se integra como PR 5a.
- **Rama esperada:** `feat/reservas-agenda-hoy` (F1) — **versión CANÓNICA del módulo (decisión
  D7)** y GATE del bloque reservas/demo. Funciona standalone (`pnpm --filter @alsari/reservas dev`).
  F2 en rama nueva `feat/reservas-fase2-*`. El spike `feat/reservas-calendario-semana` es el
  **ancestro común** de Reservas y Demo: su contenido ya vive en ambas → **se archiva** tras
  integrar F1 (no se fusiona, no se mergea).
- **Criterios de cierre F1:** push + PR Draft + checklist de revisión pasada + demo visual
  aprobada por Guille + spike archivado. **F2:** ídem + cero campos clínicos verificado.
- **Riesgos:** introducir datos clínicos por la puerta de atrás (campos libres); acoplarse a
  DayPilot sin capa de abstracción; crecer sin backend y divergir del modelo de datos del baseline.

## Demo OS

- **Objetivo:** cascarón navegable del OS para enseñar la visión (DemoShell, Sidebar, Topbar,
  Panel de Dirección, rutas mock, Demo Mode, contexto global Sociedad/Proyecto/Rol/Periodo).
- **Alcance:** presentación e interacción simulada, aislada del backend, protegida por
  `ANTIFRAGIL_DEMO_MODE` con **doble guarda anti-producción** (la flag se ignora si
  `NODE_ENV=production`; sin la flag, el host se comporta idéntico a `main`).
- **Fuera de alcance:** datos reales, backend, merge directo a `main`, y **su copia de
  `apps/modules/reservas/**`** (es el spike-ancestro sin modificar: se descarta al integrar).
- **Rama esperada:** `demo/local-antifragil-os` (PR #3 Draft, marcado NO MERGE).
- **Criterios de cierre:** NO se mergea entera (decisión D8) — se integra **partida en 4 PRs**
  tras Reservas: **5a** cableado host (`/reservas`, `ssr:false`) → **5b** shell + panel + mock →
  **5c** gating anti-producción (revisión crítica de `middleware.ts`/`layout.tsx`) → **5d** rutas
  secundarias mock con etiqueta "DATOS DE DEMOSTRACIÓN".
- **Riesgos:** que el mock se convierta en producto por inercia; reintroducir el spike viejo si
  se integra antes que Reservas (riesgo R3); que el gating rompa producción (por eso 5c va solo).

## Baseline Supabase

- **Objetivo:** esquema fundacional del Supabase **nuevo** de Antifrágil OS (baseline curado —
  decisión D4 — con hardening y runbook de aplicación).
- **Alcance:** `services/supabase/baselines/antifragil_os/` — SQL consolidado (26 tablas:
  maestro, contabilidad, banco, facturas, pagos append-only, asientos, presupuestos, tesorería,
  KPIs + RPCs + vistas + RLS ON en todo + Storage privado), `post_bootstrap_checks.sql`,
  `APPLY_RUNBOOK.md`, `ROLLBACK_NOTES.md`, `SECURITY_CHECKLIST.md`, `excluded_legacy.md`.
  Modelo **sociedad única**: seed mínimo con `Antifrágil S.C.` (`ANT`) y proyectos `CLI-PLY`
  (activo) + `9AM`/`LIDO`/`EVT` (placeholder), emails placeholder.
- **Fuera de alcance:** aplicar SQL a ningún Supabase real; tocar el Supabase legacy de Alsari
  (las ~70 migraciones de `services/supabase/migrations/` son histórico NO aplicable);
  usar Lidomare App (decisión D2); tocar `packages/supabase-client` (decisión D9).
- **Rama esperada:** `chore/db-baseline-antifragil-os`.
- **Criterios de cierre:** PR Draft revisado (diff solo bajo `baselines/antifragil_os/`,
  `SECURITY_CHECKLIST.md` revisado) + decisión de Guille sobre cuándo crear el proyecto
  Supabase real; la aplicación del SQL es un acto posterior, autorizado y documentado (runbook).
- **Riesgos:** drift repo↔BD (riesgo nº1 heredado — lección 2026-06-11: el archivo .sql en el
  repo NO garantiza que la BD lo refleje); **modo single-operator** mientras los 3 emails del
  seed sean placeholder (las RPC no exigen rol — poner emails reales antes de datos reales);
  roles `guille/javi/alicia` incrustados en las RPC (revisar mapeo para Antifrágil);
  aplicar algo "solo para probar".

## A1 Tesorería / Caja

- **Objetivo:** primer dominio funcional sobre el baseline — separar **efectivo vs banco** y
  añadir **arqueo de caja** (implementa el mini-diseño FOP-A1, doc 06 de finanzas).
- **Alcance:** `baselines/antifragil_os/a1_tesoreria/` — draft SQL con `cuenta_tesoreria`
  (caja/banco), `movimiento_caja` (ledger append-only), `arqueo_caja` (teórico vs contado,
  estados borrador/cerrado/revisado), vista unificada `movimiento_tesoreria`, saldos y resumen,
  RPCs `registrar_movimiento_caja`/`registrar_arqueo_caja`/`cerrar_arqueo_caja`, seed
  "Caja Clínica Playamar" (sin saldo). + `MODEL_DECISIONS.md`, `UI_CONTRACT.md`,
  `APPLY_A1_RUNBOOK.md`, `post_a1_checks.sql`.
- **Fuera de alcance:** el **puente `factura_pago → movimiento de tesorería`** (diferido a A1b:
  el modelo lo prepara pero nada lo rellena aún), motor PGC completo, conciliación banco↔factura,
  UI (solo contrato de datos), SQL aplicado, datos reales.
- **Rama esperada:** viaja con `chore/db-baseline-antifragil-os`; si crece, rama propia.
- **Criterios de cierre:** revisado dentro del PR de baseline; Guille valida el modelo de caja.
- **Riesgos:** mezclar caja (efectivo físico) con banco (justo lo que A1 separa); no distinguir
  fecha de cobro vs fecha de servicio (regla de oro: emisión ≠ cobro ≠ servicio).

## Integración

- **Objetivo:** que las líneas converjan a `main` en el orden correcto sin romperse entre sí.
- **Alcance:** el plan maestro del "Chat 4" vive en la rama `docs/integration-master-plan`
  (`docs/integration/00-06`: estado de ramas con genealogía, orden de PRs 1-9, matriz de
  conflictos por archivo, runbook push/PR para no expertos, checklist universal de merge,
  riesgos R1-R11, decision log D1-D11). [04-integration-order.md](04-integration-order.md)
  lo resume dentro de governance.
- **Fuera de alcance:** ejecutar merges (eso es decisión de Guille, PR a PR).
- **Rama esperada:** `docs/integration-master-plan` → push + PR Draft (sus 7 docs merecen estar
  en `main`; governance los referencia, no los sustituye). Tras mergear, el decision log de esa
  carpeta sigue vivo (las decisiones nuevas se AÑADEN, no se reescriben).
- **Criterios de cierre:** línea permanente (no se cierra); se revisa en cada merge.
- **Riesgos:** mergear en orden equivocado (Demo antes que Reservas → riesgo R3); resolver
  lockfile a mano (R2); operar git con el `.git` compartido entre 13 worktrees sin pausar al
  resto (R1); que el plan y el tracker diverjan (actualizar ambos).

## QA

- **Objetivo:** red de seguridad mínima y no destructiva para validar PRs (del "Chat 5").
- **Alcance:** `scripts/qa/` — `smoke-routes.mjs` (rutas del host contra servidor ya levantado),
  `check-no-secrets.mjs` (claves/JWT/service_role/DB_PASSWORD en diffs),
  `check-legacy-strings.mjs` (que no aparezca "Alsari"/"Pavier"/"Armia"/"Rialsa" en pantalla);
  `docs/qa/` — runbook + checklists de PR, demo, reservas y baseline. Node sin dependencias.
- **Fuera de alcance:** tests funcionales/E2E automatizados (no hay framework aún), verificación
  de lógica de negocio, QA sobre Supabase real (solo checklist), arrancar servidores.
- **Rama esperada:** `qa/smoke-suite-antifragil-os` (ya en origin, falta PR Draft).
- **Criterios de cierre:** PR Draft + los checks corren en local documentadamente; integración
  en CI es evolución posterior.
- **Riesgos:** checks que mutan estado (deben ser read-only); falsa sensación de cobertura
  (`check-no-secrets` es red de seguridad, no auditoría).

## Compliance

- **Objetivo:** blindar la frontera administrativo-operativo vs clínico ANTES de que exista
  backend con datos reales.
- **Alcance:** `docs/compliance/00` (alcance y datos permitidos/prohibidos) y
  `docs/compliance/01` (frontera Notion↔OS); checklist de producción; reglas para campos libres.
- **Fuera de alcance:** asesoría legal formal (se delega en asesor/DPO externo); implementación
  técnica de las salvaguardas (va con cada módulo).
- **Rama esperada:** viaja con governance (`docs/project-governance-antifragil-os`).
- **Criterios de cierre:** documentos revisados por Guille + validación de asesor legal/DPO
  antes de cualquier despliegue con datos reales.
- **Riesgos:** que se quede en papel — cada PR debe pasar el checklist de compliance; campos
  libres como vía de contaminación clínica.

## Facturación emitida (diseño → construcción futura)

- **Objetivo:** facturación/prefacturación del OS como motor **precontable** (decisión D1:
  la emisión fiscal oficial se delega en gestoría/software homologado; no Veri*factu propio en v1).
- **Alcance actual:** diseño (doc `docs/finanzas/02`); decisiones D1-D3 firmes; pendientes
  F4-A (quién emite), F4-B (cuenta de ingreso 705), F4-C (mapa exención con gestoría),
  F4-E (serie propia clínica).
- **Fuera de alcance:** emitir factura legal oficial; código/migraciones hasta que Guille
  autorice F4.1; tocar el módulo `contabilidad` legacy.
- **Rama esperada:** `docs/finanzas-facturacion-emitida-design` (PR #1); la construcción
  (F4.1+) abrirá ramas `feat/facturacion-*` cuando se autorice.
- **Criterios de cierre del diseño:** merge de PR #1; acta de decisiones F4-A/B/C/E.
- **Riesgos:** riesgo fiscal nº1 del sistema (exención sanitaria mal aplicada, numeración no
  correlativa, alteración de facturas emitidas); construir sin cerrar el criterio de la gestoría.

## Clínica Fase 1 — catálogos

- **Objetivo:** catálogos/maestros administrativos de la clínica (servicios, tarifas, bonos,
  programas) + tipos compartidos.
- **Alcance:** tipos `packages/types/src/clinica.ts` (+ barrel) y doc de decisión de esquema
  (`docs/reservas/05`: tablas con prefijo `clinica_*` en `public`, no schema aparte);
  catálogo comercial (nunca clínico).
- **Fuera de alcance:** historia clínica, precios con criterio fiscal definitivo (D2: sin IVA
  provisional, `exento_provisional` por producto), backend real, y **su propio SQL como
  migración activa**: `202606261000_clinica_fase1_catalogos.sql` quedó **fuera de patrón**
  (riesgo R10) al decidirse el baseline curado (D4) — se reubica/refleja en el baseline.
- **Rama esperada:** `feat/clinica-fase1-catalogos` (PR #2 Draft) — **reescribir su alcance**
  a solo tipos + doc, coordinando con la línea Baseline para absorber los catálogos.
- **Criterios de cierre:** revisión del modelo contra `docs/compliance/00` + catálogos
  reflejados en el baseline + validación de Guille.
- **Riesgos:** dos fuentes de verdad del esquema clínica si el SQL no se reubica (R10);
  filtrar terminología clínica en nombres de servicios; hardcodear tratamiento fiscal global
  (prohibido por D3: es por producto/proyecto).

## Governance (esta línea)

- **Objetivo:** que el proyecto sea gobernable desde GitHub: contexto, proceso, checklists, orden.
- **Alcance:** `SESSION.md`, `docs/governance/**`, `docs/compliance/**`, plantilla de PR.
- **Fuera de alcance:** código, Supabase, datos.
- **Rama esperada:** `docs/project-governance-antifragil-os`.
- **Criterios de cierre:** PR Draft revisado y mergeado por decisión de Guille; a partir de ahí
  es documentación viva (se actualiza, no se cierra).
- **Riesgos:** desactualización silenciosa — por eso el tracker exige actualización por sesión.

## Rebrand marca visible (Alsari → Antifrágil)

- **Objetivo:** eliminar "Alsari Capital" de la UI visible sin tocar el namespace interno.
- **Alcance actual:** 4 líneas de copy en `apps/modules/financiero` (App, DashboardLayout,
  FinancialSidebar, MaestroView). Ampliable después a otros módulos/PDF con el mismo criterio.
- **Fuera de alcance:** rebranding global `@alsari/*`, `window.alsariToken`, nombres de paquetes,
  raíz `alsari-capital-os`, `vercel.json`, lockfile (todo eso es el PR 8 diferido, decisión D10).
- **Rama esperada:** `chore/financiero-copy-antifragil`.
- **Criterios de cierre:** push + PR Draft + revisión visual. Puede integrarse **temprano**
  (PR 3 del orden): es aislado — ninguna otra rama activa toca `financiero`.
- **Riesgos:** mínimos; vigilar únicamente que no se cuele nada de nombres de paquete.
