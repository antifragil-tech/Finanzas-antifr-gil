# Fase 2 — Plan de adaptación del módulo `financiero` (Antifrágil = 1 SL)

> **Estado:** Plan (diseño). **Aún sin ejecutar — requiere OK de Guille antes de tocar código.**
> **Rama:** `docs/finanzas-contabilidad-antifragil-audit`
> **Fecha:** 2026-06-26
> **Depende de:** [00-auditoria...](00-auditoria-base-financiera-antifragil.md) · [01-modelo-conceptual...](01-modelo-conceptual-antifragil.md)
> **Decisiones aplicadas:** SL única (`Grupo Empresarial Antifrágil SL`) · solo proyecto Clínica activo · jubilar patrimonio personal · tesorería separa efectivo/banco.

---

## Objetivo

Dejar el módulo `financiero` reflejando **"Antifrágil = una SL con varios proyectos"**: sin carcasa de doble holding, sin patrimonio personal, con nombres visibles de Antifrágil. **Cambios mínimos y sin romper** el motor que se conserva.

**Naturaleza del trabajo:** poda + renombrado visible + simplificación de la consolidación. **NO se toca** el motor PGC, cashflow, vencimientos ni presupuestos, **ni** los paquetes `@alsari/*` (sin rebrand, decisión de Guille).

_(Líneas exactas: ver el anexo del audit `00`; aquí se listan los archivos confirmados por búsqueda en código.)_

---

## A. Jubilar — quitar de la navegación

| Archivo                                   | Qué es                                                        | Acción                                                                              |
| ----------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/components/views/PersonaView.tsx`    | Patrimonio personal de los socios (Javier/Iván)               | **Quitar** de rutas/sidebar                                                         |
| `src/components/CorporateMap.tsx`         | Mapa societario familiar (personas → holdings → filiales)     | **Quitar** (con 1 SL no aplica)                                                     |
| `src/components/views/PatrimonioView.tsx` | Gestión de activos patrimoniales (personales + societarios)   | **Ocultar** por defecto; revisar si la SL tiene algún activo que interese conservar |
| `src/components/views/NAVSection.tsx`     | Valoración NAV / TIR-MOIC de salida de proyectos de inversión | **Ocultar** para proyectos operativos                                               |

## B. Simplificar — quitar lógica de doble holding (sociedad única)

| Archivo                                                                                                               | Cambio                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                                                                                                         | Quitar detección `pavier`/`armia` por nombre, IDs `javier_alarcon`/`ivan_alarcon` y el consolidado "Alsari Capital". Selector = la SL + sus proyectos |
| `src/components/views/Overview.tsx`                                                                                   | Quitar `flattenSociety` / look-through de %. KPIs directos de la SL + **desglose por proyecto**                                                       |
| `src/components/DashboardLayout.tsx`                                                                                  | Quitar `PERSONA_IDS`. Header visible → "Antifrágil"                                                                                                   |
| `src/components/views/EntidadesView.tsx`, `.../SociedadDetail.tsx`, `.../MaestroView.tsx`, `src/lib/maestroParser.ts` | Quitar columnas/lógica `pct_pavier`, `pct_armia`, `parent_sociedad_id` con %                                                                          |
| **SQL** `cashflow_consolidado`, `flujos_proyecto_consolidados`, `vencimiento_sociedades`                              | Con 1 sociedad, la distribución por % deja de tener sentido → **simplificar las vistas** (migración aparte, aplicada a mano por Dashboard)            |

## C. Renombrar visible (solo UI — NO `@alsari/*`)

| De                                                                                   | A                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| "Alsari Capital" / "ALSARI CAPITAL" (header, breadcrumb, sociedad por defecto, logo) | "Antifrágil" / "Grupo Empresarial Antifrágil SL" |

## D. Conservar intactos (no tocar)

`src/lib/pgcEngine.ts`, `.../views/BalanceView.tsx`, `.../BssSaldosSection.tsx`, `.../HistoricoKpisSection.tsx`, `.../CashflowView.tsx`, `.../VencimientosView.tsx`, `.../Contabilidad.tsx`, `.../Workspace.tsx`, `.../ProjectView.tsx`, `.../ProyectoDetail.tsx` (estos dos para proyectos **operativos**).

---

## Datos (frontera Fase 2/3)

Dar de alta en BD (migración manual por Dashboard, según lección del repo):

1. **`sociedades`** → `Grupo Empresarial Antifrágil SL` (CIF real, único registro de sociedad de Antifrágil).
2. **`proyectos`** → `Clínica Antifrágil Playamar`, `sociedad_tenedora` = la SL anterior, `estado='activo'`.

_(9 A.M./Eventos, Lido Pro, Antifrágil OG: no se dan de alta todavía; el modelo los admite cuando toque.)_

---

## Requisito de tesorería (efectivo vs banco)

Se diseña/implementa en **Fase 3**, pero se anota aquí porque condiciona el PGC: hoy `pgcEngine.ts` mapea `570x` a un único "caja" mezclando **caja física (570)** y **bancos (572)**. En Fase 2 se deja preparado para **separarlos**; en Fase 3 se añade el `medio` (efectivo/banco) a cobros/pagos y el **arqueo de caja** diario. Ver §3 de `01`.

---

## Riesgos a vigilar

1. **Tailwind `content`** debe incluir `apps/modules/*/src` (lección 2026-05-17): al tocar UI, no romper la generación de CSS.
2. **La consolidación vive también en SQL** (vistas): simplificar UI y SQL **coordinadamente** o quedan datos huérfanos / KPIs descuadrados.
3. **Drift repo ↔ BD** (lección 2026-06-11): auditar paridad del schema remoto **antes** de aplicar migraciones.
4. **No romper imports** al quitar vistas: revisar rutas y el sidebar que las referencian.

---

## Orden sugerido de ejecución (cuando Guille dé OK)

1. Alta de **SL + proyecto Clínica** (datos).
2. **Renombrado visible** a Antifrágil (bajo riesgo).
3. **Poda** de vistas personales (PersonaView, CorporateMap, PatrimonioView).
4. **Simplificación** de la consolidación (UI + SQL coordinados).

**Entregable Fase 2:** PR pequeño de UI (+ migración SQL de simplificación si aplica), tras validación de Guille.

---

_Plan de Fase 2. No modifica código productivo todavía. Requiere validación de Guille antes de ejecutar._
