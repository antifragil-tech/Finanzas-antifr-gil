# 06 · Registro de decisiones (decision log)

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha original: 2026-06-30
> **Actualizado: 2026-07-04 por Chat 5** — añadidas D12–D14.
> Cada decisión refleja el acuerdo vigente. Si cambia, **añadir** una entrada nueva (no reescribir la historia).

| ID  | Decisión                                                                                      | Estado  | Fecha      | Implicación operativa                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Supabase nuevo y limpio** para Antifrágil OS                                                | Vigente | 2026-06-30 | No reutilizar el proyecto legacy del holding. El esquema oficial es el baseline curado                                                                                                     |
| D2  | **No usar "Lidomare App"**                                                                    | Vigente | 2026-06-30 | Ningún cableado/integración del OS apunta a Lidomare App. QA lo verifica                                                                                                                   |
| D3  | **No usar Supabase legacy** del holding                                                       | Vigente | 2026-06-30 | Migraciones legacy = histórico, no aplicable; referencias legacy a retirar en fase Supabase                                                                                                |
| D4  | **Opción A: baseline curado** (no migraciones activas)                                        | Vigente | 2026-06-30 | El esquema vive en `services/supabase/baselines/antifragil_os/`; clínica debe reflejarse ahí, no como migración suelta                                                                     |
| D5  | **Antifrágil S.C.** como sociedad inicial                                                     | Vigente | 2026-06-30 | Seed/datos base del baseline usan Antifrágil S.C. como entidad de arranque                                                                                                                 |
| D6  | **Clínica Playamar** como proyecto activo                                                     | Vigente | 2026-06-30 | La clínica es 1 proyecto dentro del OS; reservas/agenda es su módulo prioritario                                                                                                           |
| D7  | **Chat 1 (`feat/reservas-agenda-hoy`) es canónico para reservas**                             | Vigente | 2026-06-30 | Cualquier otra copia (spike, demo) cede ante esta versión                                                                                                                                  |
| D8  | **Demo no es mergeable tal cual**                                                             | Vigente | 2026-06-30 | `demo/*` se integra **partido** y sin su copia de reservas; nunca activo en producción                                                                                                     |
| D9  | **No tocar `packages/supabase-client` todavía**                                               | Vigente | 2026-06-30 | Fallback legacy + auth-bridge se cambian en PR 9 (diferido)                                                                                                                                |
| D10 | **No rebranding global `@alsari/*` todavía**                                                  | Vigente | 2026-06-30 | Renombrado de paquetes = PR 8 único y coordinado, diferido                                                                                                                                 |
| D11 | **No SQL real / no Supabase real todavía**                                                    | Vigente | 2026-06-30 | Migraciones y baseline son ficheros versionados; aplicar requiere autorización expresa                                                                                                     |
| D12 | **Numeración real de PRs de GitHub como referencia única** + orden de integración actualizado | Vigente | 2026-07-04 | El plan usa #1–#8 reales; orden: Governance #7 → QA #6 → (Lessons #8) → Reservas #5 → rebrand visible → finanzas docs → #1 → DB #4 → Clínica #2 corregido → demo partido 5a–5d → diferidos |
| D13 | **Rotación de la anon key legacy = acción manual urgente FUERA del repo**                     | Vigente | 2026-07-04 | No espera al paso 12 ni a ningún PR; se hace en el dashboard de Supabase. El fichero `supabase-client` sigue sin tocarse (D9)                                                              |
| D14 | **PR #2 Clínica debe corregir su alcance antes de merge**                                     | Vigente | 2026-07-04 | Solo tipos (`packages/types`); el SQL activo sale del PR y se refleja en el baseline (consecuencia operativa de D4)                                                                        |

---

## Notas por decisión

### D1 · Supabase nuevo limpio

Se descarta heredar el proyecto del holding. Motivos: esquema acoplado al holding (sociedades, patrimonio, vencimientos), RLS legacy y datos reales. El OS arranca con un proyecto limpio y un esquema curado.

### D2 · No usar Lidomare App

"Lidomare" aparece como **partner** en el contexto de reservas (junto a Vivofácil), **no** como plataforma del OS. Decisión explícita: no construir sobre "Lidomare App" ni apuntar el backend ahí. En reservas, Lidomare/Vivofácil se tratan como **origen de cita mock**, no como integración real (aún).

