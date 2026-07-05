# 04 — Orden de integración · Antifrágil OS

> En qué orden convergen las líneas de trabajo a `main` y **por qué**. Este orden existe para
> que ningún merge rompa a otro y para no hacer dos veces el mismo trabajo de integración.
>
> **Fuente de detalle:** el plan maestro del "Chat 4" (rama `docs/integration-master-plan`,
> `docs/integration/00-06`: estado de ramas, orden de PRs, matriz de conflictos por archivo,
> runbook push/PR, checklist de merge, riesgos R1-R11 y decision log D1-D11). Este documento
> **lo resume y lo sitúa** dentro de governance; ante conflicto de detalle, revisar allí y
> actualizar ambos. Verificado contra el repo el 2026-07-04 (algunos HEADs avanzaron desde
> que el plan se escribió el 2026-06-30; el orden sigue siendo válido).

---

## El orden (macro)

```
0. Governance + Compliance      (este PR — proceso, contexto, frontera legal)
1. QA smoke suite               (aditiva: scripts + checklists que validan el resto)
2. Docs finanzas                (modelo operativo 00-06 · facturación emitida PR #1)
3. Rebrand visible financiero   (4 líneas de copy, aislado)
4. Reservas canónico  ◄─ GATE   (el módulo real; todo el bloque demo depende de él)
5. Demo PARTIDO en 4 piezas     (5a cableado host → 5b shell+panel → 5c gating → 5d rutas mock)
6. Baseline Supabase / A1       (PR técnico de DB, additive — SIN aplicar SQL)
7. Clínica tipos                (solo packages/types + doc; su SQL se reubica al baseline)
────────── diferidos ──────────
8. Rebranding global @alsari/*  (PR único coordinado, al final)
9. packages/supabase-client     (+ creación del proyecto Supabase nuevo)
```

Regla general: **primero lo que define cómo trabajamos (0-1), luego docs y cambios aislados
(2-3), luego el producto real (4-5), luego la base técnica (6-7), y al final lo transversal (8-9).**

Reglas duras durante toda la secuencia:

- **Una sola rama en integración a la vez** y el resto de líneas pausan git — los 13 worktrees
  comparten el mismo `.git` (riesgo R1): un merge/rebase mal hecho impacta a todas a la vez.
- Tras cada merge: `pnpm install` (si tocó deps) + lint + type-check + build host + smoke.
- Archivar al pasar: `feat/reservas-calendario-semana` (tras el paso 4) y
  `docs/finanzas-contabilidad-antifragil-audit` (subsumida, sin merge).

---

## Justificaciones

### Por qué Reservas va ANTES que Demo (y es el GATE)

- **Reservas (`feat/reservas-agenda-hoy`) es la versión CANÓNICA del módulo** (decisión D7).
  Demo es un cascarón de presentación con rutas y datos mock.
- **Genealogía real:** el spike `feat/reservas-calendario-semana` (`4d6dc7f`) es el **ancestro
  común** de Reservas y de Demo. Demo arrastra la **copia vieja del spike** de
  `apps/modules/reservas/**` sin haberla modificado.
- Si Reservas entra primero, git resuelve solo: al integrar Demo después, su copia del spike
  **"se va sola"** (three-way merge: solo Reservas modificó esos ficheros). Si Demo entrara
  primero, **reintroduciría el spike viejo en `main`** (riesgo R3).
- Regla fija ante cualquier marcador de conflicto en `apps/modules/reservas/**`: gana
  **siempre** la versión de `feat/reservas-agenda-hoy`. Nunca mezclar a mano las dos versiones.

### Por qué Demo NO se mergea tal cual — y cómo se parte (PRs 5a-5d)

- Decisión D8: Demo es una experiencia **mock** para enseñar el OS en local, protegida por
  `ANTIFRAGIL_DEMO_MODE` con **doble guarda anti-producción** (la flag se ignora si
  `NODE_ENV=production`). Mergearla entera metería la copia vieja de reservas y cambios de
  host sin revisar.
- Se integra **partida en 4 PRs**, excluyendo SIEMPRE `apps/modules/reservas/**`:
  - **5a — Cableado host de reservas:** `next.config.ts` (transpile), dep en `package.json`,
    ruta `/reservas` + `ReservasClient.tsx` con `ssr:false` (DayPilot usa `window`).
  - **5b — Demo shell:** `components/demo/**` (DemoShell/Sidebar/Topbar, Panel de Dirección,
    pantallas, `mock/demoData.ts`) + `lib/demo.ts`.
  - **5c — Gating:** guarda en `middleware.ts`, swap en `layout.tsx`; **crítico:** sin la flag,
    el host se comporta idéntico a `main` (auth real intacta).
  - **5d — Rutas secundarias mock:** `page.tsx`, `configuracion/`, `rentabilidad/`, wrappers
    placeholder. Todas con etiqueta "DATOS DE DEMOSTRACIÓN".
- Partirlo permite revisar el **gating anti-producción por separado** (es lo peligroso) y
  evita arrastrar el spike.

