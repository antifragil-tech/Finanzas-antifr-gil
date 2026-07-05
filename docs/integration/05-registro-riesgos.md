# 05 · Registro de riesgos vivos

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha original: 2026-06-30
> **Actualizado: 2026-07-04 por Chat 5** — numeración de PRs real de GitHub; añadidos R12 (datos reales en `services/python`) y R13 (bundle DayPilot).
> Escala: Probabilidad / Impacto = Baja · Media · Alta.

## Tabla resumen

| ID  | Riesgo                                                            | Prob. | Impacto | Dueño sugerido      | Cuándo resolver                             |
| --- | ----------------------------------------------------------------- | ----- | ------- | ------------------- | ------------------------------------------- |
| R1  | `.git` compartido entre worktrees                                 | Alta  | Alto    | PM integración      | Continuo (cada merge)                       |
| R2  | Conflicto/incoherencia de `pnpm-lock.yaml`                        | Alta  | Medio   | Quien integra       | En cada PR que toca deps                    |
| R3  | Demo arrastra copia vieja de reservas                             | Media | Alto    | Línea demo + PM     | Antes de las piezas 5a–5d                   |
| R4  | Supabase legacy aún referenciado                                  | Alta  | Alto    | Línea DB            | Fase Supabase (post-baseline)               |
| R5  | **Anon key legacy en `packages/supabase-client`**                 | Alta  | Alto    | Seguridad           | **Rotación manual URGENTE, fuera del repo** |
| R6  | Migraciones legacy del holding                                    | Media | Medio   | Línea DB            | Fase baseline                               |
| R7  | Rebranding global `@alsari/*` a medias                            | Media | Alto    | PM + todos          | Paso 11 (coordinado, diferido)              |
| R8  | Dependencia accidental de "Lidomare App"                          | Baja  | Alto    | Línea DB + Producto | Antes de aplicar baseline                   |
| R9  | Baseline (PR #4) sin aplicar/validar — falsa sensación de "hecho" | Media | Alto    | Línea DB            | Fase Supabase, con autorización             |
| R10 | SQL de clínica (PR #2) fuera del baseline                         | Alta  | Medio   | Líneas clínica + DB | Antes de mergear PR #2                      |
| R11 | Filtración de datos reales                                        | Media | Alto    | Todos               | Continuo                                    |
| R12 | **Datos reales legacy en `services/python/alsari/alerts`**        | Alta  | Alto    | Seguridad + PM      | Antes de abrir el repo a terceros           |
| R13 | Bundle DayPilot >500 kB en reservas (PR #5)                       | Alta  | Medio   | Línea reservas      | Post-merge PR #5 (optimización)             |

---

## Detalle

### R1 · `.git` compartido entre worktrees

- **Descripción:** 13 worktrees usan el mismo `.git`. Un `merge`/`rebase`/`reset`/`branch -D` impacta a todas las líneas.
- **Impacto:** corrupción de trabajo de otro chat; historia enredada.
- **Mitigación:** integrar **una rama a la vez**; pausar git en el resto de chats durante el merge; checkpoint en disco previo; prohibido `--force`. Ver `04-checklist-merge.md` §A.
- **Dueño:** PM integración. **Cuándo:** continuo.

### R2 · Lockfile incoherente

- **Descripción:** `feat/reservas-agenda-hoy` (PR #5) y `demo/*` (PR #3) modifican `pnpm-lock.yaml`; un merge ingenuo lo rompe.
- **Impacto:** instalación rota, builds no reproducibles.
- **Mitigación:** **regenerar** con `pnpm install`, nunca resolver a mano (ver `02-matriz-conflictos.md` §Lockfile).
- **Dueño:** quien integra. **Cuándo:** cada PR con cambios de dependencias.

### R3 · Demo vs reservas (copia vieja)

- **Descripción:** el demo (PR #3) lleva el spike de reservas (ancestro), divergente de la versión canónica del PR #5.
- **Impacto:** si el demo se mergea antes/incorrectamente, reintroduce el spike viejo en `main`.
- **Mitigación:** PR #5 (reservas canónico) **antes** que el demo; el demo se integra **partido** (piezas 5a–5d) y sin `apps/modules/reservas/**`; **PR #3 se cierra sin merge** (ver `01` paso 10 y `02` §reservas).
- **Dueño:** línea demo + PM. **Cuándo:** antes de las piezas 5a–5d.

### R4 · Supabase legacy referenciado

- **Descripción:** módulos y cliente apuntan al proyecto legacy del holding; esquema legacy ≠ baseline limpio.
- **Impacto:** datos legacy expuestos; módulos financieros sin datos contra proyecto limpio.
- **Mitigación:** decisión tomada de **Supabase nuevo limpio** (ver `06-decision-log.md`); migrar referencias en la fase Supabase, tras baseline.
- **Dueño:** línea DB. **Cuándo:** fase Supabase (post-baseline).

### R5 · Anon key legacy en `packages/supabase-client` — **ACCIÓN URGENTE**

- **Descripción:** `packages/supabase-client/src/index.ts` contiene un **fallback hardcodeado**: URL del proyecto legacy + una **`FALLBACK_ANON_KEY`** (JWT anon real). Confirmado también por la suite QA (PR #6) como hallazgo preexistente. _(No se reproduce la clave en esta documentación.)_
- **Impacto:** cualquier build sin env apunta al proyecto legacy; credencial productiva versionada en un repo que puede ser compartido/público.
- **Mitigación:** la rotación de la anon key legacy es una **acción manual urgente que se hace en el dashboard de Supabase, FUERA del repo** — no depende de ningún PR y no debe esperar al paso 12. El fichero en sí **no se toca todavía** (decisión D9); los fallbacks se retiran en el paso 12 (diferido). **No** copiar la clave a ningún sitio.
- **Dueño:** Seguridad. **Cuándo:** rotación **ya**; retirada del fallback en el paso 12.

### R6 · Migraciones legacy del holding

- **Descripción:** `services/supabase/migrations/` tiene ~70 migraciones del holding Alsari (facturas, asientos, patrimonio, `rls_alsari_knowledge`, etc.).
- **Impacto:** confusión sobre qué esquema es el bueno; arrastre de estructura legacy al OS nuevo.
- **Mitigación:** el baseline curado (PR #4) es la **fuente única** del esquema Antifrágil; tratar las migraciones legacy como histórico/no aplicable al proyecto nuevo (ver `excluded_legacy.md` del baseline).
- **Dueño:** línea DB. **Cuándo:** fase baseline.

### R7 · Rebranding global `@alsari/*` a medias

- **Descripción:** 11 paquetes, todos los imports, `vercel.json` y la raíz siguen como `@alsari/*` / `alsari-capital-os`.
- **Impacto:** hacerlo a medias rompe imports y el build.
- **Mitigación:** **un único PR coordinado** (paso 11), con todos los chats pausados; **diferido** hasta que la integración funcional esté estable. **Nunca** empezarlo parcialmente ni mezclarlo con otro PR.
- **Dueño:** PM + todos. **Cuándo:** paso 11 (diferido).

### R8 · Dependencia accidental de "Lidomare App"

- **Descripción:** existe la tentación/inercia de reutilizar "Lidomare App" como backend/integración. Decisión tomada: **no usar Lidomare App**.
- **Impacto:** acoplar el OS a un sistema no elegido; datos en lugar equivocado.
- **Mitigación:** verificar en QA del baseline que el proyecto destino **no** es Lidomare App ni el legacy (ver `checklist-supabase-baseline` de QA); ningún cableado debe apuntar ahí.
- **Dueño:** línea DB + Producto. **Cuándo:** antes de aplicar baseline.

### R9 · Baseline nuevo sin aplicar/validar

- **Descripción:** `chore/db-baseline-antifragil-os` (PR #4) aporta SQL + checks, pero **no está aplicado** a ningún proyecto.
- **Impacto:** falsa sensación de "hecho"; checks sin ejecutar.
- **Mitigación:** mergear los **ficheros** (PR #4) está bien; la **aplicación** real es una operación separada y **autorizada aparte**, siguiendo `APPLY_RUNBOOK.md` + `post_bootstrap_checks.sql`. **No aplicar SQL en esta fase** (el PR lleva la marca NO APPLY por esto).
- **Dueño:** línea DB. **Cuándo:** fase Supabase, con autorización expresa.

### R10 · SQL de clínica fuera del baseline

- **Descripción:** `feat/clinica-fase1-catalogos` (PR #2) puso su SQL de catálogos en `services/supabase/migrations/` (migración activa), incompatible con la estrategia "baseline curado, no migrations activas" (decisión D4).
- **Impacto:** dos fuentes de verdad del esquema clínica; solape de tablas.
- **Mitigación:** el PR #2 **debe corregirse antes de merge**: alcance solo-tipos (`packages/types`), excluyendo el SQL; los catálogos se reflejan/reubican en el baseline (línea DB). Ver `01` paso 9.
- **Dueño:** líneas clínica + DB. **Cuándo:** antes de mergear PR #2.

### R11 · Filtración de datos reales

- **Descripción:** el repo legacy contiene entidades reales (Pavier, Armia, Rialsa, IBAN/CIF en docs/seed).
- **Impacto:** exposición de datos sensibles en PRs/demos.
- **Mitigación:** demo y reservas usan **solo mock**; QA pasa `check-legacy-strings` y `check-no-secrets`; enmascarar IBAN/CIF en cualquier evidencia compartida.
- **Dueño:** todos. **Cuándo:** continuo.

### R12 · Datos reales legacy en `services/python/alsari/alerts`

- **Descripción:** la suite QA (PR #6) detectó como hallazgo preexistente **datos reales (emails/contactos) en `services/python/alsari/alerts`**, código legacy del holding que sigue versionado en el repo.
- **Impacto:** mismo vector que R11 pero ya materializado en el histórico: datos personales reales versionados; problema si el repo se comparte o se hace público.
- **Mitigación:** no es alcance de ningún PR en vuelo — requiere una limpieza dedicada (retirar/anonimizar el directorio legacy) y, si el repo va a abrirse, evaluar limpieza de historial. Hasta entonces, el repo se trata como **privado y sensible**.
- **Dueño:** Seguridad + PM. **Cuándo:** antes de abrir el repo a terceros; planificar limpieza dedicada.

### R13 · Bundle DayPilot >500 kB en reservas

- **Descripción:** el módulo reservas (PR #5) empaqueta DayPilot y su build supera los 500 kB de bundle.
- **Impacto:** peso de carga en `/reservas`; warning de build; peor experiencia en conexiones lentas. **No** bloquea el merge.
- **Mitigación:** el host ya monta el módulo con `next/dynamic({ssr:false})` (carga diferida). Optimización posterior (code-splitting, evaluar alternativa ligera) como tarea propia post-merge.
- **Dueño:** línea reservas. **Cuándo:** post-merge del PR #5, como mejora.
