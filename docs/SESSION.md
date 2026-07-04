# SESSION — Artefacto maestro de traspaso · Antifrágil OS

> **Última actualización:** 2026-07-04 · Rama: `docs/project-governance-antifragil-os`.
> **Sustituye íntegramente** al SESSION del 2026-06-12, que era herencia del repo legacy Alsari
> (referenciaba la rama `feat/ui-quiet-luxury-refresh` y un "PR #19" que **no existen en este repo**).
> **Regla de este documento:** todo lo marcado ✅ está **verificado contra Git/GitHub el 2026-07-04**;
> lo marcado ⚠️ viene del traspaso de chats anteriores y no se pudo verificar en local.
> El estado por línea de trabajo vive en [docs/governance/00-master-tracker.md](governance/00-master-tracker.md).

---

## 1. Qué es este proyecto

**Antifrágil OS** será el sistema operativo interno de Antifrágil. **No es un ERP. No es un CRM.**
Es el centro desde el que se gestionará toda la organización. Extremadamente modular:
cada módulo debe poder crecer sin romper el resto. Pensado para años.

Gestionará progresivamente: Dirección · Agenda · Recepción · Clientes administrativos ·
Profesionales · Cobros · Bonos · Programas · Tesorería · Banco · Caja · Rentabilidad ·
KPIs · Facturación · Proyectos · Finanzas · Configuración — en una misma experiencia de usuario.

### 1.1 Decisión fundamental — v1 administrativo-operativo, NO historia clínica

**Antifrágil OS v1 es administrativo-operativo.** La historia clínica queda **fuera** del sistema
(hoy en Notion; mañana, quizá, Salonized u otro software clínico externo). Antifrágil OS solo
podrá guardar un **ID/enlace externo controlado** a la historia clínica — **nunca copiar
contenido clínico**. Detalle completo y ejemplos en
[docs/compliance/00-alcance-administrativo-operativo.md](compliance/00-alcance-administrativo-operativo.md)
y [docs/compliance/01-frontera-notion-antifragil-os.md](compliance/01-frontera-notion-antifragil-os.md).

| ✅ Permitido en Antifrágil OS v1 | ❌ Prohibido en Antifrágil OS v1 |
|---|---|
| Agenda, calendario, citas, estados de cita | Historia clínica |
| Asistencia / no asistencia | Diagnósticos |
| Profesionales | Lesiones |
| Clientes administrativos | Motivo clínico concreto |
| Servicios generales | Evolución, antecedentes |
| Cobros, bonos, programas | Medicación, tratamientos |
| Origen del paciente, derivadores | Informes, pruebas |
| Vivofácil, Oasis, Lidomare | Notas clínicas |
| Facturación / cierres | Audios clínicos, imágenes clínicas |
| Tesorería, caja, banco | Documentos sanitarios |
| Rentabilidad, KPIs, proyectos, finanzas | |
| Enlace externo a Notion/Salonized/sistema clínico | |

### 1.2 Identidad y rebrand

- El producto se llama **Antifrágil OS**. Deja de llamarse Alsari (decisión de Guille, 2026-07-04).
- **PERO: no rebranding global `@alsari/*` todavía** (ver
  [orden de integración](governance/04-integration-order.md)). El scope de paquetes internos
  se renombrará en una fase de infraestructura dedicada, no ahora.
- ✅ El rebrand de **marca visible** ya empezó como línea propia: rama `chore/financiero-copy-antifragil`
  (`42edd4d — renombrar marca visible Alsari Capital -> Antifragil`).
- Dimensión medida del rebrand global pendiente (2026-07-04): `@alsari/*` = 355 ocurrencias en
  122 archivos; "Alsari Capital" visible = 34 en 18 archivos; `window.alsariToken` = 22 en 6;
  `alsari.net`/`alsari-capital` = 90 en 16 (mucho en `services/` legacy).

---

## 2. Estado técnico verificado (2026-07-04)

