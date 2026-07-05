# 01 · Orden de integración de PRs (accionable)

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha original: 2026-06-30
> **Actualizado: 2026-07-04 por Chat 5 (Integration PM)** — renumerado con los **PRs reales de GitHub** y reordenado según el estado verificado de cada rama.
> Todos los PR van **contra `main`** y **en Draft** hasta cumplir el checklist de `04-checklist-merge.md`. Ninguna instrucción de este documento autoriza `merge`, `push --force`, `rebase` ni tocar `main` directamente.

## Orden lineal (resumen ejecutivo)

| Paso | PR / pieza | Rama origen | Estado hoy | Bloqueado por | Por qué en este punto |
|---|---|---|---|---|---|
| 1 | **PR #7 Governance** | `docs/project-governance-antifragil-os` | Draft, listo para revisión final | — | Define el marco (proceso de PRs, compliance) que gobierna todos los merges posteriores |
| 2 | **PR #6 QA** | `qa/smoke-suite-antifragil-os` | Draft | #7 (marco) | La suite QA debe estar en `main` **antes** de usarla como gate de los PRs de código |
| 3 | **PR #8 Lessons** (opcional) | `docs/lessons-governance-session` | Draft | #7 | Documenta la sesión de governance; puede ir en cualquier momento tras #7 |
| 4 | **PR #5 Reservas** | `feat/reservas-agenda-hoy` | Draft / NO MERGE | #6 (gate QA) | Primer PR de código; versión **canónica** de reservas. Quitar NO MERGE solo tras pasar QA |
| 5 | **Rebrand visible** | `chore/financiero-copy-antifragil` | sin PR (falta push) | — | 4 líneas de copy, aislado; puede intercalarse en cualquier hueco |
| 6 | **Finanzas: modelo operativo** | `docs/finanzas-modelo-operativo` | sin PR (falta push) | — | Solo `docs/finanzas/`; base conceptual del doc de facturación |
| 7 | **PR #1 Facturación emitida** | `docs/finanzas-facturacion-emitida-design` | **OPEN (no Draft)** | conceptualmente #6 del paso anterior | Solo docs; construye sobre el modelo operativo |
| 8 | **PR #4 DB baseline** | `chore/db-baseline-antifragil-os` | Draft / **NO APPLY** | — | Additive (ruta nueva); se mergean **ficheros**, jamás se aplica SQL en esta fase |
| 9 | **PR #2 Clínica** (corregido) | `feat/clinica-fase1-catalogos` | Draft, **fuera de patrón** | #4 + corrección de alcance | Solo tipos (`packages/types`); el SQL activo debe salir del PR y reflejarse en el baseline |
| 10 | **Demo partido (5a→5d)** | subconjuntos de `demo/local-antifragil-os` (PR #3) | Draft / NO MERGE | #5 en `main` | El demo entero NO se mergea; se parte en 4 piezas revisables. PR #3 se cierra sin merge al terminar |
| 11 | **Rebrand global `@alsari/*`** | (futura) | **DIFERIDO** | decisión + todo lo anterior estable | Transversal a 11 paquetes; un único PR coordinado, nunca a medias |
| 12 | **`packages/supabase-client` + Supabase nuevo** | (futura) | **DIFERIDO** | baseline aplicado + decisión + rotación anon key | Afecta a todos los módulos; requiere proyecto Supabase nuevo decidido |

> Regla de oro: **un PR integrado a la vez**. Tras cada merge que toque deps, regenerar lockfile (`pnpm install`) y revalidar (ver `04-checklist-merge.md`).

---

## Justificación de dependencias

- **#7 antes que todo:** governance define el proceso de merge, el scope de compliance y las reglas de PR. Mergear código antes de acordar el proceso invierte el orden lógico.
- **#6 antes que cualquier PR de código:** la smoke suite (perfiles + changed-only) es el gate objetivo. Si QA no está en `main`, los gates de los pasos 4, 9 y 10 no son ejecutables desde `main`.
- **#5 antes que el demo partido:** el demo consume el módulo reservas vía host. Si el demo (o su pieza 5a) entra antes, reintroduce la copia vieja del spike o referencia un paquete inexistente en `main`. Detalle en `02-matriz-conflictos.md`.
- **#4 antes que #2:** la decisión D4 (baseline curado, no migraciones activas) implica que el esquema clínica vive en el baseline. PR #2 debe reescribir su alcance a solo-tipos y dejar que el baseline absorba los catálogos.
- **Pasos 5–8 son paralelos entre sí** (docs y copy aislados, rutas disjuntas): el orden relativo entre ellos es de conveniencia, no de dependencia. Se listan en secuencia para mantener la regla "un PR a la vez".
- **#1 tras el modelo operativo:** no hay dependencia de ficheros (rutas disjuntas dentro de `docs/finanzas/`), pero conceptualmente facturación emitida cita el modelo operativo; revisarlos en ese orden facilita la revisión.

---

## Detalle por paso

### Paso 1 — PR #7 · Governance
- **Rama:** `docs/project-governance-antifragil-os` (`53e5330`) · **Estado:** Draft, listo para revisión final.
- **Contenido:** contexto maestro, proceso de PRs, compliance scope.
- **Checklist antes de merge:** solo docs/governance; sin código; revisión final de Guille.

### Paso 2 — PR #6 · QA smoke suite
- **Rama:** `qa/smoke-suite-antifragil-os` (`cbf4338`) · **Estado:** Draft.
- **Contenido:** suite QA no destructiva con perfiles y modo changed-only.
- **Nota:** sus hallazgos preexistentes (anon key legacy → R5, datos reales en `services/python` → R12) **no bloquean el merge de la suite**, pero sí exigen acciones fuera de este PR.
- **Checklist:** la suite corre en verde sobre `main` + su propia rama; no toca código productivo.

### Paso 3 — PR #8 · Lessons (opcional)
- **Rama:** `docs/lessons-governance-session` (`beb40d4`) · **Estado:** Draft, opcional.
- Puede mergearse en cualquier hueco tras #7, o cerrarse si su contenido se consolida en governance.

### Paso 4 — PR #5 · Reservas canónico
- **Rama:** `feat/reservas-agenda-hoy` (`c3ea8ef`) · **Estado:** Draft / **NO MERGE** (marcado por su autor hasta pasar QA).
- **Contenido:** módulo `@alsari/reservas` Agenda v0.2: estado compartido + CitaPanel embebible. **Versión canónica** (decisión D7).
- **Este es el gate de reservas:** todo cableado host de reservas (paso 10, pieza 5a) depende de que este módulo exista en `main`.
- **Riesgo conocido:** bundle DayPilot >500 kB (R13) — aceptado para esta fase, optimización posterior.
- **Checklist:** QA (#6) en verde; `pnpm --filter @alsari/reservas type-check` y `dev` ok; lockfile regenerado; sin tocar host. Archivar `feat/reservas-calendario-semana` tras integrar.

### Paso 5 — Rebrand visible financiero (sin PR aún)
- **Rama:** `chore/financiero-copy-antifragil` (`42edd4d`, solo local — **falta push + PR Draft**).
- **Contenido:** 4 líneas de texto visible en `apps/modules/financiero`. **No** toca nombres de paquete (no es el rebrand global, ver paso 11).

### Paso 6 — Finanzas: modelo operativo (sin PR aún)
- **Rama:** `docs/finanzas-modelo-operativo` (`d429ec6`, solo local — **falta push + PR Draft**).
- **Contenido:** 6 docs de finanzas operativas (00–06). Solo `docs/finanzas/`.
- **Al integrar:** cerrar `docs/finanzas-contabilidad-antifragil-audit` como subsumida (sin merge).

### Paso 7 — PR #1 · Facturación emitida (diseño)
- **Rama:** `docs/finanzas-facturacion-emitida-design` (`6767680`, sincronizada con origin) · **Estado:** **OPEN, único PR fuera de Draft**.
- **Contenido:** diseño de facturación emitida + decisiones firmes (OS precontable, Clínica sin IVA provisional). Solo `docs/finanzas/`.
- **Nota:** la divergencia local/origin señalada en la versión anterior de este plan **está resuelta**.

### Paso 8 — PR #4 · DB baseline (NO APPLY)
- **Rama:** `chore/db-baseline-antifragil-os` (`27f6392`) · **Estado:** Draft / **NO APPLY**.
- **Contenido:** baseline curado en `services/supabase/baselines/antifragil_os/` + A1 Tesorería/Caja. **Solo ficheros versionados; NO se aplica SQL** (decisión D11).
- **Checklist:** diff solo bajo su ruta; ningún SQL ejecutado; `SECURITY_CHECKLIST.md` revisado; sin claves. La **aplicación** real es una operación aparte con autorización expresa.

### Paso 9 — PR #2 · Clínica Fase 1 (requiere corrección de alcance)
- **Rama:** `feat/clinica-fase1-catalogos` (`d08058d`) · **Estado:** Draft, **fuera de patrón** (R10).
- **Problema:** incluye una migración SQL activa en `services/supabase/migrations/`, incompatible con la decisión D4 (baseline curado).
- **Acción requerida antes de merge:** reescribir el alcance a **solo tipos** (`packages/types/clinica.ts` + barrel) y excluir el SQL; los catálogos clínica se reflejan en el baseline (coordinación con la línea DB).
- **Mergeable:** tipos sí · SQL **no**.

### Paso 10 — Demo partido (5a→5d) — **NO mergear PR #3 entero**
`demo/local-antifragil-os` (PR #3, `7854be1`) se integra **partido en piezas** y **después del paso 4**. Excluir **todo** `apps/modules/reservas/**` (viene del PR #5). Al completar las piezas, cerrar PR #3 sin merge. Detalle de conflictos en `02-matriz-conflictos.md` §Demo.

| Pieza | Contenido | Archivos clave | Bloqueada por |
|---|---|---|---|
| **5a** — Cableado host de reservas | montar `@alsari/reservas` en el host con `ssr:false` | `apps/host/next.config.ts`, `apps/host/package.json`, `(app)/reservas/page.tsx` + `error.tsx`, `ReservasClient.tsx` | PR #5 en `main` |
| **5b** — Shell demo + Panel de Dirección | cascarón operativo + pantallas mock | `apps/host/src/components/demo/**`, `apps/host/src/lib/demo.ts` | 5a |
| **5c** — Gating anti-producción | flag `ANTIFRAGIL_DEMO_MODE` con doble guarda | `middleware.ts`, `(app)/layout.tsx`, `BootScreen`, `LoginForm`, `EnConstruccion`, `.env.example` | 5b |
| **5d** — Rutas secundarias mock | rutas mock del OS | `(app)/page.tsx`, `configuracion/`, `rentabilidad/`, wrappers de contabilidad/facturas/financiero/presupuestos | 5c |

- **Checklist crítico de 5c:** **sin** la flag, el host se comporta **idéntico a `main`** (auth real intacta); la flag se ignora si `NODE_ENV=production`.
- **Por qué partido:** el demo mezcla (a) copia vieja de reservas — se descarta, (b) cableado host, (c) shell/panel, (d) gating, (e) rutas mock. Partirlo permite revisar el gating anti-producción por separado y evita arrastrar la copia del spike.

### Paso 11 — Rebrand global `@alsari/* → @antifragil/*` (DIFERIDO)
- **Estado:** **DIFERIDO** por decisión D10.
- **Por qué espera:** toca los 11 `package.json`, todos los imports, `vercel.json` (`--filter=@alsari/host`) y la raíz `alsari-capital-os`. Hacerlo a medias rompe imports y el build. Debe ser **un único PR coordinado** con todos los chats pausados.
- **No mezclar** con ningún otro PR de esta lista. El rebrand **visible** (paso 5) no es esto: es solo copy.

### Paso 12 — `packages/supabase-client` + proyecto Supabase nuevo (DIFERIDO)
- **Estado:** **DIFERIDO** por decisión D9.
- **Alcance futuro:** retirar `FALLBACK_URL`/`FALLBACK_ANON_KEY` legacy hardcodeados, renombrar el auth-bridge `window.alsariToken`, apuntar a env vars del proyecto Antifrágil. **No tocar** en esta fase.
- **Bloqueos:** baseline aplicado + decisión de proyecto Supabase + rotación de la anon key legacy (R5, **acción manual urgente fuera del repo, independiente de este paso**).

---

## Resumen de qué **no** se mergea todavía

- ❌ **PR #3** (`demo/local-antifragil-os`) entero — va partido en 5a–5d tras el PR #5; el PR #3 se cierra sin merge.
- ❌ **PR #5** mientras conserve la marca NO MERGE — primero QA (#6) en `main` y en verde.
- ❌ SQL activo de **PR #2** — reescribir alcance a solo tipos; el SQL se refleja en el baseline.
- ❌ Rebranding global `@alsari/*` — paso 11, diferido.
- ❌ Cambios en `packages/supabase-client` — paso 12, diferido.
- ❌ **Aplicar** el baseline (PR #4) contra Supabase real — operación separada y autorizada aparte.
- 🗄️ Archivar sin merge: `feat/reservas-calendario-semana`, `docs/finanzas-contabilidad-antifragil-audit`.
