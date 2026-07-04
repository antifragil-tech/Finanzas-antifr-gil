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
| `docs/project-governance-antifragil-os` | (este PR) | ✅ | Draft (este) | `wt-governance` |
| `docs/finanzas-facturacion-emitida-design` | `6767680` Fisioterapia sin subtipo deportivo | ✅ | **#1 OPEN** | `Finanzas-antifr-gil-facturacion` |
| `feat/clinica-fase1-catalogos` | `d08058d` modelo de datos Clínica F1 | ✅ | **#2 DRAFT** | `wt-clinica-fase1` |
| `demo/local-antifragil-os` | `7854be1` sincronizar contexto global OS mock | ✅ | **#3 DRAFT / NO MERGE** | `wt-demo-local-antifragil-os` |
| `feat/reservas-agenda-hoy` | `53c233a` mejorar navegación clínica | ❌ **sin push** | — | `wt-reservas-agenda-hoy` |
| `feat/reservas-calendario-semana` | `4d6dc7f` spike calendario semanal sin solapes | ❌ sin push | — | `wt-reservas-calendario` |
| `chore/db-baseline-antifragil-os` | `6c49503` documentar A1 (modelo, contrato UI, runbook) | ❌ **sin push** | — | `wt-finanzas-baseline` |
| `qa/smoke-suite-antifragil-os` | `4e4272c` scripts smoke no destructivos | ✅ | — (sin PR) | `wt-qa-smoke-suite` |
| `docs/integration-master-plan` | `3a7cb4f` plan maestro de integración y PRs | ❌ sin push | — | `wt-integration-master-plan` |
| `chore/financiero-copy-antifragil` | `42edd4d` renombrar marca visible Alsari→Antifragil | ❌ sin push | — | `wt-finanzas-rename` |
| `docs/finanzas-contabilidad-antifragil-audit` | `2c455ff` auditoría base + modelo conceptual (docs 00/01) | ❌ sin push | — | `wt-finanzas-docs` |
| `docs/finanzas-modelo-operativo` | `d429ec6` decisiones A1-D1..D5 en doc 06 | ❌ sin push | — | `wt-finanzas-modelo` |

> Nota del traspaso: la Fase 1 de Reservas se cerró en `f3a66b0` (*ajustar altura flexible para
> embed en shell*); la rama tiene commits posteriores hasta `53c233a`. ⚠️

### 2.2 Líneas de trabajo activas

**Demo OS** — `demo/local-antifragil-os` · PR #3 Draft ("NO MERGE")
DemoShell, Sidebar, Topbar, Dashboard, rutas mock, Demo Mode, contexto global
Sociedad/Proyecto/Rol/Periodo. Todo aislado del backend. **No mergear todavía;
se integra DESPUÉS de Reservas.**

**Reservas / Agenda** — `feat/reservas-agenda-hoy` (+ spike `feat/reservas-calendario-semana`)
Basado en DayPilot. Fase 1 operativa: Agenda Hoy, columnas por profesional, KPIs, huecos
visibles, panel lateral, badges, Vivofácil mock, Semana/Mes accesibles, height-flexible.
**Sin backend.** Pendiente: push + PR Draft. Fase 2 prevista: Pendientes, Cobros pendientes,
Vivofácil cierre mensual, Clientes administrativos, Bonos/Programas — **sin datos clínicos**.

**Supabase / DB** — `chore/db-baseline-antifragil-os`
Baseline curado + hardening + runbook preparados; A1 Tesorería/Caja como draft.
**Nada aplicado: no SQL real, no Supabase real tocado, no claves, no datos reales.**
Pendiente: push + PR Draft.
Decisiones firmes: se creará un **Supabase completamente nuevo** para Antifrágil OS;
**no** reutilizar el legacy de Alsari; **no** usar Lidomare App; **no** tocar
`packages/supabase-client` todavía.

