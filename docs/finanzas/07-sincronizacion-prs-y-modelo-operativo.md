# Sincronización — Modelo operativo financiero ↔ PRs vivos (2026-07-04)

> **Estado:** Documental. **Sin código, sin SQL aplicado, sin Supabase real, sin datos reales ni clínicos.**
> **Rama:** `docs/finanzas-modelo-operativo`
> **Propósito:** dejar en un solo sitio cómo encajan los docs 00-06 de esta rama con el estado real del repo (PR #4 baseline+A1 y PR #1 facturación emitida), y fijar los principios del modelo operativo que no admiten ambigüedad.

---

## 1. Mapa de líneas de trabajo

| Línea                                       | Dónde vive                                                                                          | Estado real (2026-07-04)                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Modelo operativo financiero** (esta rama) | docs `00`, `01`, `03`, `04`, `05`, `06` en `docs/finanzas/`                                         | Documental; contrato de diseño de las fases F-Op                                              |
| **DB baseline + A1 Tesorería/Caja**         | **PR #4** — rama `chore/db-baseline-antifragil-os`, head `27f6392`                                  | **Draft / NO APPLY.** Draft SQL revisable; **nada ejecutado** en Supabase                     |
| **Facturación emitida**                     | **PR #1** — rama `docs/finanzas-facturacion-emitida-design`, doc `02-diseno-facturacion-emitida.md` | Diseño documental; decisiones D1/D2 registradas (OS precontable, Clínica sin IVA provisional) |
| **Clínica / reservas**                      | Otra línea (schema `clinica` futuro)                                                                | Fuera de alcance aquí; las dimensiones finas agregan por `proyecto_id_ref`                    |

---

## 2. Relación con el PR #4 (baseline + A1 Tesorería/Caja)

El mini-diseño **F-Op A1** ([06](06-fop-a1-efectivo-banco-arqueo.md)) ya tiene draft SQL en el PR #4:

- **Incluye:** `cuenta_tesoreria` (tipos `caja`/`banco`), `movimiento_caja` (ledger de efectivo append-only, escritura solo por RPC), `arqueo_caja` (control con estados y ajuste materializable), y las vistas `movimiento_tesoreria`, `saldo_tesoreria` y `tesoreria`.
- **Arquitectura A1-D1 opción (b):** `movimientos_bancarios` se conserva como ledger de banco; la vista unifica caja + banco sin doble conteo.
- **Diferido a A1b:** el puente automático `factura_pago → movimiento_tesoreria`. El modelo queda preparado (`origen_tipo`/`origen_id`) pero no hay automatismo y no se toca `registrar_pago_factura`.
- **NO APLICADO:** el PR #4 es Draft / NO APPLY. **No se afirma en ningún doc que el SQL esté ejecutado ni que exista un Supabase real con este esquema.**

## 3. Relación con el PR #1 (facturación emitida)

- La facturación emitida es **diseño documental** (doc `02`, PR #1); no hay código ni migraciones de esa línea.
- **El OS es precontable:** registra la operación (cobros, borradores, prefacturas, datos para gestoría) pero **no emite factura legal oficial todavía**.
- **Veri\*factu / emisión legal** queda en la **gestoría o en un sistema externo homologado** (decisión F4-D, 2026-06-26, opción "delegar").
- **Pendientes:** F4-A (quién emite), F4-B (cuenta de ingreso 705 vs 700), F4-E (serie propia de la clínica), y el criterio de la gestoría para **F4-C** (mapa exención↔servicio y prorrata; provisional: Clínica sin IVA, `exento_provisional`).
- **F4.0 no se abre** (ni ninguna sub-fase F4.x) **sin autorización expresa de Guille.**

---

## 4. Principios del modelo operativo (sin ambigüedad)

1. **Tesorería no es contabilidad completa.** Es la verdad de caja operativa; el cierre fiscal es de la gestoría.
2. **Caja y banco son fuentes de movimiento**, cada una con su ledger: la caja con `movimiento_caja` (nuevo), el banco con `movimientos_bancarios` (extractos importados). Una vista los unifica; los saldos son **derivados**, nunca almacenados.
3. **Medio de pago NO es banco.** El medio (`efectivo · tarjeta · transferencia · bizum · domiciliación · otro`) describe _cómo_ se mueve el dinero; caja/banco son **tipos de cuenta** donde vive (A1-D6).
4. **La caja requiere arqueos.** Diario los días con movimiento de efectivo, semanal como mínimo si no (A1-D3). El arqueo es un control, no un movimiento.
5. **El banco vendrá de movimientos bancarios.** El saldo operativo sale del ledger de extractos; el contable (PGC 572) manda para cierre/gestoría; ambos se muestran etiquetados, nunca como una sola cifra (A1-D5). La conexión directa con la entidad bancaria queda **diferida**.
6. **Facturas y cobros se reconcilian con tesorería en fases posteriores** (A1b para el puente de pagos; conciliación con auto-match en lotes posteriores). A1 solo separa y clasifica, no añade importes.
7. **La rentabilidad se calcula por proyecto/servicio/canal, no por intuición**: devengo en fecha de prestación, costes directos imputados, margen de contribución primero (D-op-2, D-op-7).
8. **Todo esto es operativo/precontable, no fiscal definitivo.** Ninguna cifra de estas capas sustituye a la contabilidad oficial ni a la liquidación de la gestoría.

---

## 5. Riesgos y salvaguardas vigentes

Recogidos en detalle en [05 — Riesgos y salvaguardas transversales](05-backlog-finanzas-operativas.md): no aplicar SQL (PR #4 = NO APPLY) · no mezclar con legacy · no tocar `packages/supabase-client` · no usar datos reales ni clínicos · no confundir factura legal con registro operativo · rotación de la `anon key` legacy pendiente **fuera del repo** · A1b diferido · conexión real a banco diferida.

---

_Documento de sincronización. No modifica código productivo, SQL, tipos ni UI. Refleja el estado de los PRs a 2026-07-04._
