# 01 · Plan de PRs accionable

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha: 2026-06-30
> Todos los PR se abren **contra `main`** y **como Draft** salvo que se indique lo contrario.
> Ninguna instrucción de este documento autoriza `merge`, `push --force`, `rebase` ni tocar `main` directamente.

## Orden lineal exacto (resumen)

| # | Rama origen | Destino | Draft | Mergeable | Bloqueado por |
|---|---|---|---|---|---|
| 1 | `docs/finanzas-modelo-operativo` | `main` | sí | **sí** | — |
| 2 | `docs/finanzas-facturacion-emitida-design` | `main` | sí | sí | reconciliar con `origin` |
| 3 | `chore/financiero-copy-antifragil` | `main` | sí | sí | — |
| 4 | `feat/reservas-agenda-hoy` | `main` | sí | **sí (gate reservas)** | — |
| 5 | `demo/*` (partido, ver §Demo) | `main` | sí | tras partir | **#4** |
| 6 | `chore/db-baseline-antifragil-os` | `main` | sí | sí (additive, sin aplicar SQL) | — |
| 7 | `feat/clinica-fase1-catalogos` (solo tipos) | `main` | sí | tipos sí · SQL no | **#6** |
| 8 | *Rebranding `@alsari/*`* | `main` | — | **diferido** | decisión |
| 9 | *`packages/supabase-client` + proyecto Supabase* | `main` | — | **diferido** | decisión |

> Regla de oro: **un PR integrado a la vez**. Tras cada merge, regenerar lockfile (`pnpm install`) y revalidar (ver `04-checklist-merge.md`).

---

## Bloque DOCS

### PR 1 — Finanzas: modelo operativo
- **Rama origen:** `docs/finanzas-modelo-operativo` → **destino:** `main`
- **Título:** `docs(finanzas): modelo operativo + backlog + FOP A1 (docs 00–06)`
- **Descripción:** Documentación de finanzas operativas (auditoría base, modelo conceptual, plan Fase 2, mapa/gaps, backlog, FOP A1 efectivo/banco/arqueo). Solo `docs/finanzas/`.
- **Draft:** sí · **Mergeable:** sí · **Bloqueos:** ninguno.
- **Checklist antes de merge:** diff solo bajo `docs/finanzas/`; sin secretos; cerrar `docs/finanzas-contabilidad-antifragil-audit` como subsumida.

### PR 2 — Finanzas: facturación emitida (diseño)
- **Rama origen:** `docs/finanzas-facturacion-emitida-design` → **destino:** `main`
- **Título:** `docs(finanzas): diseño de facturación emitida + fiscalidad clínica`
- **Descripción:** Diseño doc 02 facturación emitida. Solo `docs/finanzas/`.
- **Draft:** sí · **Mergeable:** sí · **Bloqueos:** ⚠️ **el local (`6767680`) diverge de `origin` (`aa56c90`)** — reconciliar antes de abrir PR (ver `03-matriz-conflictos.md` y `03-runbook`).
- **Checklist antes de merge:** confirmar qué commit es el bueno; diff solo `docs/finanzas/`.

---

## Bloque RESERVAS

### PR 4 — Módulo reservas canónico (Chat 1)
- **Rama origen:** `feat/reservas-agenda-hoy` → **destino:** `main`
- **Título:** `feat(reservas): módulo Agenda Hoy por profesional (versión canónica)`
- **Descripción:** Módulo `@alsari/reservas`: Agenda Hoy (columnas por profesional), sub-nav Semana/Mes/Pendientes, badges de estado, panel lateral de cita, mock de partners. Es la **versión canónica** del módulo reservas; sustituye al spike.
- **Draft:** sí · **Mergeable:** **sí — este es el gate**: todo lo de reservas en host depende de que este módulo exista en `main`.
- **Bloqueos:** ninguno. Archivar `feat/reservas-calendario-semana` tras integrar.
- **Checklist antes de merge:** `pnpm --filter @alsari/reservas type-check` y `dev` ok; lockfile regenerado; sin tocar host.

