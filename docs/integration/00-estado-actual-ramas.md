# 00 · Estado actual de ramas y worktrees

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha: 2026-06-30
> Documento **descriptivo**. No ejecuta acciones. No autoriza merges por sí mismo.

## Contexto estructural (leer primero)

- **Un único repositorio git** (`github.com/antifragil-tech/Finanzas-antifr-gil`) con **9+ worktrees** que comparten el **mismo `.git`**. Cualquier operación destructiva de git (`merge`, `rebase`, `branch -D`, `reset`) afecta a **todas** las líneas activas a la vez.
- `main` está en `8d0b720 Initial commit` y **todas las ramas parten de ahí** (abanico limpio, 0 commits "behind").
- El repo es **Alsari reciclado**: los 11 paquetes siguen siendo `@alsari/*`, la raíz es `alsari-capital-os`. El rebranding global está **diferido** (ver `06-decision-log.md`).

## Tabla de ramas

| Rama | HEAD local | En `origin` | Línea / Chat | Qué representa | ¿PR draft? | ¿Mergeable? | Riesgo principal |
|---|---|---|---|---|---|---|---|
| `main` | `8d0b720` | sí (`8d0b720`) | base | Punto de partida común | — | — | Es la base; **no tocar** |
| `feat/reservas-agenda-hoy` | `f3a66b0` | no (local) | **Chat 1** | Módulo `@alsari/reservas` real: Agenda Hoy por profesional, badges, panel lateral, mock partners | **Sí** | Sí (1.º del bloque reservas) | Lockfile; es la **versión canónica** |
| `demo/local-antifragil-os` | `95f3f72` | no (local) | **Chat 2** | Host shell demo + Panel de Dirección + rutas mock secundarias | Sí (**NO-MERGE**) | **No tal cual** | Lleva copia vieja del spike de reservas; reescribe `(app)/page.tsx`, `middleware.ts` |
| `chore/db-baseline-antifragil-os` | `3420470` | no (local) | **Chat 3** | Baseline curado Supabase en `services/supabase/baselines/antifragil_os/` (SQL 1141 líneas + runbook + checks, 26 tablas) | Sí | Sí (additive) — **sin aplicar SQL** | SQL versionado, no ejecutado; reconciliar con clínica |
| `feat/clinica-fase1-catalogos` | `d08058d` | sí (`d08058d`) | Clínica datos | Tipos `packages/types/clinica.ts` + migración catálogos en `services/supabase/migrations/` | Sí (**parcial**) | Tipos sí · **SQL no** (reubicar al baseline) | Migración activa **fuera de patrón** baseline |
| `docs/finanzas-modelo-operativo` | `d429ec6` | no (local) | Finanzas | 6 docs finanzas operativas (00–06) | Sí | Sí | Ninguno (solo docs) |
| `docs/finanzas-facturacion-emitida-design` | `6767680` | sí (`aa56c90`) | Finanzas | Diseño facturación emitida (doc 02) | Sí | Sí | **Local diverge de origin** (reconciliar) |
| `chore/financiero-copy-antifragil` | `42edd4d` | no (local) | Rebrand visible | Renombra marca visible "Alsari Capital"→"Antifrágil" en `financiero` (4 líneas) | Sí | Sí | Ninguno (aislado) |

## Ramas legacy / superadas (archivar, no mergear)

| Rama | HEAD | Por qué se archiva |
|---|---|---|
| `feat/reservas-calendario-semana` | `4d6dc7f` | **Spike** de calendario. Es **ancestro común** de `feat/reservas-agenda-hoy` (Chat 1) y de `demo/local-antifragil-os` (Chat 2). Su contenido ya vive en ambas; no aporta nada por separado. |
| `docs/finanzas-contabilidad-antifragil-audit` | `2c455ff` | **Subsumida byte a byte** por `docs/finanzas-modelo-operativo` (docs 00/01/03 idénticos). Cerrar sin merge. |

## Genealogía clave (reservas)

```
main 8d0b720
  └─ 4d6dc7f  spike (feat/reservas-calendario-semana)  ◄── ANCESTRO COMÚN
        ├─ …→ f3a66b0  feat/reservas-agenda-hoy   (Chat 1: spike + 7 commits → módulo real)
        └─ …→ 95f3f72  demo/local-antifragil-os   (Chat 2: spike + 7 commits → host/shell/panel/mock)
```

Implicación operativa: **demo dejó `apps/modules/reservas` idéntico al ancestro** (no lo modificó). Por eso el "conflicto" de reservas no es real si se integra en el orden correcto (ver `02-matriz-conflictos.md`).

## Estado funcional resumido

- **Chat 1 (reservas):** módulo Vite funcional standalone (`pnpm --filter @alsari/reservas dev`). Aún **no** montado en el host por sí mismo (el cableado host vive en demo).
- **Chat 2 (demo):** arrancable en local con `ANTIFRAGIL_DEMO_MODE=true` (mock, sin backend). Doble guarda anti-producción. **No** debe ir a `main` tal cual.
- **Chat 3 (baseline):** ficheros SQL + documentación listos como **baseline curado**; **no aplicado**. Ruta nueva, sin colisión.
- **Finanzas / clínica-tipos / rebrand-visible:** cambios pequeños y aislados, listos para PR draft.

## Reglas transversales

1. Integrar **de una sola rama en vuelo**; el resto de chats pausan operaciones git (ver `04-checklist-merge.md`).
2. **Nunca** `merge`/`rebase`/`force-push` cruzados por el `.git` compartido.
3. **No** se aplica SQL real ni se toca Supabase real en esta fase.
4. **No** tocar `packages/supabase-client` ni hacer rebranding global todavía (decisiones congeladas).