- **Repositorio:** `antifragil-tech/Finanzas-antifr-gil` (GitHub). ✅
- **Rama principal:** `main` — un único commit: `8d0b720 Initial commit`. ✅
- **Modelo de trabajo:** un **worktree aislado por rama** bajo `Antifragil Finanzas/` (13 worktrees activos). ✅

### 2.1 Mapa de ramas y worktrees (✅ verificado)

| Rama | Último commit | En origin | PR | Worktree |
|---|---|---|---|---|
| `main` | `8d0b720` Initial commit | ✅ | — | `Finanzas-antifr-gil` (raíz) |
| `docs/project-governance-antifragil-os` | (este PR) | ✅ | **#7 DRAFT** | `wt-governance` |
| `docs/finanzas-facturacion-emitida-design` | `6767680` Fisioterapia sin subtipo deportivo | ✅ | **#1 OPEN** | `Finanzas-antifr-gil-facturacion` |
| `feat/clinica-fase1-catalogos` | `d08058d` modelo de datos Clínica F1 | ✅ | **#2 DRAFT** | `wt-clinica-fase1` |
| `demo/local-antifragil-os` | `7854be1` sincronizar contexto global OS mock | ✅ | **#3 DRAFT / NO MERGE** | `wt-demo-local-antifragil-os` |
| `feat/reservas-agenda-hoy` | `53c233a`+ ("Agenda v0.2") | ✅ | **#5 DRAFT / NO MERGE** (creado en paralelo 2026-07-04) | `wt-reservas-agenda-hoy` |
| `feat/reservas-calendario-semana` | `4d6dc7f` spike — **ancestro común** de reservas y demo → **archivar** | ❌ sin push | — | `wt-reservas-calendario` |
| `chore/db-baseline-antifragil-os` | `6c49503`+ documentar A1 (modelo, contrato UI, runbook) | ✅ | **#4 DRAFT / NO APPLY** (creado en paralelo 2026-07-04) | `wt-finanzas-baseline` |
| `qa/smoke-suite-antifragil-os` | `4e4272c` scripts smoke no destructivos | ✅ | **#6 DRAFT** (creado en paralelo 2026-07-04) | `wt-qa-smoke-suite` |
| `docs/integration-master-plan` | `3a7cb4f` plan maestro de integración y PRs | ❌ sin push | — | `wt-integration-master-plan` |
| `chore/financiero-copy-antifragil` | `42edd4d` renombrar marca visible Alsari→Antifragil | ❌ sin push | — | `wt-finanzas-rename` |
| `docs/finanzas-contabilidad-antifragil-audit` | `2c455ff` — **subsumida byte a byte** por `docs/finanzas-modelo-operativo` → **archivar sin merge** | ❌ sin push | — | `wt-finanzas-docs` |
| `docs/finanzas-modelo-operativo` | `d429ec6` decisiones A1-D1..D5 en doc 06 | ❌ sin push | — | `wt-finanzas-modelo` |

> Nota del traspaso: la Fase 1 de Reservas se cerró en `f3a66b0` (*ajustar altura flexible para
> embed en shell*); la rama tiene commits posteriores hasta `53c233a`. ⚠️

### 2.2 Líneas de trabajo activas

**Demo OS** — `demo/local-antifragil-os` · PR #3 Draft ("NO MERGE")
DemoShell, Sidebar, Topbar, Panel de Dirección, rutas mock, Demo Mode (doble guarda
`ANTIFRAGIL_DEMO_MODE` + `NODE_ENV≠production`), contexto global Sociedad/Proyecto/Rol/Periodo.
Aislado del backend. **No se mergea entera (D8): se integra PARTIDA en 4 PRs tras Reservas**
(5a cableado host → 5b shell+panel → 5c gating → 5d rutas mock), **excluyendo** su copia de
`apps/modules/reservas/**` (spike-ancestro sin modificar, se descarta sola con el orden correcto).

