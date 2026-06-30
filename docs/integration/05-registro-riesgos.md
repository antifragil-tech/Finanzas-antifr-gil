# 05 · Registro de riesgos vivos

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha: 2026-06-30
> Escala: Probabilidad / Impacto = Baja · Media · Alta.

## Tabla resumen

| ID | Riesgo | Prob. | Impacto | Dueño sugerido | Cuándo resolver |
|---|---|---|---|---|---|
| R1 | `.git` compartido entre worktrees | Alta | Alto | PM integración | Continuo (cada merge) |
| R2 | Conflicto/incoherencia de `pnpm-lock.yaml` | Alta | Medio | Quien integra | En cada PR que toca deps |
| R3 | Demo arrastra copia vieja de reservas | Media | Alto | Chat 2 + PM | Antes de PR 5x |
| R4 | Supabase legacy aún referenciado | Alta | Alto | Chat 3 | Fase Supabase (post-baseline) |
| R5 | Secret fallback en `packages/supabase-client` | Alta | Alto | Chat 3 / Seguridad | PR 9 (diferido) — rotación ya |
| R6 | Migraciones legacy del holding | Media | Medio | Chat 3 | Fase baseline |
| R7 | Rebranding global `@alsari/*` | Media | Alto | PM + todos | PR 8 (coordinado, diferido) |
| R8 | Dependencia accidental de "Lidomare App" | Baja | Alto | Chat 3 + Producto | Antes de aplicar baseline |
| R9 | Baseline nuevo aún sin aplicar/validar | Media | Alto | Chat 3 | Fase Supabase |
| R10 | SQL de clínica fuera del baseline | Alta | Medio | Chat 1 + Chat 3 | Antes de PR 7 |
| R11 | Filtración de datos reales | Media | Alto | Todos | Continuo |

---

## Detalle

### R1 · `.git` compartido entre worktrees
- **Descripción:** 9+ worktrees usan el mismo `.git`. Un `merge`/`rebase`/`reset`/`branch -D` impacta a todas las líneas.
- **Impacto:** corrupción de trabajo de otro chat; historia enredada.
- **Mitigación:** integrar **una rama a la vez**; pausar git en el resto de chats durante el merge; checkpoint en disco previo; prohibido `--force`. Ver `04-checklist-merge.md` §A.
- **Dueño:** PM integración. **Cuándo:** continuo.

### R2 · Lockfile incoherente
- **Descripción:** `feat/reservas-agenda-hoy` y `demo/*` modifican `pnpm-lock.yaml`; merge ingenuo lo rompe.
- **Impacto:** instalación rota, builds no reproducibles.
- **Mitigación:** **regenerar** con `pnpm install`, nunca resolver a mano (ver `02-matriz-conflictos.md` §Lockfile).
- **Dueño:** quien integra. **Cuándo:** cada PR con cambios de dependencias.

### R3 · Demo vs reservas (copia vieja)
- **Descripción:** `demo/*` lleva el spike de reservas (ancestro), divergente de la versión canónica de Chat 1.
- **Impacto:** si demo se mergea antes/incorrectamente, reintroduce el spike viejo en `main`.
- **Mitigación:** PR 4 (reservas canónico) **antes** que demo; demo se integra **partido** y sin `apps/modules/reservas/**` (ver `01` §Demo y `02` §reservas).
- **Dueño:** Chat 2 + PM. **Cuándo:** antes de PR 5x.

### R4 · Supabase legacy referenciado
- **Descripción:** módulos y cliente apuntan al proyecto legacy del holding; esquema legacy ≠ baseline limpio.
- **Impacto:** datos legacy expuestos; módulos financieros sin datos contra proyecto limpio.
- **Mitigación:** decisión tomada de **Supabase nuevo limpio** (ver `06-decision-log.md`); migrar referencias en la fase Supabase, tras baseline.
- **Dueño:** Chat 3. **Cuándo:** fase Supabase (post-baseline).

