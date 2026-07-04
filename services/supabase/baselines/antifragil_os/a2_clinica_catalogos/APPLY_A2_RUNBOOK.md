# Runbook de aplicación — A2 Clínica Catálogos

> **NO APLICAR TODAVÍA.** Este runbook existe para cuando la revisión técnica dé luz
> verde. Aplica al proyecto Supabase **nuevo** de Antifrágil OS (nunca legacy, nunca
> Lidomare App).

## Pre-requisitos

- [ ] Proyecto Supabase nuevo creado según `../APPLY_RUNBOOK.md` (pasos 0–3).
- [ ] Baseline aplicado (`../00000000000000_baseline_antifragil_os.sql`).
- [ ] `../post_bootstrap_checks.sql` ejecutado con `RESULTADO GLOBAL = PASS`.
- [ ] `../SECURITY_CHECKLIST.md` repasado (sin claves, sin datos reales).

## Paso 1 — Confirmar baseline aplicado

En el SQL Editor, ejecutar la PARTE 1 de `../post_bootstrap_checks.sql`.
Si algo da FAIL, **parar**: no aplicar A2 sobre un baseline roto.

Nota: el check `sin_objetos_A1` del baseline se refiere a A1 (tesorería). Si A1 ya se
aplicó, ese check dará FAIL de forma esperada — lo relevante para A2 es que las tablas
núcleo, RLS y seeds estén PASS.

## Paso 2 — Aplicar A2

1. Abrir `001_a2_clinica_catalogos_draft.sql`.
2. Pegar el archivo COMPLETO en el SQL Editor y ejecutar una sola vez.
3. Debe terminar sin errores. El script es re-ejecutable (`if not exists` /
   `drop ... if exists` / seed idempotente), pero no lo relances sin motivo.

## Paso 3 — Ejecutar checks A2

Ejecutar la PARTE 1 de `post_a2_checks.sql` (bloque entero).

## Paso 4 — Interpretar resultados

- `RESULTADO GLOBAL = PASS ✅` → A2 correcto. Anotar fecha y project ref (sin claves).
- Cualquier fila `FAIL` → ir al Paso 5.

## Paso 5 — Qué hacer si FALLA

1. No parchear a mano en el Dashboard.
2. Ejecutar en la PARTE 2 solo las consultas del check que falló y guardar el resultado.
3. Reportar el detalle en el PR de DB para corregir el `.sql` y re-aplicar en limpio
   (mientras no haya datos reales, la base es desechable — ver `../ROLLBACK_NOTES.md`).

## Paso 6 — No meter datos reales hasta PASS

Sin PASS completo: nada de clientes, profesionales, productos ni horarios reales.
Y **nunca** datos clínicos: no es un FAIL de checks, es una línea roja del producto.

## Cierre

- [ ] A2 aplicado con checks PASS.
- [ ] Sin datos reales introducidos.
- [ ] Resultado anotado en el PR de DB correspondiente.