---

## Bloque DEMO (partido — **NO mergear la rama entera**)

`demo/local-antifragil-os` se integra **partida en piezas** y **después del PR 4**. Excluir **todo** `apps/modules/reservas/**` (viene de PR 4). Ver detalle en §8 de `02-matriz-conflictos.md`.

### PR 5a — Cableado host de reservas
- **Origen:** subconjunto de `demo/*` · **Destino:** `main` · **Draft:** sí · **Bloqueado por:** PR 4
- **Título:** `feat(host): montar módulo reservas en el host (ssr:false)`
- **Archivos:** `apps/host/next.config.ts` (`transpilePackages += @alsari/reservas`), `apps/host/package.json` (dep `@alsari/reservas`), `apps/host/src/app/(app)/reservas/page.tsx` + `error.tsx`, `apps/host/src/components/ReservasClient.tsx`.
- **Checklist:** ruta `/reservas` monta con `next/dynamic({ssr:false})` sin error de `window`; lockfile regenerado.

### PR 5b — Demo shell + Panel de Dirección + pantallas mock
- **Origen:** subconjunto de `demo/*` · **Destino:** `main` · **Draft:** sí · **Bloqueado por:** PR 5a
- **Título:** `feat(demo): cascarón operativo + Panel de Dirección + pantallas mock`
- **Archivos:** `apps/host/src/components/demo/**` (DemoShell/Sidebar/Topbar/demoNav, panel/*, screens/*, mock/demoData.ts), `apps/host/src/lib/demo.ts`.
- **Checklist:** todo bajo `components/demo/**` + `lib/demo.ts`; sin datos reales.

### PR 5c — Gating demo (sin romper producción)
- **Origen:** subconjunto de `demo/*` · **Destino:** `main` · **Draft:** sí · **Bloqueado por:** PR 5b
- **Título:** `feat(demo): gating ANTIFRAGIL_DEMO_MODE con doble guarda anti-producción`
- **Archivos:** guarda en `apps/host/src/middleware.ts`, swap en `apps/host/src/app/(app)/layout.tsx`, `BootScreen.tsx`, `LoginForm.tsx`, `EnConstruccion.tsx`, `.env.example` (documentación de la flag).
- **Checklist crítico:** **sin** `ANTIFRAGIL_DEMO_MODE`, el host se comporta **idéntico a `main`** (auth real intacta); la flag se ignora si `NODE_ENV=production`.

### PR 5d — Rutas secundarias mock (Fase 4)
- **Origen:** subconjunto de `demo/*` · **Destino:** `main` · **Draft:** sí · **Bloqueado por:** PR 5c
- **Título:** `feat(demo): rutas secundarias mock del OS`
- **Archivos:** `apps/host/src/app/(app)/page.tsx`, `configuracion/`, `rentabilidad/`, y los wrappers placeholder de `contabilidad/facturas/financiero/presupuestos`.
- **Checklist:** todas las rutas devuelven 200 en demo y muestran "DATOS DE DEMOSTRACIÓN"; sin legacy visible.

> **Por qué partido:** demo mezcla (a) copia vieja de reservas — se descarta, (b) cableado host, (c) shell/panel, (d) gating, (e) rutas mock. Partirlo permite revisar el gating anti-producción por separado y evita arrastrar la copia del spike.

---

## Bloque BASELINE SUPABASE

### PR 6 — Baseline curado Antifrágil OS (Chat 3)
- **Rama origen:** `chore/db-baseline-antifragil-os` → **destino:** `main`
- **Título:** `chore(db): baseline curado de Supabase para Antifrágil OS (sin aplicar)`
- **Descripción:** Baseline limpio en `services/supabase/baselines/antifragil_os/`: `00000000000000_baseline_antifragil_os.sql` (26 tablas, RLS), `post_bootstrap_checks.sql`, `APPLY_RUNBOOK.md`, `README.md`, `ROLLBACK_NOTES.md`, `SECURITY_CHECKLIST.md`, `excluded_legacy.md`. **Solo ficheros versionados; NO se aplica SQL.**
- **Draft:** sí · **Mergeable:** sí (ruta nueva, additive, sin colisión).
- **Bloqueos:** ninguno para mergear los ficheros. La **aplicación** real del baseline contra un proyecto Supabase es una decisión/operación aparte (ver `04` y `05`).
- **Checklist antes de merge:** diff solo bajo `services/supabase/baselines/antifragil_os/`; **ningún SQL ejecutado**; `SECURITY_CHECKLIST.md` revisado; sin claves.

---

## Bloque CLÍNICA

### PR 7 — Tipos clínica Fase 1 (SQL reubicado al baseline)
- **Rama origen:** `feat/clinica-fase1-catalogos` → **destino:** `main`
- **Título:** `feat(types): dominio Clínica/Reservas Fase 1 (catálogos)`
- **Descripción:** Reexporta el dominio clínica en `packages/types` (`clinica.ts` + barrel). El SQL de catálogos que esta rama puso en `services/supabase/migrations/` **queda fuera de patrón** ahora que la vía oficial es el baseline curado (PR 6).
- **Draft:** sí · **Mergeable:** **tipos sí · SQL no**.
- **Bloqueos:** PR 6 (el baseline debe absorber/contener los catálogos clínica). Coordinar con Chat 3 si hay solape de tablas.
- **Acción recomendada:** abrir PR solo con `packages/types/**` (+ `docs/reservas/05-…md`); **excluir** `services/supabase/migrations/202606261000_clinica_fase1_catalogos.sql` y dejar que Chat 3 lo refleje en el baseline. (Esta reescritura de alcance la hace Chat 1/Chat 3, no este documento.)

---

## Bloque REBRANDING (diferido)

### PR 8 — Rebranding global `@alsari/* → @antifragil/*`
- **Estado:** **DIFERIDO** por decisión (ver `06-decision-log.md`).
- **Por qué espera:** toca los 11 `package.json`, todos los imports, `vercel.json` (`--filter=@alsari/host`) y la raíz `alsari-capital-os`. Hacerlo a medias rompe imports. Debe ser **un único PR coordinado** con todos los chats pausados.
- **No mezclar** con ningún otro PR de esta lista.

> Excepción ya permitida: el **rebrand visible** (texto en pantalla) de `chore/financiero-copy-antifragil` (PR 3) **no** es el rebranding de paquetes; es solo copy y puede ir antes.

### PR 3 — Rebrand visible financiero (copy)
- **Rama origen:** `chore/financiero-copy-antifragil` → **destino:** `main`
- **Título:** `chore(financiero): renombrar marca visible Alsari Capital → Antifrágil`
- **Descripción:** 4 líneas de texto visible en `apps/modules/financiero`. No toca nombres de paquete.
- **Draft:** sí · **Mergeable:** sí · **Bloqueos:** ninguno.

---

## Bloque SUPABASE-CLIENT (diferido)

### PR 9 — Migrar `packages/supabase-client` + cambio de proyecto
- **Estado:** **DIFERIDO** por decisión.
- **Alcance futuro:** retirar `FALLBACK_URL`/`FALLBACK_ANON_KEY` legacy hardcodeados, renombrar el auth-bridge `window.alsariToken`, apuntar a env vars del proyecto Antifrágil. **No tocar** en esta fase.
- **Bloqueos:** baseline aplicado + decisión de proyecto Supabase + plan de rotación de la anon key legacy.

---

## Resumen de qué **no** se mergea todavía
- ❌ `demo/local-antifragil-os` entera (va partida, tras PR 4).
- ❌ SQL activo de `feat/clinica-fase1-catalogos` (reubicar al baseline).
- ❌ Rebranding global `@alsari/*` (PR 8 diferido).
- ❌ Cambios en `packages/supabase-client` (PR 9 diferido).
- ❌ Aplicar el baseline contra Supabase real (operación separada y autorizada aparte).
- 🗄️ Archivar: `feat/reservas-calendario-semana`, `docs/finanzas-contabilidad-antifragil-audit`.
