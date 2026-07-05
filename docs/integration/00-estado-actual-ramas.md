# 00 · Estado actual de ramas y worktrees

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha original: 2026-06-30
> **Actualizado: 2026-07-04 por Chat 5 (Integration PM)** — sincronizado con los PRs reales de GitHub y los HEADs verificados con `git rev-parse` y `gh pr list`.
> Documento **descriptivo**. No ejecuta acciones. No autoriza merges por sí mismo.

## Contexto estructural (leer primero)

- **Un único repositorio git** (`github.com/antifragil-tech/Finanzas-antifr-gil`) con **13 worktrees** que comparten el **mismo `.git`**. Cualquier operación destructiva de git (`merge`, `rebase`, `branch -D`, `reset`) afecta a **todas** las líneas activas a la vez.
- `main` está en `8d0b720 Initial commit` y **todas las ramas parten de ahí** (abanico limpio, 0 commits "behind").
- El repo es **Alsari reciclado**: los 11 paquetes siguen siendo `@alsari/*`, la raíz es `alsari-capital-os`. El rebranding global está **diferido** (ver `06-decision-log.md`).
- **Los números de PR de este plan son los reales de GitHub** (verificados 2026-07-04). La numeración hipotética de la versión anterior de estos docs queda obsoleta.

## Tabla de ramas y PRs (verificado 2026-07-04)

| Rama                                       | HEAD local | En `origin`         | PR GitHub | Estado PR                         | Qué representa                                                                                  | Riesgo principal                                                                                                     |
| ------------------------------------------ | ---------- | ------------------- | --------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `main`                                     | `8d0b720`  | sí (`8d0b720`)      | —         | —                                 | Punto de partida común                                                                          | Es la base; **no tocar**                                                                                             |
| `docs/finanzas-facturacion-emitida-design` | `6767680`  | sí (`6767680`)      | **#1**    | **OPEN (no Draft)**               | Diseño facturación emitida + decisiones (OS precontable, Clínica sin IVA)                       | Único PR fuera de Draft; solo docs                                                                                   |
| `feat/clinica-fase1-catalogos`             | `d08058d`  | sí (`d08058d`)      | **#2**    | Draft                             | Tipos `packages/types/clinica.ts` + **migración SQL activa** en `services/supabase/migrations/` | ⚠️ SQL activo **fuera de patrón** baseline (R10); debe corregirse antes de merge                                     |
| `demo/local-antifragil-os`                 | `7854be1`  | sí (`7854be1`)      | **#3**    | Draft / **NO MERGE**              | Host shell demo + Panel de Dirección + rutas mock                                               | Lleva copia vieja del spike de reservas; reescribe `(app)/page.tsx`, `middleware.ts`. Se integra **partido** (5a–5d) |
| `chore/db-baseline-antifragil-os`          | `27f6392`  | sí (`27f6392`)      | **#4**    | Draft / **NO APPLY**              | Baseline curado Supabase en `services/supabase/baselines/antifragil_os/` + A1 Tesorería/Caja    | SQL versionado, **no ejecutado**; reconciliar con clínica                                                            |
| `feat/reservas-agenda-hoy`                 | `c3ea8ef`  | sí (`c3ea8ef`)      | **#5**    | Draft / **NO MERGE**              | Módulo `@alsari/reservas` canónico: Agenda v0.2, estado compartido + CitaPanel embebible        | Lockfile; bundle DayPilot >500 kB; es la **versión canónica**                                                        |
| `qa/smoke-suite-antifragil-os`             | `cbf4338`  | sí (`cbf4338`)      | **#6**    | Draft                             | Suite QA no destructiva: perfiles + changed-only                                                | Ninguno estructural; es el gate de calidad para el resto                                                             |
| `docs/project-governance-antifragil-os`    | `53e5330`  | sí (`53e5330`)      | **#7**    | Draft (listo para revisión final) | Governance: contexto maestro, proceso de PRs, compliance scope                                  | Ninguno (solo docs); es el marco de todo lo demás                                                                    |
| `docs/lessons-governance-session`          | `beb40d4`  | sí (`beb40d4`)      | **#8**    | Draft (opcional)                  | Lección de la sesión de governance                                                              | Ninguno (solo docs)                                                                                                  |
| `docs/integration-master-plan`             | `3a7cb4f`+ | pendiente de push   | pendiente | —                                 | **Este plan** (`docs/integration/**`)                                                           | Ninguno (solo docs)                                                                                                  |
| `docs/finanzas-modelo-operativo`           | `d429ec6`  | **no** (solo local) | sin PR    | —                                 | 6 docs finanzas operativas (00–06)                                                              | Pendiente de push + PR Draft                                                                                         |
| `chore/financiero-copy-antifragil`         | `42edd4d`  | **no** (solo local) | sin PR    | —                                 | Rebrand **visible** "Alsari Capital"→"Antifrágil" en `financiero` (4 líneas de copy)            | Pendiente de push + PR Draft; aislado                                                                                |