### Cómo tratar `pnpm-lock.yaml`

- El lockfile **nunca se resuelve a mano** en un conflicto: se toma el `package.json` resultante
  del merge y se **regenera** con `pnpm install` en la raíz; después `git add pnpm-lock.yaml`.
- Un PR cuyo lockfile cambia **sin** cambio en algún `package.json` es sospechoso: regenerar y
  justificar, o revertir el lockfile.
- El delta de lockfile de Demo es **redundante** una vez Reservas está en `main` (misma
  dependencia `@daypilot/daypilot-lite-react`).
- Si `pnpm install` propone cambios de versión inesperados → **parar y revisar** (indica un
  `package.json` mal mergeado). No usar `--frozen-lockfile` para regenerar.
- Motivo de fondo: el lockfile es un artefacto derivado con hashes; una resolución manual
  "que compila" puede fijar versiones fantasma y el error aparece semanas después.

### Por qué NO tocar `packages/supabase-client` (decisión D9 + riesgo R5)

- Es el **punto único de acceso a datos**: lo consumen todos los módulos heredados a la vez.
- Contiene además un **fallback hardcodeado al proyecto legacy** (URL + anon key real). Tocarlo
  a medias rompe todos los módulos; dejarlo como está mantiene el riesgo acotado y conocido.
- 🔴 **Acción de seguridad pendiente (R5), independiente del código:** **rotar la anon key
  legacy** en el Dashboard del proyecto legacy. No requiere tocar el repo y conviene hacerlo ya.
- El cambio real (retirar fallbacks, renombrar `window.alsariToken`, apuntar al proyecto
  Antifrágil por env vars) es el **PR 9, diferido**, tras baseline aplicado + decisión del
  proyecto Supabase nuevo.

### Por qué el Baseline va como PR técnico separado (paso 6) — decisión D4

- Se eligió **baseline curado** (`services/supabase/baselines/antifragil_os/`, 26 tablas, RLS,
  Storage, seed mínimo con Antifrágil S.C. y proyecto CLI-PLY) frente a acumular migraciones
  activas. Las ~70 migraciones de `services/supabase/migrations/` son **legacy del holding**:
  histórico, NO aplicable al proyecto nuevo (`excluded_legacy.md` lista qué se excluye y por qué).
- Mergear el PR del baseline = mergear **ficheros**. **Aplicarlo** a un Supabase real es una
  operación separada, autorizada aparte, siguiendo `APPLY_RUNBOOK.md` + `post_bootstrap_checks.sql`
  (lección de drift del legacy: un `.sql` en el repo no garantiza nada sobre la BD).
- Consecuencia directa para Clínica (paso 7, riesgo R10): su SQL de catálogos entró como
  **migración activa** (fuera de patrón). El PR #2 debe reescribir su alcance a **solo tipos
  (`packages/types/clinica.ts`) + doc de decisión**, y los catálogos se reflejan en el baseline.

### Por qué el rebrand visible SÍ va temprano (paso 3) y el global va AL FINAL (paso 8)

- `chore/financiero-copy-antifragil` son **4 líneas de texto visible** en `financiero` — módulo
  que ninguna otra rama activa toca. Aislado, sin riesgo: puede ir antes que Reservas.
- El rebranding **global** (`@alsari/*` → namespace propio, raíz `alsari-capital-os`,
  `vercel.json`, todos los imports; 355 ocurrencias medidas en 122 archivos) rompe el build si
  se hace a medias y generaría conflictos masivos con cualquier rama grande abierta. Decisión
  D10: **un único PR coordinado**, con todo lo funcional ya integrado y las líneas pausadas.

---

## Matriz de dependencias

| PR / Línea                                             | Depende de                                  | Bloquea a                                     |
| ------------------------------------------------------ | ------------------------------------------- | --------------------------------------------- |
| 0. Governance (este)                                   | —                                           | Es prerequisito de proceso para todos         |
| 1. QA suite                                            | Governance                                  | Marca el "Ready" de los demás                 |
| 2. Docs finanzas (modelo operativo, facturación PR #1) | —                                           | Diseños de F-Op y F4.x                        |
| 3. Rebrand visible                                     | —                                           | —                                             |
| 4. Reservas F1 (GATE)                                  | Governance (proceso)                        | 5a-5d, Reservas F2, archivo del spike         |
| 5a-5d. Demo partido                                    | **PR 4** (5a) y secuencial 5a→5b→5c→5d      | Extracción del shell del OS                   |
| 6. Baseline/A1                                         | Governance                                  | 7 (Clínica), fase Supabase, todo backend real |
| 7. Clínica tipos                                       | **PR 6** (su SQL se refleja en el baseline) | Módulo Clínica/Reservas F2                    |
| 8. Rebrand global (diferido)                           | 2-7 integrados                              | —                                             |
| 9. supabase-client + proyecto nuevo (diferido)         | 6 mergeado + decisión + rotación R5         | Backend real de todos los módulos             |
