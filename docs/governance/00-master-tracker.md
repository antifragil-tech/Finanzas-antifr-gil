# 00 — Master Tracker · Antifrágil OS

> **Fuente única de estado por línea de trabajo.** Se actualiza al cerrar cada sesión de trabajo
> y al abrir/cerrar cada PR. Si este tracker y la realidad divergen, gana la realidad
> (verificar con `git branch -a`, `git worktree list`, `gh pr list`).
> **Última verificación real:** 2026-07-04.

---

## Tracker

| Línea de trabajo | Rama | Último commit conocido | Estado | Local / Remoto / PR | Bloqueos | Siguiente paso |
|---|---|---|---|---|---|---|
| **Governance** | `docs/project-governance-antifragil-os` | (este PR) | En curso | Local + push + PR Draft | — | Revisión de Guille → merge |
| **Compliance** | `docs/project-governance-antifragil-os` (carpeta `docs/compliance/`) | (este PR) | Redactado, pendiente validación legal | Con governance | Requiere asesor legal/DPO antes de producción | Revisión legal externa |
| **Reservas / Agenda (F1)** | `feat/reservas-agenda-hoy` | `53c233a` mejorar navegación clínica (F1 cerrada en `f3a66b0`) | F1 operativa, sin backend | Solo local ❌ | Sin push | Push + PR Draft |
| **Reservas — spike semana** | `feat/reservas-calendario-semana` | `4d6dc7f` spike calendario semanal sin solapes | Spike | Solo local ❌ | Decidir destino | Fusionar en F2 o descartar |
| **Demo OS** | `demo/local-antifragil-os` | `7854be1` sincronizar contexto global | Congelada — NO MERGE | Remoto ✅ + **PR #3 Draft** | Espera a Reservas (orden de integración) | Mantener Draft; re-montar sobre Reservas |
| **Baseline Supabase** | `chore/db-baseline-antifragil-os` | `6c49503` documentar A1 | Docs listos; **nada aplicado** | Solo local ❌ | Sin push; Supabase nuevo aún no creado | Push + PR Draft |
| **A1 Tesorería/Caja** | `chore/db-baseline-antifragil-os` (draft dentro del baseline) | `6c49503` | Draft de modelo/contrato UI/runbook | Con baseline | Depende del baseline y del Supabase nuevo | Revisar como parte del PR de baseline |
| **Integración** | `docs/integration-master-plan` | `3a7cb4f` plan maestro | Matriz escrita | Solo local ❌ | Contenido ya formalizado en `04-integration-order.md` | Decidir: archivar rama o reconvertir |
| **QA** | `qa/smoke-suite-antifragil-os` | `4e4272c` scripts smoke no destructivos | Smoke suite inicial | Remoto ✅, sin PR | — | Crear PR Draft |
| **Facturación emitida (diseño)** | `docs/finanzas-facturacion-emitida-design` | `6767680` | Diseño completo; D1-D3 firmes | Remoto ✅ + **PR #1 OPEN** | F4-A/B/E (Guille), F4-C (gestoría) | Revisión/merge PR #1; F4.0 solo con autorización |
| **Clínica Fase 1 — catálogos** | `feat/clinica-fase1-catalogos` | `d08058d` modelo de datos F1 | Modelo de datos + tipos | Remoto ✅ + **PR #2 Draft** | — | Revisión |
| **Finanzas — auditoría base (docs 00/01)** | `docs/finanzas-contabilidad-antifragil-audit` | `2c455ff` | Docs escritos | Solo local ❌ | Sin push | Push + PR Draft |
| **Finanzas — modelo operativo (doc 06)** | `docs/finanzas-modelo-operativo` | `d429ec6` decisiones A1-D1..D5 | Docs escritos | Solo local ❌ | Sin push | Push + PR Draft |
| **Rebrand marca visible** | `chore/financiero-copy-antifragil` | `42edd4d` Alsari Capital → Antifragil | Iniciado | Solo local ❌ | Encaje en orden de integración (después de Reservas/Demo) | Push + PR Draft cuando toque |

---

## Leyenda de estados

- **En curso** — se está trabajando activamente.
- **Congelada** — trabajo detenido a propósito (esperando a otra línea).
- **Docs listos / nada aplicado** — diseño terminado; sin efecto sobre sistemas reales.
- **Spike** — exploración técnica; puede descartarse sin coste.

## Reglas del tracker

1. Cada sesión que toque una línea **actualiza su fila** (commit, estado, siguiente paso).
2. Ninguna línea pasa a "mergeada" sin autorización explícita de Guille.
3. Los "bloqueos" se escriben con nombre y apellido (qué falta y de quién depende).
4. Las líneas nuevas se añaden al tracker **antes** de crear su rama.
