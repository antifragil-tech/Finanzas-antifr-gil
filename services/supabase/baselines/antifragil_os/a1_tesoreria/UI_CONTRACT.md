# A1 Tesorería/Caja — Contrato de datos para la UI

> Qué podrá consumir la interfaz cuando A1 esté aplicado. **Campos + ejemplos mock** (datos inventados, NO reales). La UI se construye en una fase aparte; esto es el contrato.

## Fuentes (todas de solo lectura para la UI; las escrituras van por RPC)

| Componente UI | Fuente | Tipo |
|---|---|---|
| Tarjeta **Banco operativo** | `tesoreria.banco_operativo` | vista |
| Tarjeta **Caja efectivo** | `tesoreria.caja_efectivo` | vista |
| Tarjeta **Saldo total operativo** | `tesoreria.saldo_operativo_total` | vista |
| **Cobros pendientes** / **Pagos próximos** | `tesoreria.cobros_pendientes` / `tesoreria.pagos_proximos` | vista |
| **Saldo por cuenta** | `saldo_tesoreria` | vista |
| **Lista de movimientos de tesorería** | `movimiento_tesoreria` | vista |
| **Arqueo de caja** | `arqueo_caja` (+ RPC) | tabla |
| Vista **por sociedad** | `tesoreria` (grain sociedad) | vista |
| Vista **por proyecto** | `saldo_tesoreria` (lleva `proyecto_id_ref`) | vista |

## 1. Tarjetas de resumen — `tesoreria`
Campos: `sociedad_id_ref, banco_operativo, caja_efectivo, saldo_operativo_total, cobros_pendientes, pagos_proximos, fecha_calculo`.
```json
{ "sociedad_id_ref": "ANT", "banco_operativo": 12450.00, "caja_efectivo": 320.50,
  "saldo_operativo_total": 12770.50, "cobros_pendientes": 1800.00,
  "pagos_proximos": -2150.00, "fecha_calculo": "2026-07-01" }
```
> `pagos_proximos` es **negativo** (salidas), consistente con el signo de cashflow. La UI puede mostrar su valor absoluto.

## 2. Saldo por cuenta — `saldo_tesoreria`
Campos: `sociedad_id_ref, proyecto_id_ref, cuenta_tesoreria_id, tipo_cuenta, moneda, saldo, num_movimientos, ultimo_movimiento, fecha_calculo`.
```json
{ "sociedad_id_ref": "ANT", "proyecto_id_ref": "CLI-PLY",
  "cuenta_tesoreria_id": "00000000-0000-0000-0000-000000000000",
  "tipo_cuenta": "caja", "moneda": "EUR", "saldo": 320.50,
  "num_movimientos": 7, "ultimo_movimiento": "2026-07-01", "fecha_calculo": "2026-07-01" }
```

## 3. Lista de movimientos — `movimiento_tesoreria`
Campos: `id, origen ('banco'|'caja'), cuenta_tesoreria_id, tipo_cuenta, medio_pago, sociedad_id_ref, proyecto_id_ref, fecha, importe, concepto, referencia, estado, origen_detalle`.
```json
[
  { "id":"...","origen":"caja","tipo_cuenta":"caja","medio_pago":"efectivo",
    "sociedad_id_ref":"ANT","proyecto_id_ref":"CLI-PLY","fecha":"2026-07-01",
    "importe":45.00,"concepto":"Cobro sesión (mock)","referencia":null,
    "estado":"registrado","origen_detalle":"cobro" },
  { "id":"...","origen":"banco","tipo_cuenta":"banco","medio_pago":null,
    "sociedad_id_ref":"ANT","proyecto_id_ref":null,"fecha":"2026-06-30",
    "importe":-89.90,"concepto":"Recibo suministro (mock)","referencia":"REF-0099",
    "estado":"pendiente_revision","origen_detalle":"extracto" }
]
```
> `medio_pago` es `null` en filas de banco (el extracto no lo trae). `importe` con signo (+ entra, − sale).
> `referencia`: banco → `movimientos_bancarios.referencia`; caja → `origen_id` del movimiento (p.ej. el pago vinculado en A1b).
> `estado`: banco → `revisado`/`pendiente_revision` (según `movimientos_bancarios.revisado`); caja → `registrado`.

## 4. Arqueo de caja — `arqueo_caja`
Campos: `id, cuenta_tesoreria_id, fecha, saldo_teorico, saldo_contado, diferencia, observaciones, registrado_por_email, ajuste_movimiento_id, estado, created_at, updated_at`.
```json
{ "id":"...","cuenta_tesoreria_id":"...","fecha":"2026-07-01",
  "saldo_teorico":320.50,"saldo_contado":318.00,"diferencia":-2.50,
  "observaciones":"Falta cambio (mock)","estado":"borrador","ajuste_movimiento_id":null }
```
Acciones (RPC, no escritura directa):
- Registrar movimiento de caja → `registrar_movimiento_caja(cuenta, importe, concepto, [fecha, medio_pago, ...])`.
- Crear arqueo → `registrar_arqueo_caja(cuenta, saldo_contado, [fecha, observaciones])`.
- Cerrar arqueo → `cerrar_arqueo_caja(arqueo_id, [materializar_ajuste, comentario])`.

## 5. Selector de cuenta — `cuenta_tesoreria`
Para formularios de cobro/pago: `id, tipo ('caja'|'banco'), nombre, sociedad_id_ref, proyecto_id_ref, moneda, activa`.
```json
{ "id":"...","tipo":"caja","nombre":"Caja Clínica Playamar",
  "sociedad_id_ref":"ANT","proyecto_id_ref":"CLI-PLY","moneda":"EUR","activa":true }
```

## Reglas para la UI
- **Banco y caja se muestran SEPARADOS** (dos cifras), nunca sumados en un único "disponible" sin desglose.
- El selector de **medio de pago** ofrece `efectivo/tarjeta/transferencia/bizum/domiciliacion/otro` — **nunca `banco`**.
- El **medio** y la **cuenta de tesorería** son campos distintos (uno no implica el otro).
- Todos los ejemplos de arriba son **mock**; no cargar datos reales para "probar la UI" sobre el proyecto real.