**Reservas / Agenda** — `feat/reservas-agenda-hoy` — **versión CANÓNICA (D7), GATE del bloque**
Basado en DayPilot. Fase 1 operativa standalone (`pnpm --filter @alsari/reservas dev`): Agenda
Hoy, columnas por profesional, KPIs, huecos visibles, panel lateral, badges, Vivofácil mock,
Semana/Mes, height-flexible. **Sin backend; el cableado al host vive en Demo (PR 5a).**
Pendiente: push + PR Draft. El spike `feat/reservas-calendario-semana` es ancestro común →
archivar tras integrar. Fase 2 prevista: Pendientes, Cobros pendientes, Vivofácil cierre
mensual, Clientes administrativos, Bonos/Programas — **sin datos clínicos**.

**Supabase / DB** — `chore/db-baseline-antifragil-os`
**Baseline curado** (decisión D4) en `services/supabase/baselines/antifragil_os/`: SQL de
26 tablas + RPCs + vistas + RLS + Storage + seed mínimo (sociedad única **Antifrágil S.C.**
`ANT` — D5 —, proyecto **CLI-PLY** activo — D6 —, emails placeholder → modo single-operator
hasta poner los reales) + runbook de aplicación + checks post-bootstrap + `excluded_legacy.md`.
Subcarpeta `a1_tesoreria/`: draft A1 efectivo/banco/arqueo (implementa FOP-A1, doc 06 finanzas);
puente pagos→tesorería diferido a A1b.
**Nada aplicado: no SQL real, no Supabase real tocado, no claves, no datos reales.**
Pendiente: push + PR Draft.
Decisiones firmes (decision log D1-D11 del plan de integración): Supabase **nuevo y limpio**;
**no** legacy de Alsari (~70 migraciones = histórico no aplicable); **no** Lidomare App;
**no** tocar `packages/supabase-client` todavía.

**Finanzas (diseño)** — ramas de docs
- `docs/finanzas-modelo-operativo` (**PR 1 del orden de integración**): docs 00-06 completos —
  auditoría base, modelo conceptual, plan Fase 2 de adaptación de `financiero`, mapa y gaps de
  finanzas operativas (3 lentes: tesorería/rentabilidad/precontabilidad), backlog F-Op por lotes
  (A1 efectivo/banco/arqueo es el nº1) y mini-diseño técnico FOP-A1 con decisiones A1-D1..D5
  resueltas por Guille.
- `docs/finanzas-contabilidad-antifragil-audit`: **subsumida byte a byte** por la anterior
  (docs 00/01/03 idénticos) → **archivar sin merge**.
