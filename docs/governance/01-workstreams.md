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
  (hasta que exista el Supabase nuevo), historia clínica, notas de evolución.
- **Rama esperada:** `feat/reservas-agenda-hoy` (F1); F2 en rama nueva `feat/reservas-fase2-*`.
  Spike `feat/reservas-calendario-semana` pendiente de fusionar o descartar.
- **Criterios de cierre F1:** push + PR Draft + checklist de revisión pasada + demo visual
  aprobada por Guille. **F2:** ídem + cero campos clínicos verificado.
- **Riesgos:** introducir datos clínicos por la puerta de atrás (campos libres); acoplarse a
  DayPilot sin capa de abstracción; crecer sin backend y divergir del modelo de datos del baseline.

## Demo OS

- **Objetivo:** cascarón navegable del OS para enseñar la visión (DemoShell, Sidebar, Topbar,
  Dashboard, rutas mock, Demo Mode, contexto global Sociedad/Proyecto/Rol/Periodo).
- **Alcance:** presentación e interacción simulada, aislada del backend.
- **Fuera de alcance:** datos reales, backend, merge directo a `main`.
- **Rama esperada:** `demo/local-antifragil-os` (PR #3 Draft, marcado NO MERGE).
- **Criterios de cierre:** NO se cierra mergeando tal cual — se cierra **re-montando** sus piezas
  reutilizables (shell, contexto global) sobre el módulo canónico de Reservas ya integrado.
- **Riesgos:** que el mock se convierta en producto por inercia; fijar contratos de rutas falsos;
  divergencia creciente con Reservas mientras espera.

## Baseline Supabase

- **Objetivo:** esquema fundacional del Supabase **nuevo** de Antifrágil OS (baseline curado,
  hardening, runbook de aplicación).
- **Alcance:** SQL versionado en repo, decisiones de modelo, contrato UI↔DB, RLS desde el
  primer día, runbook de aplicación manual.
- **Fuera de alcance:** aplicar SQL a ningún Supabase real; tocar el Supabase legacy de Alsari;
  usar Lidomare App; tocar `packages/supabase-client`.
- **Rama esperada:** `chore/db-baseline-antifragil-os`.
- **Criterios de cierre:** PR Draft revisado + decisión de Guille sobre cuándo crear el proyecto
  Supabase real; la aplicación del SQL es un acto posterior, autorizado y documentado (runbook).
- **Riesgos:** drift repo↔BD (riesgo nº1 heredado — lección 2026-06-11: el archivo .sql en el
  repo NO garantiza que la BD lo refleje); RLS permisiva por prisas; aplicar algo "solo para probar".

## A1 Tesorería / Caja

- **Objetivo:** primer dominio funcional sobre el baseline — modelo de tesorería y caja diaria
  (decisiones de modelo, contrato UI, runbook), como draft dentro del baseline.
- **Alcance:** diseño de tablas/vistas/contratos; nada aplicado.
- **Fuera de alcance:** UI final, SQL aplicado, datos reales.
- **Rama esperada:** viaja con `chore/db-baseline-antifragil-os`; si crece, rama propia `feat/a1-tesoreria-caja`.
- **Criterios de cierre:** revisado dentro del PR de baseline; Guille valida el modelo de caja.
- **Riesgos:** mezclar caja (efectivo físico) con banco; no distinguir fecha de cobro vs fecha
  de servicio (regla de oro de finanzas: emisión ≠ cobro ≠ servicio).

## Integración

- **Objetivo:** que las líneas converjan a `main` en el orden correcto sin romperse entre sí.
- **Alcance:** orden de integración (ver [04-integration-order.md](04-integration-order.md)),
  política de lockfile, matriz de dependencias entre PRs.
- **Fuera de alcance:** ejecutar merges (eso es decisión de Guille, PR a PR).
- **Rama esperada:** el contenido vive en governance; la rama histórica
  `docs/integration-master-plan` queda para archivar o reconvertir.
- **Criterios de cierre:** línea permanente (no se cierra); se revisa en cada merge.
- **Riesgos:** mergear en orden equivocado (Demo antes que Reservas); resolver lockfile a mano.

## QA

- **Objetivo:** red de seguridad mínima y no destructiva para validar PRs.
- **Alcance:** smoke routes (las rutas del host responden), verificación de no-secrets,
  verificación de no-legacy visible, checklists por tipo de PR (demo/reservas/baseline).
- **Fuera de alcance:** suite completa de tests unitarios/E2E (fase posterior); QA sobre
  Supabase real.
- **Rama esperada:** `qa/smoke-suite-antifragil-os` (ya en origin, falta PR Draft).
- **Criterios de cierre:** PR Draft + los checks corren en local documentadamente; integración
  en CI es evolución posterior.
- **Riesgos:** checks que mutan estado (deben ser read-only); falsa sensación de cobertura.

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
- **Alcance:** modelo de datos y tipos; catálogo comercial (nunca clínico).
- **Fuera de alcance:** historia clínica, precios con criterio fiscal definitivo (D2: sin IVA
  provisional, `exento_provisional` por producto), backend real.
- **Rama esperada:** `feat/clinica-fase1-catalogos` (PR #2 Draft).
- **Criterios de cierre:** revisión del modelo contra `docs/compliance/00` + validación de Guille.
- **Riesgos:** filtrar terminología clínica en nombres de servicios; hardcodear tratamiento
  fiscal global (prohibido por D3: es por producto/proyecto).

## Governance (esta línea)

- **Objetivo:** que el proyecto sea gobernable desde GitHub: contexto, proceso, checklists, orden.
- **Alcance:** `SESSION.md`, `docs/governance/**`, `docs/compliance/**`, plantilla de PR.
- **Fuera de alcance:** código, Supabase, datos.
- **Rama esperada:** `docs/project-governance-antifragil-os`.
- **Criterios de cierre:** PR Draft revisado y mergeado por decisión de Guille; a partir de ahí
  es documentación viva (se actualiza, no se cierra).
- **Riesgos:** desactualización silenciosa — por eso el tracker exige actualización por sesión.

## Rebrand marca visible (Alsari → Antifrágil)

- **Objetivo:** eliminar "Alsari Capital" de la UI/PDF visibles sin tocar el namespace interno.
- **Alcance:** strings visibles, logos, títulos.
- **Fuera de alcance:** rebranding global `@alsari/*`, `window.alsariToken`, nombres de paquetes,
  lockfile (fase de infraestructura futura).
- **Rama esperada:** `chore/financiero-copy-antifragil`.
- **Criterios de cierre:** push + PR Draft + revisión visual; se integra DESPUÉS de Reservas/Demo
  para no generar conflictos con esas ramas grandes.
- **Riesgos:** conflictos de merge con ramas activas si se integra antes de tiempo.