### R5 · Secret fallback en `packages/supabase-client`
- **Descripción:** `packages/supabase-client/src/index.ts` contiene un **fallback hardcodeado**: URL del proyecto legacy + una **`FALLBACK_ANON_KEY`** (JWT anon real). *(No se reproduce la clave en esta documentación.)*
- **Impacto:** cualquier build sin env apunta al proyecto legacy; credencial productiva versionada en un repo que puede ser compartido/público.
- **Mitigación:** **no tocar el fichero todavía** (decisión congelada), pero **rotar ya** la anon key legacy si el repo es accesible; en PR 9 (diferido) retirar los fallbacks y exigir env vars. **No** copiar la clave a ningún sitio.
- **Dueño:** Chat 3 / Seguridad. **Cuándo:** rotación inmediata; retirada en PR 9.

### R6 · Migraciones legacy del holding
- **Descripción:** `services/supabase/migrations/` tiene ~70 migraciones del holding Alsari (facturas, asientos, patrimonio, `rls_alsari_knowledge`, etc.).
- **Impacto:** confusión sobre qué esquema es el bueno; arrastre de estructura legacy al OS nuevo.
- **Mitigación:** el baseline curado (Chat 3) es la **fuente única** del esquema Antifrágil; tratar las migraciones legacy como histórico/no aplicable al proyecto nuevo (ver `excluded_legacy.md` del baseline).
- **Dueño:** Chat 3. **Cuándo:** fase baseline.

### R7 · Rebranding global `@alsari/*`
- **Descripción:** 11 paquetes, todos los imports, `vercel.json` y la raíz siguen como `@alsari/*` / `alsari-capital-os`.
- **Impacto:** hacerlo a medias rompe imports y el build.
- **Mitigación:** **un único PR coordinado** (PR 8), con todos los chats pausados; **diferido** hasta que la integración funcional esté estable.
- **Dueño:** PM + todos. **Cuándo:** PR 8 (diferido).

### R8 · Dependencia accidental de "Lidomare App"
- **Descripción:** existe la tentación/inercia de reutilizar "Lidomare App" como backend/integración. Decisión tomada: **no usar Lidomare App**.
- **Impacto:** acoplar el OS a un sistema no elegido; datos en lugar equivocado.
- **Mitigación:** verificar en QA del baseline que el proyecto destino **no** es Lidomare App ni el legacy (ver `checklist-supabase-baseline` de QA); ningún cableado debe apuntar ahí.
- **Dueño:** Chat 3 + Producto. **Cuándo:** antes de aplicar baseline.

### R9 · Baseline nuevo sin aplicar/validar
- **Descripción:** `chore/db-baseline-antifragil-os` aporta SQL + checks, pero **no está aplicado** a ningún proyecto.
- **Impacto:** falsa sensación de "hecho"; checks sin ejecutar.
- **Mitigación:** mergear los **ficheros** (PR 6) está bien; la **aplicación** real es una operación separada y **autorizada aparte**, siguiendo `APPLY_RUNBOOK.md` + `post_bootstrap_checks.sql`. No aplicar SQL en esta fase.
- **Dueño:** Chat 3. **Cuándo:** fase Supabase, con autorización expresa.

### R10 · SQL de clínica fuera del baseline
- **Descripción:** `feat/clinica-fase1-catalogos` puso su SQL de catálogos en `services/supabase/migrations/` (migración activa), incompatible con la estrategia "baseline curado, no migrations activas".
- **Impacto:** dos fuentes de verdad del esquema clínica; solape de tablas.
- **Mitigación:** mergear de esa rama **solo los tipos** (`packages/types`); reflejar/reubicar los catálogos en el baseline (Chat 3). Ver `01` PR 7.
- **Dueño:** Chat 1 + Chat 3. **Cuándo:** antes de PR 7.

### R11 · Filtración de datos reales
- **Descripción:** el repo legacy contiene entidades reales (Pavier, Armia, Rialsa, IBAN/CIF en docs/seed).
- **Impacto:** exposición de datos sensibles en PRs/demos.
- **Mitigación:** demo y reservas usan **solo mock**; QA pasa `check-legacy-strings` y `check-no-secrets`; enmascarar IBAN/CIF en cualquier evidencia compartida.
- **Dueño:** todos. **Cuándo:** continuo.