### D3 · No usar Supabase legacy

Las ~70 migraciones del holding y el proyecto legacy quedan fuera. La referencia hardcodeada en `packages/supabase-client` se retira en la fase Supabase (PR 9). Hasta entonces, **no tocar ese fichero** (D9) pero **rotar** la anon key legacy por seguridad (ver `05-registro-riesgos.md` R5).

### D4 · Opción A — baseline curado

Frente a "ir acumulando migraciones activas", se elige **un baseline curado** reproducible en `services/supabase/baselines/antifragil_os/` (`00000000000000_baseline_antifragil_os.sql` + checks + runbook). Consecuencia directa: el SQL de catálogos clínica de `feat/clinica-fase1-catalogos` **no** va como migración suelta; se refleja en el baseline (ver R10 y PR 7).

### D5 · Antifrágil S.C. como sociedad inicial

La entidad de arranque del seed es **Antifrágil S.C.** (no Alsari Capital ni sociedades del holding). El baseline parte de ahí.

### D6 · Clínica Playamar como proyecto activo

La clínica es el primer proyecto operativo del OS. El módulo reservas/agenda (Chat 1) es la prioridad funcional. Su contabilidad enchufa en el OS financiero, no es un silo.

### D7 · Chat 1 canónico para reservas

La versión de `feat/reservas-agenda-hoy` es la fuente de verdad del módulo `@alsari/reservas`. El spike (`feat/reservas-calendario-semana`) se archiva; la copia que arrastra el demo se descarta al integrar.

### D8 · Demo no mergeable tal cual

`demo/*` es una experiencia **mock** para enseñar el OS en local, protegida por `ANTIFRAGIL_DEMO_MODE` con doble guarda anti-producción. Se integra en piezas (PR 5a–5d) y **sin** `apps/modules/reservas/**`.

### D9 · No tocar `packages/supabase-client` todavía

Cambiarlo afecta a todos los módulos a la vez. Se aísla en PR 9 (diferido), junto con el cambio de proyecto Supabase.

### D10 · No rebranding global todavía

El renombrado `@alsari/* → @antifragil/*` es transversal (package.json, imports, `vercel.json`, raíz). Se hace en un PR único y coordinado cuando la integración funcional esté estable. El **rebrand visible** de texto (`chore/financiero-copy-antifragil`) sí puede ir antes: es solo copy, no nombres de paquete.

### D11 · No SQL real / no Supabase real todavía

En esta fase nadie aplica SQL ni toca proyectos Supabase reales. Las migraciones/baseline se versionan como ficheros. Aplicarlos es una operación separada con autorización expresa y siguiendo el `APPLY_RUNBOOK.md` del baseline.

### D12 · Numeración real de PRs + orden actualizado (2026-07-04)

La numeración hipotética de la primera versión del plan chocaba con los números reales que GitHub asignó a los PRs #1–#8. Desde esta fecha, **toda referencia del plan usa los números reales**. Además, el orden de integración incorpora las líneas nuevas: **Governance (#7) va primero** porque define el proceso que gobierna el resto; **QA (#6) va antes que cualquier PR de código** para que sus gates sean utilizables desde `main`; Reservas (#5) solo pierde su marca NO MERGE tras pasar QA. Detalle completo en `01-orden-prs.md`.

### D13 · Rotación anon key legacy = acción manual urgente fuera del repo (2026-07-04)

El hallazgo R5 (anon key legacy hardcodeada en `packages/supabase-client`) se resuelve en dos tiempos: la **rotación de la credencial es inmediata y se ejecuta en el dashboard de Supabase, fuera del repo**, sin esperar a ningún PR; la retirada del fallback en código sigue diferida al paso 12 (D9 intacta). Confundir ambas cosas dejaría la credencial viva mientras "esperamos al PR".

### D14 · PR #2 Clínica corrige alcance antes de merge (2026-07-04)

Consecuencia operativa de D4 hecha explícita: el PR #2 no es mergeable tal cual porque incluye una migración SQL activa. Debe reducir su diff a `packages/types/**` (+ docs); los catálogos clínica entran al esquema vía baseline curado (PR #4), no como migración suelta.
