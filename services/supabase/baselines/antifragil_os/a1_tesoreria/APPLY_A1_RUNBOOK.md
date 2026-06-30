# Runbook de aplicación — A1 Tesorería/Caja

> A1 se aplica **encima del baseline ya aplicado y verificado**. No se ejecuta solo: lo aplica una persona (Fernando/Javi) en el SQL Editor del proyecto **nuevo**. Claude no aplica nada.

## Pre-requisitos

- [ ] El **baseline** (`00000000000000_baseline_antifragil_os.sql`) ya está aplicado en el proyecto `Antifrágil OS`.
- [ ] Estás en el proyecto **correcto** (no `Lidomare App`, no el legacy `swtyxysvnfcfxziclteq`).
- [ ] Has leído `MODEL_DECISIONS.md` y `SECURITY_CHECKLIST.md` (de la carpeta del baseline).

## Paso 1 — Confirmar baseline aplicado

1. SQL Editor → New query → pega `../post_bootstrap_checks.sql` (el del baseline) → Run.
2. La fila **RESULTADO GLOBAL** debe ser **PASS ✅**. Si no, **PARA**: arregla el baseline antes de A1.

## Paso 2 — Aplicar A1

1. New query.
2. Abre `001_a1_tesoreria_caja_draft.sql`, **selecciónalo entero** y **cópialo**.
3. Pégalo en el SQL Editor y pulsa **Run**.
4. Debe terminar en **Success**. Crea 3 tablas, 3 vistas, 3 RPC, RLS, triggers y siembra **una** cuenta de caja.

## Paso 3 — Ejecutar checks A1

1. New query → pega `post_a1_checks.sql` → Run.
2. Lee la tabla RESUMEN (PARTE 1): la fila **RESULTADO GLOBAL** debe ser **PASS ✅**.

## Paso 4 — Interpretar resultados

- **Todo PASS** → A1 aplicado correctamente. Continúa al cierre.
- **Algún FAIL** → no sigas. Usa las consultas de la PARTE 2 del archivo de checks:
  - `tablas A1` / `vistas A1` / `rpc A1` FAIL → el SQL no terminó (Paso 6).
  - `caja ... sembrada` FAIL → revisa §6 del `.sql` (seed) y que existan `ANT`/`CLI-PLY` (deben venir del baseline).
  - `medio_pago NO incluye banco` FAIL → el CHECK quedó mal; revisa §1.2 del `.sql`. **No** sigas: es una invariante.
  - `movimiento_tesoreria NO duplica banco` FAIL → revisa la vista §2.1.
  - `sin movimientos/arqueos reales` FAIL → alguien metió datos; **PARA** y revisa.

## Paso 5 — Qué hacer si FALLA

- **Error a mitad del SQL:** la base quedó a medias. **No metas datos reales.** Como A1 es aditivo sobre el baseline:
  - Lo más limpio en esta fase (sin datos reales) es **rehacer desde cero**: recrear el proyecto, reaplicar baseline + A1 (ver `../ROLLBACK_NOTES.md`).
  - El `.sql` es mayormente idempotente (`create table if not exists`, `create or replace`, seed con `on conflict do nothing`), así que **reaplicarlo entero** suele completar lo que faltó — pero ante la duda, rehaz en limpio.
- **Guarda siempre** el error completo y repórtalo para corregir el draft antes de reintentar. No parchees a mano.

## Paso 6 — No meter datos reales hasta PASS

- Hasta que `post_a1_checks.sql` dé **todo PASS**, **no** registres movimientos de caja, arqueos, ni cobros/pagos reales.
- Para probar el flujo: datos **mock** desechables (ver `UI_CONTRACT.md`), y bórralos. Nunca datos reales de pacientes/facturas/IBAN/CIF.

## Cierre

- [ ] A1 aplicado, `post_a1_checks.sql` todo PASS.
- [ ] Existe `Caja Clínica Playamar` (sin saldo).
- [ ] Pendiente (fases posteriores, NO ahora): **A1b** (puente `factura_pago → movimiento_tesoreria`), split PGC en `pgcEngine.ts` (frontend), y la **UI** de tesorería (`UI_CONTRACT.md`).
