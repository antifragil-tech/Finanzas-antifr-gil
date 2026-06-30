# A1 — Tesorería / Caja (borrador, sobre el baseline `Antifrágil OS`)

> **Estado: BORRADOR. NO aplicado.** Se aplica **encima** del baseline, una vez el baseline esté aplicado y verificado. No es una migración de `services/supabase/migrations/`.

## Qué añade A1

- **Caja efectivo** con ledger propio (`movimiento_caja`, append-only).
- **Banco operativo** reutilizando `movimientos_bancarios` del baseline (**sin duplicar** movimientos).
- **Cuentas de tesorería** (`cuenta_tesoreria`): donde "vive" el dinero, tipo `caja` o `banco`.
- **Arqueo de caja** (`arqueo_caja`): teórico vs contado + diferencia, con estados `borrador/cerrado/revisado`.
- **Vista unificada** `movimiento_tesoreria` (banco + caja), **saldos** `saldo_tesoreria` (por cuenta) y **resumen** `tesoreria` (banco/caja/cobros/pagos por sociedad).
- **RPC**: `registrar_movimiento_caja`, `registrar_arqueo_caja`, `cerrar_arqueo_caja`.
- **Seed mínimo**: la cuenta de caja **`Caja Clínica Playamar`** (sociedad `ANT`, proyecto `CLI-PLY`, EUR, activa) — **sin saldo, sin movimientos, sin arqueos**.

## Qué NO añade (fuera de A1)

- **El puente `factura_pago → movimiento de tesorería`** → diferido a **A1b** (aquí solo se prepara el modelo: `movimiento_caja.origen_tipo='factura_pago'` + `origen_id` existen, pero **nada los rellena automáticamente** todavía). No se cambia la firma de `registrar_pago_factura`.
- **Contabilidad PGC completa**: A1 solo deja el mapeo (`cuenta_tesoreria.cuenta_pgc`); el split del motor PGC (570/571 vs 572-576) vive en el frontend (`pgcEngine.ts`) y es trabajo posterior.
- **Conciliación banco↔factura**, CxP/CxC con estados, recurrencia, multi-moneda real, multi-caja en producción (el modelo lo soporta; el seed crea una sola caja).
- **Frontend / UI** (ver `UI_CONTRACT.md` para el contrato de datos; la UI se construye aparte).

## Relación con el baseline

Reutiliza, **sin modificarlos**:
- `touch_updated_at()` — trigger de `updated_at`.
- `sociedades`, `proyectos` — FK de `cuenta_tesoreria` y movimientos.
- `cuentas_bancarias_sociedad` — sustrato opcional de las cuentas tipo `banco`.
- `movimientos_bancarios` — **fuente del banco operativo**; `movimiento_tesoreria` lo lee, no lo copia.
- `compromisos_tesoreria` — alimenta `tesoreria` (cobros pendientes / pagos próximos).

## Dependencias clave

- **De `movimientos_bancarios`:** el lado banco de `movimiento_tesoreria`/`saldo_tesoreria`/`tesoreria` se deriva de esa tabla. Si está vacía (base limpia), el banco operativo sale 0 hasta importar extractos.
- **De `factura_pagos`:** ninguna en A1. La relación es el **puente A1b** (diferido): un pago en efectivo de factura podrá generar un `movimiento_caja`. Hoy NO ocurre.

## Cómo se aplicaría (después del baseline)

Ver `APPLY_A1_RUNBOOK.md`. Resumen: baseline aplicado + checks baseline PASS → aplicar `001_a1_tesoreria_caja_draft.sql` → correr `post_a1_checks.sql` → todo PASS.

## Cómo verificarlo

`post_a1_checks.sql` (PARTE 1) devuelve PASS/FAIL para: existencia de las 3 tablas / 3 vistas / 3 RPC, caja sembrada (y no duplicada), sin movimientos/arqueos reales, RLS on, anon sin acceso, append-only, **`medio_pago` sin `banco`**, **`movimiento_tesoreria` sin duplicar banco**, y ausencia de legacy.

## Cómo NO meter datos reales

- El seed solo crea **una cuenta de caja** (sin saldo). No insertes movimientos, arqueos, IBAN, CIF, importes reales ni nada de pacientes/facturas.
- Para probar el flujo, usa **datos mock** desechables y bórralos; nunca en este SQL ni en el repo.

## Archivos de esta carpeta

| Archivo | Qué es |
|---|---|
| `001_a1_tesoreria_caja_draft.sql` | El SQL de A1 (tablas, vistas, RPC, RLS, triggers, seed). |
| `post_a1_checks.sql` | Verificación PASS/FAIL post-aplicación. |
| `README.md` | Este documento. |
| `MODEL_DECISIONS.md` | Decisiones de modelo (banco/caja, medio_pago, append-only, bridge diferido…). |
| `UI_CONTRACT.md` | Qué datos podrá consumir la UI (campos + ejemplos mock). |
| `APPLY_A1_RUNBOOK.md` | Cómo aplicar A1 tras el baseline, paso a paso. |
