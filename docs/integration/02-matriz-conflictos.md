# 02 · Matriz de conflictos y estrategia de resolución

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha original: 2026-06-30
> **Actualizado: 2026-07-04 por Chat 5** — numeración alineada con los PRs reales de GitHub (reservas = **PR #5**, demo = **PR #3**, baseline = **PR #4**, clínica = **PR #2**; las piezas del demo se llaman 5a–5d).

## Principios (no negociables)

1. **Reservas de Chat 1 (`feat/reservas-agenda-hoy`) es la versión CANÓNICA.** Cualquier otra copia del módulo cede ante esta.
2. **El demo NO debe llevar su copia antigua del spike de reservas.** Esa copia es idéntica al ancestro común y debe desaparecer al integrar.
3. **El `pnpm-lock.yaml` se REGENERA, no se resuelve a mano.** Nunca editar el lockfile en un merge.

## Matriz de conflictos esperados por archivo

| Archivo | Quién lo toca | Severidad | ¿Conflicto real? | Estrategia / orden correcto |
|---|---|---|---|---|
| `apps/modules/reservas/src/App.tsx` | Chat1 (43 líneas) vs demo (26 = **ancestro**) | Media | **No**, si orden correcto | Integrar PR #5 (Chat 1) primero; demo no aporta cambios sobre la base → gana Chat 1 |
| `apps/modules/reservas/src/spike/CalendarioSpike.tsx` | Chat1 (454) vs demo (511 = **ancestro**) | Media | **No**, si orden correcto | Igual que arriba → gana Chat 1 |
| `apps/modules/reservas/src/clinica/**` (5 ficheros) | solo Chat 1 | Baja | No | Aditivo |
| `apps/modules/reservas/**` (resto: index.css, mockData, estados, CitaModal, MonthResumen, config) | Chat1 y demo (idénticos al spike o evolucionados por Chat1) | Baja | No | Tomar la versión de PR #5 (Chat 1) |
| `pnpm-lock.yaml` | Chat1 (commit `d7ef6e0`) + demo (+75) | **Alta** | **Sí** (lockfile) | **Regenerar** con `pnpm install` (ver §Lockfile). Nunca a mano |
| `apps/host/package.json` | solo demo (`+@alsari/reservas`) | Baja | No | Requiere que PR #5 ya esté en `main` |
| `apps/host/next.config.ts` | solo demo (`transpilePackages += reservas`) | Baja | No | Mantener en PR 5a. Nota: ya lista `@alsari/proyectos` (referencia colgante, no existe módulo) |
| `apps/host/src/app/(app)/page.tsx` | solo demo (reescrito) | Media | No (entre ramas) | Verificar gating anti-producción en PR 5c/5d |
| `apps/host/src/middleware.ts` | solo demo (guarda demo) | **Alta (producción)** | No (entre ramas) | Revisar a fondo: la guarda retorna antes solo si `ANTIFRAGIL_DEMO_MODE && NODE_ENV≠production` |
| `apps/host/src/app/(app)/layout.tsx` | solo demo (swap shell) | Media | No | Verificar que la ruta legacy (`AppShell`) queda intacta sin la flag |
| `apps/host/src/app/(app)/{contabilidad,facturas,financiero,presupuestos}/page.tsx` | solo demo (wrappers mock) | Media | No (entre ramas) | En demo apuntan a pantallas mock; confirmar que producción real no se rompe |
| `packages/types/src/index.ts` | solo clinica-fase1 (añade reexports) | Baja | No | Aditivo |
| `services/supabase/migrations/202606261000_clinica…sql` | clinica-fase1 vs **plan baseline** (Chat 3) | **Alta (política)** | Conflicto de **estrategia**, no de merge | Reubicar a `services/supabase/baselines/antifragil_os/` o reflejar en el baseline; no mergear como migración activa |
| `services/supabase/baselines/antifragil_os/**` | solo Chat 3 | Baja | No | Ruta nueva, aditiva |
| `.env.example` | demo (documentación de la flag) | Baja | No | Es `.example` (sin secretos), ok |
| `docs/finanzas/00,01,03` | finanzas-modelo-operativo y finanzas-contabilidad-audit (**idénticos**) | Baja | No (uno subsume al otro) | Mergear solo `modelo-operativo`; archivar `contabilidad-audit` |

### Leyenda de severidad
- **Alta:** requiere acción específica (regenerar, reubicar) o revisión de producción.
- **Media:** sin conflicto entre ramas, pero exige verificación funcional.
- **Baja:** aditivo o trivial.

---

## Cómo resolver el conflicto `apps/modules/reservas`

**Resumen: no hay conflicto de contenido real.** El spike `4d6dc7f` es la merge-base de Chat 1 y de demo, y **demo dejó los ficheros de reservas sin cambios respecto a esa base**. En un three-way merge, git ve que solo Chat 1 modificó esos ficheros → los toma sin pelea.

### Receta recomendada (orden que evita el conflicto)
1. **Integrar PR #5 (`feat/reservas-agenda-hoy`) primero.** `main` queda con el módulo canónico (App 43, CalendarioSpike 454, `clinica/` con 5 ficheros).
2. **Preparar la rama demo sobre el nuevo `main`.** Como el commit spike `4d6dc7f` ya está upstream (es ancestro de PR #5), desaparece de la aportación de demo. Los commits de demo **no tocan reservas**, así que la copia vieja **se va sola**.
3. **Resultado:** demo deja de transportar `apps/modules/reservas`; lo consume vía `apps/host/package.json` + `next.config.ts` + `ReservasClient.tsx` (PR 5a).

### Si aparece un marcador de conflicto en `apps/modules/reservas/**`
- **Regla fija:** quedarse **siempre con la versión de Chat 1** (`feat/reservas-agenda-hoy`). Es la canónica.
- En la práctica: descartar el lado de demo para esos ficheros (`git checkout --theirs`/`--ours` según el sentido del merge — confirmar el sentido antes; ante la duda, **parar y consultar**, no adivinar).
- **No** mezclar a mano las dos versiones de `App.tsx`/`CalendarioSpike.tsx`.

### Qué NO hacer
- ❌ Mergear demo **antes** que reservas (reintroduciría el spike viejo en `main`).
- ❌ Editar a mano los ficheros de reservas para "combinar" ambas versiones.
- ❌ Mantener `feat/reservas-calendario-semana` viva como rama paralela (archivarla).

---

## Cómo resolver el conflicto `pnpm-lock.yaml`

**Regla absoluta: el lockfile se regenera, no se fusiona.**

1. Cuando un merge marque conflicto en `pnpm-lock.yaml`, **no abrir el fichero para resolver líneas**.
2. Asegurar que los `package.json` ya están integrados/correctos en el árbol.
3. Ejecutar en la raíz del repo:
   ```
   pnpm install
   ```
   Esto reescribe `pnpm-lock.yaml` de forma coherente con el conjunto de manifiestos.
4. `git add pnpm-lock.yaml` y continuar el merge/commit.
5. Verificar que **no** quedan marcadores `<<<<<<<`/`=======`/`>>>>>>>`.

### Notas
- El delta de lockfile de demo es **redundante** una vez PR #5 está en `main` (misma dependencia `@daypilot/daypilot-lite-react`).
- Si `pnpm install` propusiera cambios inesperados de versiones, **parar y revisar** (puede indicar un `package.json` mal mergeado).
- **No** usar `--frozen-lockfile` para regenerar (eso es para CI de verificación, no para resolver).

---

## Orden correcto global para minimizar conflictos

```
1. governance (PR #7)                → solo docs, marco de proceso
2. qa smoke suite (PR #6)            → gate de calidad, antes que el código
3. lessons (PR #8, opcional)         → solo docs
4. feat/reservas-agenda-hoy (PR #5)  → canónico, GATE de reservas
5. chore/financiero-copy             → aislado (copy visible)
6. docs finanzas (modelo + PR #1)    → sin colisión
7. chore/db-baseline (PR #4)         → ruta nueva, additive, NO APPLY
8. clinica tipos (PR #2 corregido)   → tras baseline; SQL reubicado
9. demo partido (piezas 5a→5d)       → tras reservas; la copia spike se descarta sola
   (rebranding global y supabase-client → diferidos)
```

Tras **cada** paso: `pnpm install` (si tocó deps) + lint + type-check + build host (ver `04-checklist-merge.md`).