- `docs/finanzas-facturacion-emitida-design` (PR #1 OPEN): doc 02 — diseño de facturación emitida.
  Decisiones firmes tomadas (2026-06-26): **D1** el OS es precontable, NO emite factura legal
  oficial (Veri*factu delegado a gestoría → resuelve F4-D); **D2** Clínica sin IVA provisional
  (`exento_provisional`, conservando campos fiscales); **D3** tratamiento fiscal por
  producto/proyecto, nunca global. Pendientes: F4-A (quién emite), F4-B (cuenta 705),
  F4-C (mapa exención con gestoría/Ramón), F4-E (serie propia clínica).
  **F4.0 (auditoría de paridad de `facturas_emitidas`) NO abierta todavía.**
  La divergencia local/origin que anotó el plan del Chat 4 está **resuelta** (verificado hoy).

**Clínica Fase 1** — `feat/clinica-fase1-catalogos` · PR #2 Draft
Tipos `packages/types/clinica.ts` + doc de decisión (prefijo `clinica_*` en `public`).
⚠️ Su SQL de catálogos entró como **migración activa, fuera de patrón** (riesgo R10) tras
decidirse el baseline curado (D4): el PR debe **reescribir su alcance a solo tipos + doc**,
y los catálogos se reflejan en el baseline.

**Governance / Compliance** — `docs/project-governance-antifragil-os` (esta rama)
Tracker maestro, workstreams, proceso PR Draft, checklist de revisión, orden de integración,
alcance administrativo-operativo, frontera Notion↔OS, plantilla de PR.

**Integración** — `docs/integration-master-plan` (plan maestro del "Chat 4", 2026-06-30)
7 docs reales en `docs/integration/`: estado de ramas con genealogía, **orden de PRs 1-9**
(demo partido en 5a-5d, diferidos 8-9), matriz de conflictos por archivo, runbook push/PR,
checklist universal de merge, **riesgos R1-R11** y **decision log D1-D11**.
[governance/04-integration-order.md](governance/04-integration-order.md) lo resume; la rama
merece su propio push + PR Draft (es la fuente de detalle).

**QA** — `qa/smoke-suite-antifragil-os` (✅ ya existe y está en origin, sin PR) — "Chat 5"
`scripts/qa/`: `smoke-routes.mjs`, `check-no-secrets.mjs`, `check-legacy-strings.mjs`
(Node sin dependencias) + `docs/qa/`: runbook y checklists de PR/demo/reservas/baseline.

### 2.3 🔴 Alerta de seguridad pendiente (riesgo R5 del plan de integración)

`packages/supabase-client` contiene un **fallback hardcodeado** con la URL y una **anon key
real del proyecto Supabase legacy**. Decisión vigente: el fichero NO se toca (D9), pero la
**anon key legacy debe rotarse ya** en el Dashboard del proyecto legacy (acción manual, fuera
del repo, no rompe nada de esta fase). Pendiente de ejecutar por Guille/operador autorizado.

---

## 3. 🛑 REGLAS CRÍTICAS (innegociables)

1. **No tocar `main`.** Nunca directamente.
2. **No merge. No rebase. No force push.**
3. **No aplicar SQL real. No tocar el Supabase real.**
4. **No copiar claves. No subir `.env`.**
5. **No datos reales. No datos clínicos. No historia clínica** (ver §1.1).
6. **No tocar `packages/supabase-client`** hasta la fase de infraestructura.
7. **No rebranding global `@alsari/*` todavía** (solo marca visible, en su rama).
8. **Trabajar siempre en ramas/worktrees aislados.**
9. **Todo PR empieza como Draft.**
10. `pnpm-lock.yaml` se regenera con pnpm, jamás se edita a mano.

---

## 4. Flujo de trabajo con GitHub

```
1. trabajar local (worktree de la rama)
2. commit (semántico)
3. push de la rama
4. crear PR **Draft**
5. revisión
6. QA (smoke suite / checklists)
7. solo entonces, decidir merge (aprobación explícita de Guille)
```

Proceso detallado: [governance/02-pr-draft-process.md](governance/02-pr-draft-process.md) ·
Checklist de revisión: [governance/03-review-checklist.md](governance/03-review-checklist.md) ·
Plantilla: `.github/PULL_REQUEST_TEMPLATE.md`.

**PRs existentes (✅ verificado 2026-07-04 ~13:35 — los #4-#6 se crearon en paralelo por otros
chats durante esta sesión):**
- **PR #1** — `docs(finanzas): diseño de facturación emitida + decisiones` — **OPEN** (anterior a la regla de Draft).
- **PR #2** — `feat(db): Clínica Fase 1 — catálogos / modelo de datos` — **DRAFT** (alcance a reescribir: solo tipos, R10).
- **PR #3** — `demo(local): Antifrágil OS mock shell y contexto global` — **DRAFT / NO MERGE** (se integrará partido en 5a-5d).
- **PR #4** — `db: baseline Supabase Antifrágil OS + A1 Tesorería/Caja` — **DRAFT / NO APPLY**.
- **PR #5** — `reservas: Agenda v0.2 operativa para recepción` — **DRAFT / NO MERGE** (GATE del bloque).
- **PR #6** — `qa: smoke suite no destructiva` — **DRAFT**.
- **PR #7** — `governance: contexto maestro, proceso de PRs y compliance scope` — **DRAFT** (este).

**Ramas que aún necesitan push + PR Draft:**
- `docs/integration-master-plan` (plan maestro del Chat 4 — fuente del orden)
- `docs/finanzas-modelo-operativo` (posición 1 del orden del plan)
- `chore/financiero-copy-antifragil` (rebrand visible, posición 3)

---

## 5. Próximo orden de trabajo

**Orden de integración completo y justificado:** [governance/04-integration-order.md](governance/04-integration-order.md)
(resume el plan del Chat 4, `docs/integration/01-orden-prs.md`).

0. 🔴 **Seguridad** — rotar la anon key legacy (R5). Acción manual, fuera del repo, ya.
1. **Governance** — ✅ este PR (revisar; mergear cuando Guille lo apruebe). Compliance incluido
   (pendiente validación legal externa antes de producción).
2. **Pushes + PR Drafts pendientes** — `docs/integration-master-plan`,
   `docs/finanzas-modelo-operativo` (posición 1 del orden) y
   `chore/financiero-copy-antifragil` (posición 3). *(Reservas #5, baseline #4 y QA #6 ya
   tienen PR Draft, creados en paralelo durante esta sesión.)*
3. **Demo** — mantener PR #3 en Draft/NO MERGE; preparar su **partición en 5a-5d** para después
   de que Reservas esté en `main`.
4. **Clínica** — reescribir alcance del PR #2 (solo tipos + doc; SQL al baseline).
5. **Archivar** — `feat/reservas-calendario-semana` (tras PR 4) y
   `docs/finanzas-contabilidad-antifragil-audit` (ya subsumida).
6. **Reservas Fase 2** — retomar **sin datos clínicos** cuando F1 esté integrada.

*(Después, en la línea Finanzas: cerrar F4-A/B/E con Guille, F4-C con la gestoría, y abrir
F4.0 — auditoría de paridad de `facturas_emitidas` — solo cuando Guille lo autorice.)*

---

## 6. Discrepancias detectadas al escribir este traspaso (2026-07-04)

| Traspaso decía | Realidad verificada |
|---|---|
| Demo "pendiente PR Draft" | El PR #3 Draft **ya existe** (creado 2026-06-30) |
| QA era "línea prevista" (rama futura) | `qa/smoke-suite-antifragil-os` **ya existe y está en origin** (Chat 5: 3 scripts + 5 checklists) |
| Reservas cerró en `f3a66b0` | La rama avanza hasta `53c233a`; el spike `feat/reservas-calendario-semana` es su **ancestro** (archivar, no fusionar) |
| Solo PRs #1 y #2 conocidos | Existen #1, #2 y #3 |
| Demo "se integra después de Reservas" (sin más detalle) | El plan del Chat 4 la parte en **4 PRs (5a-5d)** excluyendo su copia de reservas |
| — | Existen 4 ramas más no mencionadas en el traspaso: `docs/integration-master-plan` (plan de integración completo, R1-R11 + D1-D11), `chore/financiero-copy-antifragil`, `docs/finanzas-contabilidad-antifragil-audit` (subsumida), `docs/finanzas-modelo-operativo` |
| — | El plan del Chat 4 anotaba divergencia local/origin en facturación: **ya resuelta** (verificado) |
| — | 🔴 Riesgo R5 (anon key legacy hardcodeada) documentado en el plan; **rotación aún pendiente** |
| SESSION.md anterior (2026-06-12) | Hablaba del repo legacy Alsari (rama y PR inexistentes aquí); queda sustituido por este documento |

---

*Artefacto de traspaso entre sesiones. Un Claude nuevo debe leer este archivo ANTES de
empezar a trabajar, junto con `.claude/CLAUDE.md`, `lessons-learned/log.md` y
`docs/governance/00-master-tracker.md`. Si el estado real diverge de este documento,
gana el estado real: verificar con `git branch -a`, `git worktree list` y `gh pr list`
antes de asumir.*