**Finanzas (diseño)** — 3 ramas de docs
- `docs/finanzas-contabilidad-antifragil-audit`: docs 00 (auditoría base) y 01 (modelo conceptual).
- `docs/finanzas-facturacion-emitida-design` (PR #1): doc 02 — diseño de facturación emitida.
  Decisiones firmes tomadas (2026-06-26): **D1** el OS es precontable, NO emite factura legal
  oficial (Veri*factu delegado a gestoría → resuelve F4-D); **D2** Clínica sin IVA provisional
  (`exento_provisional`, conservando campos fiscales); **D3** tratamiento fiscal por
  producto/proyecto, nunca global. Pendientes: F4-A (quién emite), F4-B (cuenta 705),
  F4-C (mapa exención con gestoría/Ramón), F4-E (serie propia clínica).
  **F4.0 (auditoría de paridad de `facturas_emitidas`) NO abierta todavía.**
- `docs/finanzas-modelo-operativo`: doc 06 con decisiones A1-D1..D5 resueltas. ⚠️ (contenido no auditado desde esta rama)

**Clínica Fase 1** — `feat/clinica-fase1-catalogos` · PR #2 Draft
Catálogos/maestros + tipos compartidos (modelo de datos).

**Governance / Compliance** — `docs/project-governance-antifragil-os` (esta rama)
Tracker maestro, workstreams, proceso PR Draft, checklist de revisión, orden de integración,
alcance administrativo-operativo, frontera Notion↔OS, plantilla de PR.

**Integración** — `docs/integration-master-plan` (matriz del "Chat 4")
Su contenido queda formalizado en [governance/04-integration-order.md](governance/04-integration-order.md);
decidir si esa rama se archiva o se reconvierte.

**QA** — `qa/smoke-suite-antifragil-os` (✅ ya existe y está en origin, sin PR)
Scripts smoke no destructivos. Línea prevista: smoke routes, no secrets, no legacy visible,
checklists de PR (demo/reservas/baseline).

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

**PRs existentes (✅ verificado 2026-07-04):**
- **PR #1** — `docs(finanzas): diseño de facturación emitida + decisiones` — **OPEN** (anterior a la regla de Draft).
- **PR #2** — `feat(db): Clínica Fase 1 — catálogos / modelo de datos` — **DRAFT**.
- **PR #3** — `demo(local): Antifrágil OS mock shell y contexto global` — **DRAFT / NO MERGE**.
- **PR de governance** — esta rama (Draft al crearse).

**Ramas prioritarias a convertir en PR Draft:**
- `feat/reservas-agenda-hoy` (requiere push previo)
- `chore/db-baseline-antifragil-os` (requiere push previo)
- `qa/smoke-suite-antifragil-os` (ya en origin; falta PR)

---

## 5. Próximo orden de trabajo

**Orden de integración completo y justificado:** [governance/04-integration-order.md](governance/04-integration-order.md).

1. **Governance** — ✅ este PR (revisar y mergear cuando Guille lo apruebe).
2. **Compliance scope** — ✅ incluido en este PR (`docs/compliance/`); pendiente validación
   legal externa (asesor/DPO) antes de producción.
3. **Demo** — el PR Draft **ya existe (#3)**: verificar que su descripción refleja "NO MERGE /
   integrar después de Reservas" y mantenerlo en Draft.
4. **Baseline/A1** — push de `chore/db-baseline-antifragil-os` + PR Draft.
5. **Reservas** — push + PR Draft de Fase 1; después retomar Fase 2 **sin datos clínicos**.

*(Después, en la línea Finanzas: cerrar F4-A/B/E con Guille, F4-C con la gestoría, y abrir
F4.0 — auditoría de paridad de `facturas_emitidas` — solo cuando Guille lo autorice.)*

---

## 6. Discrepancias detectadas al escribir este traspaso (2026-07-04)

| Traspaso decía | Realidad verificada |
|---|---|
| Demo "pendiente PR Draft" | El PR #3 Draft **ya existe** (creado 2026-06-30) |
| QA era "línea prevista" (rama futura) | `qa/smoke-suite-antifragil-os` **ya existe y está en origin** |
| Reservas cerró en `f3a66b0` | La rama avanza hasta `53c233a`; además existe el spike `feat/reservas-calendario-semana` |
| Solo PRs #1 y #2 conocidos | Existen #1, #2 y #3 |
| — | Existen 4 ramas más no mencionadas en el traspaso: `docs/integration-master-plan`, `chore/financiero-copy-antifragil`, `docs/finanzas-contabilidad-antifragil-audit`, `docs/finanzas-modelo-operativo` |
| SESSION.md anterior (2026-06-12) | Hablaba del repo legacy Alsari (rama y PR inexistentes aquí); queda sustituido por este documento |

---

*Artefacto de traspaso entre sesiones. Un Claude nuevo debe leer este archivo ANTES de
empezar a trabajar, junto con `.claude/CLAUDE.md`, `lessons-learned/log.md` y
`docs/governance/00-master-tracker.md`. Si el estado real diverge de este documento,
gana el estado real: verificar con `git branch -a`, `git worktree list` y `gh pr list`
antes de asumir.*
