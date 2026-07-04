# F-Op A1 — Mini-diseño técnico: efectivo vs banco + arqueo de caja

> **Estado:** Mini-diseño técnico. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Prepara la futura implementación del lote A1 del backlog.
> **Rama:** `docs/finanzas-modelo-operativo`
> **Fecha:** 2026-06-26
> **Depende de:** [05-backlog...](05-backlog-finanzas-operativas.md) (F-Op A1) · [04-finanzas-operativas...](04-finanzas-operativas-mapa-y-gaps.md) (Lente 1)
> **Regla:** reutilizar antes de crear. No romper facturas recibidas ni el cashflow actual. Migraciones futuras se aplican a mano por el Dashboard de Supabase (riesgo de drift).
> **Marcas `✅ DECISIÓN RESUELTA`:** bifurcaciones técnicas ya decididas por Guille (recapituladas en §9).
> **Sincronización 2026-07-04:** este diseño ya tiene **draft SQL en el PR #4** (`chore/db-baseline-antifragil-os`, head `27f6392`, **Draft / NO APPLY — nada aplicado en Supabase**). Estado real en §10.

---

## 1. Problema actual

### 1.1 Qué existe hoy

- **Saldo de "caja" (capa balance/KPI):** el motor PGC calcula un único KPI `caja` a partir de las cuentas del grupo 57. Regla en [pgcEngine.ts:34](apps/modules/financiero/src/lib/pgcEngine.ts#L34): `{ from: 5700, to: 5799, cat: 'caja' }`. Ese KPI alimenta el dashboard de `financiero`, el fondo de maniobra y la deuda financiera neta.
- **Ledger de banco (capa transaccional):** [`movimientos_bancarios`](services/supabase/migrations/20260521090000_movimientos_bancarios.sql) guarda las transacciones **importadas de extractos** (campos `iban`, `banco`, `importe` con signo, `categoria`, `proyecto_id_ref`, FK opcional `factura_recibida_id`). Importación atómica y deduplicada por hash.
- **Cuentas bancarias:** ya modeladas en [`cuentas_bancarias_sociedad`](services/supabase/migrations/20260522120000_sociedades_ficha_bancaria.sql#L20) (`alias`, `titular`, `banco`, `iban`, `swift`, `activa`, `sociedad_id_ref`).
- **Medio de pago (parcial):** [`factura_pagos.metodo_pago`](services/supabase/migrations/202606192100_factura_pagos.sql#L21) con enum `transferencia | domiciliacion | tarjeta | efectivo | otro`. Es el libro append-only de pagos **reales de facturas recibidas** (RPC `registrar_pago_factura`).
- **Cashflow:** vistas `cashflow_consolidado` / `flujos_proyecto_consolidados` consolidan flujos por capas (real/comprometido/previsto) y fuentes (factura/presupuesto/vencimiento/manual).

### 1.2 Por qué no basta

- **No se puede responder "¿cuánto tengo en efectivo?"**: no existe ningún ledger de caja física. El efectivo solo aparece como `metodo_pago='efectivo'` en pagos de facturas, pero eso **no actualiza ningún saldo de caja** ni cubre cobros, ni vencimientos, ni movimientos manuales.
- **Banco y efectivo se presentan juntos:** el KPI `caja` del PGC suma 570 (efectivo) + 572 (bancos) en una sola cifra (§1.3). El dashboard muestra "caja disponible", no "banco" y "efectivo" por separado.
- **El medio es incompleto y local:** `metodo_pago` no incluye `bizum` ni distingue `datáfono`; y solo vive en `factura_pagos` (un solo flujo de salida), no en cobros ni en el resto de pagos.
- **No hay arqueo:** nada cuadra el efectivo contado contra el teórico; los descuadres de caja no se detectan ni registran.
- **Dos nociones de "banco" no reconciliadas:** el saldo contable (PGC 572, de sumas y saldos) y el saldo operativo (suma de `movimientos_bancarios`) pueden divergir y hoy nadie los concilia explícitamente.

### 1.3 Dónde se mezclan efectivo y banco

| Capa | Dónde | Cómo se mezclan |
|---|---|---|
| Balance / KPI | [pgcEngine.ts:34](apps/modules/financiero/src/lib/pgcEngine.ts#L34) | La regla `5700–5799 → 'caja'` agrupa 570 (caja euros), 571 (caja divisa) **y** 572–576 (bancos) en un único saldo `caja` |
| Transaccional | `movimientos_bancarios` + ausencia de ledger de caja | El banco tiene ledger; el efectivo **no tiene ningún sitio** → no se puede separar lo que no se registra |
| Pago de facturas | `factura_pagos.metodo_pago` | El medio se anota, pero no impacta saldo alguno de caja/banco |

---

## 2. Objetivo

1. **Separar efectivo vs banco** en las dos capas: KPI (PGC) y operativa (ledger).
2. **Distinguir caja física y banco** como **cuentas de tesorería** independientes, cada una con su saldo.
3. **Permitir arqueo de caja:** comparar saldo teórico vs contado y registrar el descuadre.
4. **Seguir pagos/cobros por medio:** todo movimiento de dinero lleva su `medio` (efectivo/banco/tarjeta/transferencia/bizum/otro).
5. **Preparar la conciliación** (no implementarla aquí): dejar el modelo listo para enlazar movimientos de banco con sus facturas/pagos.

**Fuera de alcance de A1:** auto-match de conciliación (lote posterior), CxP/CxC con estados (A2), recurrencia (A3), y cualquier dato de la Clínica.

---

## 3. Modelo conceptual

> Conceptual, no esquema final. Nombres y campos son tentativos para decidir; las columnas exactas se fijan en la fase de implementación con su migración.

### 3.1 `medio_pago` (enum / dimensión)
Valores: `efectivo · tarjeta · transferencia · bizum · domiciliacion · otro`. **`banco` NO es un medio de pago** (✅ A1-D6, §9): el *medio* describe **cómo** se mueve el dinero; banco/caja son **tipos de cuenta** (`cuenta_tesoreria.tipo`), es decir, **dónde** vive.
- Amplía el enum actual de `factura_pagos.metodo_pago` (que hoy no tiene `bizum`).
- **Agrupación derivada:** cada medio cae en una **clase de cuenta** → `efectivo` ⇒ caja física; `tarjeta/transferencia/bizum/domiciliacion` ⇒ banco. En el lado banco, el extracto importado no trae medio → el `medio_pago` de un movimiento bancario puede ser `NULL`. `tarjeta`/`datáfono` puede llevar subtipo si se quiere medir comisión (futuro, no A1).

### 3.2 `cuenta_tesoreria` (nueva — la clave del diseño)
Una cuenta donde "vive" dinero. Generaliza banco + caja:

| Campo (tentativo) | Para qué |
|---|---|
| `id`, `sociedad_id_ref` | identidad + sociedad |
| `tipo` | `caja` (física) \| `banco` |
| `nombre` / `alias` | "Caja clínica Playamar", "BBVA principal" |
| `cuenta_bancaria_id` | FK opcional a [`cuentas_bancarias_sociedad`](services/supabase/migrations/20260522120000_sociedades_ficha_bancaria.sql#L20) cuando `tipo='banco'` |
| `cuenta_pgc` | mapeo contable: 570/571 para caja, 572–576 para banco |
| `activa` | alta/baja |

- **Banco se apoya en lo que ya existe** (`cuentas_bancarias_sociedad`); **caja física es lo nuevo** (hoy no existe).
- El saldo de cada cuenta es **derivado** (suma de sus movimientos), no un campo mutable, para evitar descuadres.

### 3.3 `movimiento_tesoreria` (entrada/salida de una cuenta)
El hecho de que entra o sale dinero de una `cuenta_tesoreria`:

| Campo (tentativo) | Para qué |
|---|---|
| `id`, `cuenta_tesoreria_id` | a qué caja/banco afecta |
| `fecha`, `importe` (con signo), `concepto` | el movimiento |
| `medio_pago` | medio (§3.1) |
| `origen_tipo` / `origen_id` | de dónde viene: `factura_pago` \| `cobro` \| `vencimiento` \| `manual` \| `arqueo_ajuste` |
| `proyecto_id_ref`, `sociedad_id_ref` | etiquetado dimensional |
| `movimiento_bancario_id` | FK opcional para conciliar con el extracto (banco) |

✅ **DECISIÓN RESUELTA A1-D1 (arquitectura del ledger) → opción (b); ver §9.** Opciones consideradas —
- **(a) Ledger único** `movimiento_tesoreria` para caja **y** banco; `movimientos_bancarios` queda como fuente de importación que "alimenta" el ledger.
- **(b) Dos ledgers + vista** *(elegida)*: se **conserva** `movimientos_bancarios` como ledger de banco (ya maduro: import + dedup) y se crea un ledger **solo de caja** para el efectivo; una **vista `tesoreria`** unifica ambos y calcula los dos saldos. Menor riesgo, no toca el import de extractos.

### 3.4 `arqueo_caja` (control, no movimiento)
Cierre/cuadre de una caja física en una fecha:

| Campo (tentativo) | Para qué |
|---|---|
| `id`, `cuenta_tesoreria_id` (tipo=caja), `fecha` | qué caja y cuándo |
| `saldo_teorico` | **derivado**: saldo de la caja según sus movimientos hasta la fecha |
| `saldo_contado` | introducido a mano (recuento físico) |
| `descuadre` | `saldo_contado − saldo_teorico` |
| `resuelto`, `registrado_por_email`, `notas` | gestión + trazabilidad |

- El **descuadre** puede generar (opcionalmente) un `movimiento_tesoreria` de ajuste con `origen_tipo='arqueo_ajuste'`, para que el saldo refleje la realidad sin borrar historia (append-only).

### 3.5 Relación con lo existente

```
factura_recibida ──(pago)──► factura_pagos.metodo_pago ──► movimiento_tesoreria (efectivo o banco)
vencimiento (cobro/pago) ───────────────────────────────► movimiento_tesoreria
cobro/ingreso (futuro Clínica) ─────────────────────────► movimiento_tesoreria
extracto bancario ──► movimientos_bancarios ──(concilia)─► movimiento_tesoreria (banco)
                                                            │
cuenta_tesoreria (caja|banco) ◄── saldos derivados ────────┤
                                                            ▼
arqueo_caja (solo cajas)        cashflow_consolidado (sin doble conteo)
```

- **Banco:** un movimiento de tesorería de banco **es** (o se concilia con) un `movimientos_bancarios`. No se cuenta dos veces.
- **Cashflow:** sigue consolidando lo de siempre; A1 **no añade una nueva fuente de importe**, solo clasifica por `medio`/cuenta y separa los saldos. El efectivo que hoy no se veía aflora, pero como **clasificación**, no como ingreso nuevo.

---

## 4. Qué reutilizar del repo

| Pieza | Reutilización en A1 |
|---|---|
| [`facturas_recibidas`](services/supabase/migrations/20260521090100_facturas.sql) | sin cambios; su pago sigue igual, solo que el pago genera/clasifica un movimiento de tesorería |
| [`factura_pagos`](services/supabase/migrations/202606192100_factura_pagos.sql) + RPC `registrar_pago_factura` | patrón append-only + actor por `auth.jwt()`; se replica para movimientos/arqueo. El `metodo_pago` se amplía a `medio_pago` |
| `movimientos_bancarios` | ledger de banco existente (opción b: se conserva como fuente del lado banco) |
| `cuentas_bancarias_sociedad` | sustrato de cuentas de banco para `cuenta_tesoreria.tipo='banco'` |
| `cashflow_consolidado` / `flujos_proyecto_consolidados` | se mantienen; A1 añade desglose por `medio`, no nueva fuente |
| `pgcEngine.ts` (570/572) | se conserva el motor; solo se **parte la regla** del grupo 57 (§5) |
| Vistas `CashflowView` / dashboard de `financiero` | base para mostrar los dos saldos |

---

## 5. Qué habría que adaptar

| Área | Adaptación |
|---|---|
| **Campos** | enum `medio_pago` (añadir `bizum`, normalizar `domiciliacion`/`tarjeta`); `medio` en cobros y en todo pago, no solo `factura_pagos` |
| **PGC** | partir la regla [pgcEngine.ts:34](apps/modules/financiero/src/lib/pgcEngine.ts#L34) en **efectivo** (`5700–5719`) y **banco** (`5720–5769`), exponiendo dos KPIs en `BalanceKPIs` (`efectivo`, `banco`) sin romper `activoCorriente`/`fondoManiobra` (que siguen sumando ambos) |
| **Vistas** | nueva vista `tesoreria` que une caja + banco y deriva saldos; ampliar el cashflow para filtrar por `medio`/cuenta |
| **UI** | dashboard con **dos saldos** (Efectivo / Banco / Total); pantalla de **arqueo de caja**; selector de `medio` y `cuenta_tesoreria` al registrar cobro/pago |
| **Tipos** | `@alsari/types`: `MedioPago`, `CuentaTesoreria`, `MovimientoTesoreria`, `ArqueoCaja`; ampliar `BalanceKPIs` con `efectivo`/`banco` |
| **Migraciones futuras** | crear `cuenta_tesoreria`, ledger de caja (opción b) y `arqueo_caja`; ampliar enum de medio; **aplicadas a mano por Dashboard** |
| **Validaciones** | reglas duras de §6 (medio obligatorio, coherencia tipo cuenta ↔ medio, arqueo no es movimiento) |

---

## 6. Reglas (invariantes del modelo)

1. **Todo pago/cobro registrado en caja debe tener `medio`.** No se registra efectivo sin medio. En el lado banco, el movimiento importado del extracto puede llevar `medio_pago = NULL` (el extracto no lo trae).
2. **Efectivo requiere una caja.** `medio='efectivo'` ⇒ el movimiento apunta a una `cuenta_tesoreria` de `tipo='caja'`.
3. **Banco requiere una cuenta bancaria.** `medio ∈ {transferencia, tarjeta, bizum, domiciliacion}` ⇒ `cuenta_tesoreria` de `tipo='banco'` (con su `cuenta_bancaria_id`; una cuenta bancaria solo puede estar detrás de **una** cuenta de tesorería, para que el lado banco no pueda duplicarse).
4. **El arqueo no es un movimiento, es un control.** No mueve saldo por sí mismo; si hay descuadre, se materializa con un movimiento de ajuste explícito y trazado.
5. **No mezclar saldo de banco con caja física.** Son cuentas separadas; el "total" es una suma presentada, nunca un saldo único almacenado.
6. **Saldos derivados, libro append-only.** El saldo se calcula sumando movimientos; las correcciones se hacen con movimientos nuevos (patrón `factura_pagos`), nunca editando/borrando.
7. **Sin doble conteo en cashflow.** Un mismo dinero entra una vez; A1 reclasifica por medio/cuenta, no añade importe.

---

## 7. Criterio de "hecho"

- [ ] Se puede ver **cuánto hay en banco** (por cuenta y total).
- [ ] Se puede ver **cuánto hay en efectivo** (por caja y total).
- [ ] Se pueden **registrar cobros y pagos por medio**, asociados a su `cuenta_tesoreria`.
- [ ] Se puede **hacer un arqueo de caja** (teórico vs contado) y queda registrado el descuadre.
- [ ] El **cashflow no duplica importes** y el balance del PGC sigue cuadrando (`balanceDiff ≈ 0`).
- [ ] Las reglas §6 se validan (no se admite efectivo sin caja, ni banco sin cuenta).

---

## 8. Riesgos

1. **Drift BD ↔ repo:** las migraciones se aplican a mano por el Dashboard; auditar la **paridad real** del schema (¿existe ya `cuentas_bancarias_sociedad` en producción? ¿qué cuentas 57x hay?) **antes** de implementar.
2. **No romper facturas recibidas:** el flujo de pago (`registrar_pago_factura`) y sus incidencias deben seguir funcionando; el movimiento de tesorería se añade **encima**, sin cambiar el contrato de la RPC.
3. **No romper el cashflow actual:** las vistas `cashflow_consolidado`/`flujos_proyecto_consolidados` no deben cambiar de importe; solo se añade clasificación. Vigilar doble conteo banco (movimiento_bancario ↔ movimiento_tesoreria).
4. **PGC:** partir la regla 57 mal puede descuadrar `caja`/`fondoManiobra`/`deudaFinancieraNeta`. La suma efectivo+banco debe seguir dando el mismo `activoCorriente`.
5. **Dos nociones de saldo banco** (contable PGC 572 vs operativo `movimientos_bancarios`): definir cuál manda en el dashboard y cómo se reconcilian (preparar, no resolver en A1).
6. **Coordinación con Fase 2:** A1 toca el dashboard de `financiero`, el mismo que Fase 2 va a podar/renombrar; secuenciar para no colisionar.

---

## 9. Decisiones resueltas (Guille, 2026-06-26)

- **✅ A1-D1 — Arquitectura del ledger → opción (b).** Se **mantiene `movimientos_bancarios`** como ledger de banco, se **crea un ledger separado para caja/efectivo**, y ambos se **unifican mediante una vista de tesorería**. *Motivo:* menor riesgo y no rompe la importación de extractos.
- **✅ A1-D2 — Alcance del efectivo → una caja inicial, modelo multi-caja.** Se empieza con **una sola caja: `Caja Clínica Playamar`**, pero `cuenta_tesoreria` (tipo caja) se diseña **preparada para varias cajas** futuras (sin hardcodear una única).
- **✅ A1-D3 — Frecuencia de arqueo → diario con efectivo, semanal si no.** **Arqueo diario** los días con movimientos en efectivo; si no hay efectivo, **mínimo semanal**. (Liga con ⚠️ F-1 del doc 04.)
- **✅ A1-D4 — Tarjeta/datáfono → en A1 solo el medio `tarjeta`.** Las **comisiones del datáfono quedan fuera de A1** y se tratarán más adelante como **gasto financiero/operativo** (no se separa el subtipo ni la comisión en este lote).
- **✅ A1-D5 — Saldo de banco → dos saldos etiquetados.** Para **gestión diaria manda el saldo operativo** (suma de `movimientos_bancarios`); para **cierre/gestoría manda el saldo contable/conciliado** (PGC 572). **Ambos pueden coexistir, pero deben mostrarse etiquetados de forma distinta** (no presentarse como una única cifra).
- **✅ A1-D6 — `medio_pago` SIN `banco` (fijado en el draft SQL del PR #4).** `banco` no es un valor de `medio_pago`; banco y caja son **tipos** de `cuenta_tesoreria`. El medio describe *cómo* se mueve el dinero (efectivo/tarjeta/transferencia/bizum/domiciliación/otro); el tipo de cuenta, *dónde* vive. §3.1 y §6 de este documento quedan alineados con esa decisión.

---

## 10. Estado de implementación (sincronizado 2026-07-04)

Este mini-diseño ya tiene **implementación draft en SQL** en el **PR #4** — `DRAFT / NO APPLY — db: baseline Supabase Antifrágil OS + A1 Tesorería/Caja` (rama `chore/db-baseline-antifragil-os`, head `27f6392`):

- El draft `services/supabase/baselines/antifragil_os/a1_tesoreria/001_a1_tesoreria_caja_draft.sql` crea: **`cuenta_tesoreria`** (tipos `caja`/`banco`), **`movimiento_caja`** (ledger de efectivo, append-only, escritura solo por RPC), **`arqueo_caja`** (estados `borrador → cerrado → revisado`, con ajuste materializable opcional), y las vistas **`movimiento_tesoreria`**, **`saldo_tesoreria`** y **`tesoreria`**.
- Respeta la decisión **A1-D1 opción (b)**: `movimientos_bancarios` se conserva como ledger de banco y la vista unifica ambos lados sin doble conteo (índice único: una cuenta bancaria ↔ una cuenta de tesorería).
- **El puente `factura_pago → movimiento_tesoreria` queda DIFERIDO a A1b.** El modelo lo deja preparado (`origen_tipo='factura_pago'` + `origen_id`) pero no hay automatismo y **no se toca la firma de `registrar_pago_factura`**.
- **Nada está aplicado.** El PR #4 es **Draft / NO APPLY**: el SQL no se ha ejecutado y no existe un Supabase real con este esquema. Este documento no describe estado de producción, describe un diseño con draft SQL revisable.
- La **conexión real a banco** (importación automática desde la entidad bancaria) también queda **diferida**; el lado banco parte de extractos importados.

---

*Mini-diseño técnico de F-Op A1. No modifica código, SQL, tipos ni UI. Requiere validación de Guille antes de abrir implementación.*
