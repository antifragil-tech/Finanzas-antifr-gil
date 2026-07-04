# A1 Tesorería/Caja — Decisiones de modelo

Decisiones cerradas que rigen el SQL de A1. Si algo del `.sql` contradice esto, manda este documento.

## 1. Banco y caja son TIPOS de cuenta, no medios de pago
`cuenta_tesoreria.tipo ∈ {caja, banco}`. **`banco` NO es un valor de `medio_pago`.** El medio describe *cómo* se mueve el dinero; el tipo de cuenta describe *dónde* vive.

## 2. `medio_pago` es una dimensión separada y aditiva
Valores: `efectivo · tarjeta · transferencia · bizum · domiciliacion · otro`. **Sin `banco`.**
- En `movimiento_caja` el medio normal es `efectivo` (default), pero la columna admite el set completo para flexibilidad futura.
- En el lado banco (`movimientos_bancarios`) el extracto no trae medio → en `movimiento_tesoreria` el `medio_pago` del banco es `NULL`.

## 3. El banco operativo reutiliza `movimientos_bancarios`
No se crea una tabla nueva de movimientos bancarios. `movimiento_tesoreria` **lee** `movimientos_bancarios` (vía vista). Decisión A1-D1 (opción b): dos ledgers (banco existente + caja nuevo) unificados por una vista. Evita romper la importación de extractos y evita doble conteo. Para que el join del lado banco no pueda duplicar filas, una `cuenta_bancaria_id` solo puede estar detrás de **una** `cuenta_tesoreria` (índice único parcial `cuenta_tesoreria_cuenta_bancaria_uniq`).

## 4. La caja tiene ledger propio: `movimiento_caja`
Tabla nueva, append-only, para entradas/salidas de efectivo. Una caja = una `cuenta_tesoreria` de `tipo='caja'`. El `cuenta_tesoreria_id` de un `movimiento_caja` debe ser de tipo `caja` (lo valida la RPC `registrar_movimiento_caja`).

## 5. El arqueo es un control separado, no un movimiento
`arqueo_caja` compara `saldo_teorico` (derivado de `movimiento_caja`) con `saldo_contado` (recuento físico) y registra `diferencia`. **No mueve saldo por sí mismo.** Si se quiere materializar el descuadre, `cerrar_arqueo_caja(..., p_materializar_ajuste=true)` crea un `movimiento_caja` de `origen_tipo='arqueo_ajuste'` (append-only, sin borrar historia). Estados: `borrador → cerrado → revisado`.

## 6. Saldos DERIVADOS, no almacenados
El saldo de una cuenta = suma de sus movimientos (`saldo_tesoreria`, `tesoreria`). No hay campo de saldo mutable. Las correcciones son movimientos nuevos, nunca ediciones.

## 7. Vistas de resumen
- `movimiento_tesoreria` (vista): unifica banco + caja con columnas normalizadas (origen, cuenta, tipo_cuenta, medio_pago, sociedad, proyecto, fecha, importe, concepto).
- `saldo_tesoreria` (vista): saldo por sociedad · proyecto · cuenta · tipo · moneda · fecha de cálculo.
- `tesoreria` (vista): resumen por sociedad — banco operativo, caja efectivo, saldo total, cobros pendientes, pagos próximos. El detalle por proyecto se obtiene de `saldo_tesoreria` (que lleva `proyecto_id_ref`).

## 8. Puente `factura_pago → movimiento_tesoreria` DIFERIDO (A1b)
A1 deja el modelo listo (`movimiento_caja.origen_tipo='factura_pago'` + `origen_id`) pero **no implementa** el automatismo. **No se toca la firma de `registrar_pago_factura`.** El puente se hará como A1b, en un commit controlado posterior.

## 9. Sin delete físico; append-only donde aplica
- `movimiento_caja`: append-only (cliente solo SELECT; escritura por RPC). Correcciones = movimiento nuevo.
- `arqueo_caja`: cliente solo SELECT; transiciones de estado por RPC. No se borran arqueos.
- `cuenta_tesoreria`: datos maestros (alta/baja lógica vía `activa`), no delete físico esperado; FK con `on delete restrict` hacia sociedades para no perder trazabilidad.

## 10. Encaje PGC (preparado, no forzado)
`cuenta_tesoreria.cuenta_pgc` guarda el mapeo contable: `570/571` para caja/efectivo, `572-576` para banco. A1 **no** monta una contabilidad completa: solo etiqueta las cuentas para que el futuro split del motor PGC (hoy `pgcEngine.ts` agrupa 570-799 en un único `caja`) pueda separar **efectivo (570/571)** de **banco (572-576)** sin descuadrar `activoCorriente`. Ese cambio en `pgcEngine.ts` es frontend y queda **fuera de A1**.

---

### Invariantes verificables (las comprueba `post_a1_checks.sql`)
- `medio_pago` nunca contiene `banco`.
- `movimiento_tesoreria` no duplica banco (filas banco = filas de `movimientos_bancarios`; garantizado estructuralmente por el índice único `cuenta_tesoreria_cuenta_bancaria_uniq`).
- Caja/arqueo append-only (cliente solo SELECT); `anon` sin acceso; RLS on.
- Seed = una sola `Caja Clínica Playamar`, sin saldo/movimientos/arqueos.
- Sin rastro clínico en el esquema (compliance v1: sin paciente/diagnóstico/lesión/historia clínica...).
