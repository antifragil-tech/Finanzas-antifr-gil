# Notas de rollback / recuperación — Baseline `Antifrágil OS`

> Supabase no tiene un "deshacer" de migraciones sencillo. Pero como el baseline se aplica sobre un proyecto **nuevo y vacío**, la recuperación es fácil: **el proyecto entero es desechable hasta que entren datos reales.**

## Principio rector

**Mientras no haya datos reales, la base es desechable.** La forma más limpia de "hacer rollback" no es deshacer SQL: es **borrar el proyecto y crear uno nuevo**.

## Escenario 1 — Falla ANTES de producción (lo normal en esta fase)

Estás probando, no hay datos reales todavía:

1. **No** intentes arreglar el esquema a mano desde el Table Editor.
2. **Guarda el error** (mensaje completo + en qué consulta/línea ocurrió).
3. **Borra el proyecto** (Project Settings → General → Delete project) y **vuelve a crearlo** siguiendo `APPLY_RUNBOOK.md`.
4. Si el error venía del propio `.sql`, repórtalo para corregir el baseline **antes** de reaplicar. No reapliques el mismo SQL roto esperando otro resultado.

## Escenario 2 — Falla A MITAD del SQL

El `Run` se cortó por un error en medio del script:

1. La base quedó **a medias** (algunas tablas sí, otras no). **No es válida.**
2. **No metas datos reales** sobre una base incompleta.
3. **No** parchees tabla por tabla a mano.
4. Lo correcto: **borrar el proyecto y recrear** (Escenario 1), tras corregir el `.sql`.
   - Alternativa solo si sabes lo que haces: el script usa `create table if not exists` y `create or replace`, así que **reaplicarlo entero** suele ser idempotente y completa lo que faltó. Pero ante la duda, recrea el proyecto en limpio.

## Escenario 3 — Los checks post-bootstrap dan FAIL

1. Mira el DETALLE en `post_bootstrap_checks.sql` para saber qué falta.
2. Si falta esquema → trátalo como Escenario 1/2.
3. Si aparece algo **legacy** o un **objeto A1** que no debería → **PARA** y avisa; no borres a mano, documenta primero qué hay.

## Reglas que SIEMPRE se cumplen

- ✅ **Registrar siempre** el error/contexto antes de borrar nada.
- ✅ Reaplicar en un proyecto **limpio** si hay dudas.
- ❌ **No** arreglar el esquema a mano sin registrarlo.
- ❌ **No** meter datos reales hasta que el baseline aplique limpio y los checks den todo `PASS`.
- ❌ **No** tocar `Lidomare App` ni el Supabase legacy en ningún caso.
- ❌ **No** reutilizar claves del proyecto borrado en el nuevo (genera claves nuevas).

## Cuando YA haya datos reales (futuro)

Esto cambia: borrar el proyecto deja de ser una opción. A partir de ese momento habrá que apoyarse en los **backups / PITR** de Supabase y en migraciones aditivas con cuidado. Ese régimen queda **fuera** de esta fase de bootstrap; documentarlo cuando se llegue ahí.