## Ramas legacy / superadas (archivar, no mergear)

| Rama                                          | HEAD      | Por qué se archiva                                                                                                                                                                        |
| --------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feat/reservas-calendario-semana`             | `4d6dc7f` | **Spike** de calendario. Es **ancestro común** de `feat/reservas-agenda-hoy` (PR #5) y de `demo/local-antifragil-os` (PR #3). Su contenido ya vive en ambas; no aporta nada por separado. |
| `docs/finanzas-contabilidad-antifragil-audit` | `2c455ff` | **Subsumida byte a byte** por `docs/finanzas-modelo-operativo` (docs 00/01/03 idénticos). Cerrar sin merge.                                                                               |

## Cambios respecto a la foto del 2026-06-30

- Las ramas de reservas, demo y baseline avanzaron: reservas `f3a66b0`→`c3ea8ef`, demo `95f3f72`→`7854be1`, baseline `3420470`→`27f6392`.
- La divergencia local/origin de `docs/finanzas-facturacion-emitida-design` **está resuelta**: ambos en `6767680`.
- Se abrieron los PRs reales #1–#8 en GitHub; todos Draft **excepto #1** (OPEN normal).
- Aparecieron tres líneas nuevas no contempladas en la foto original: **QA (#6)**, **Governance (#7)** y **Lessons (#8)**.

## Genealogía clave (reservas)

```
main 8d0b720
  └─ 4d6dc7f  spike (feat/reservas-calendario-semana)  ◄── ANCESTRO COMÚN
        ├─ …→ c3ea8ef  feat/reservas-agenda-hoy   (PR #5: spike + commits → módulo canónico)
        └─ …→ 7854be1  demo/local-antifragil-os   (PR #3: spike + commits → host/shell/panel/mock)
```

Implicación operativa: **demo dejó `apps/modules/reservas` idéntico al ancestro** (no lo modificó). Por eso el "conflicto" de reservas no es real si se integra en el orden correcto (ver `02-matriz-conflictos.md`).

## Estado funcional resumido

- **Reservas (PR #5):** módulo Vite funcional standalone (`pnpm --filter @alsari/reservas dev`), Agenda v0.2 con estado compartido y CitaPanel embebible. Aún **no** montado en el host por sí mismo (el cableado host vive en demo).
- **Demo (PR #3):** arrancable en local con `ANTIFRAGIL_DEMO_MODE=true` (mock, sin backend). Doble guarda anti-producción. **No** debe ir a `main` tal cual.
- **DB baseline (PR #4):** ficheros SQL + documentación listos como **baseline curado**; **no aplicado**. Ruta nueva, sin colisión.
- **QA (PR #6):** smoke suite no destructiva con perfiles y modo changed-only. Detectó hallazgos preexistentes (anon key legacy, datos reales en `services/python`).
- **Governance (PR #7):** contexto maestro y proceso de PRs; listo para revisión final. Es el primer merge previsto.
- **Finanzas / clínica-tipos / rebrand-visible:** cambios pequeños y aislados. Facturación ya tiene PR (#1); modelo operativo y rebrand visible pendientes de push.

## Reglas transversales

1. Integrar **una sola rama en vuelo**; el resto de chats pausan operaciones git (ver `04-checklist-merge.md`).
2. **Nunca** `merge`/`rebase`/`force-push` cruzados por el `.git` compartido.
3. **No** se aplica SQL real ni se toca Supabase real en esta fase.
4. **No** tocar `packages/supabase-client` ni hacer rebranding global todavía (decisiones congeladas).
