# Backlog operativo — Finanzas Operativas Antifrágil OS

> **Estado:** Documentación. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Convierte el doc 04 en fases implementables y priorizadas para decidir el orden de trabajo.
> **Rama:** `docs/finanzas-modelo-operativo`
> **Fecha:** 2026-06-26
> **Depende de:** [04-finanzas-operativas-mapa-y-gaps.md](04-finanzas-operativas-mapa-y-gaps.md) · [00-auditoria...](00-auditoria-base-financiera-antifragil.md) · [01-modelo-conceptual...](01-modelo-conceptual-antifragil.md) · [03-plan-fase2...](03-plan-fase2-adaptacion-financiero.md)
> **Regla:** ninguna fase abre código sin su diseño validado por Guille. Reutilizar antes de crear. No importar Excel.

---

## 0. Cómo leer este backlog

Cuatro fases operativas (F-Op A/B/C/D), cada una dividida en **lotes** pequeños e implementables por separado. Cada fase se describe con los **9 atributos** que pediste: objetivo · problema que resuelve · reutiliza · crear/adaptar · archivos candidatos · riesgos · dependencias (Clínica/Fase 2) · tipo de trabajo (SQL/UI/tipos/docs) · criterio de "hecho".

**Leyenda de tipo de trabajo:** 🟦 SQL · 🟩 tipos (`@alsari/types`) · 🟨 UI · 📄 solo docs.
**Leyenda de disponibilidad:** 🟢 desbloqueable ya · 🟠 gated (espera a Clínica o a otra fase).

### Secuencia recomendada (resumen)

| Orden | Fase / lote | Disponibilidad | Por qué este orden |
|---|---|---|---|
| 1 | **F-Op A1** Efectivo vs banco + arqueo | 🟢 | Verdad de caja; nada lo bloquea. Hueco prioridad nº1 |
| 2 | **F-Op A2** CxP / CxC con seguimiento | 🟢 | Control de pendientes; agrega lo existente. Hueco nº2 |
| 3 | **F-Op A3** Recurrencia + vencimientos | 🟢 | Previsión de caja; mejora lo que ya hay |
| 4 | **F-Op C1** Reglas de imputación + costes compartidos | 🟢 (diseño) / 🟠 (sesión) | Base de costes; parte independiente de Clínica |
| 5 | **F-Op C2** Coste de personas (asalariados/autónomos) | 🟠 | "Por sesión" necesita datos de Clínica |
| 6 | **F-Op B** Rentabilidad Clínica | 🟠 | Necesita el schema `clinica` (otra línea) |
| 7 | **F-Op D** Ingreso real vs presupuestado | 🟠 | Necesita ingreso real fluyendo (B / facturación emitida) |

> Las fases 🟢 pueden arrancar tras Fase 2 (adaptación de `financiero`) sin esperar a la Clínica. Las 🟠 se diseñan ahora pero se implementan cuando exista el dato.

---

## F-Op A — Tesorería operativa  🟢

Cubre: efectivo vs banco · arqueo de caja · pagos pendientes · cobros pendientes · vencimientos · gastos recurrentes · cobros recurrentes · estados pagado/cobrado/reclamado/parcial/vencido.

Se parte en tres lotes: **A1** (efectivo/banco+arqueo), **A2** (CxP/CxC+estados), **A3** (recurrencia+vencimientos).

### F-Op A1 — Efectivo vs banco + arqueo de caja  🟢  · 🟦🟩🟨

1. **Objetivo:** separar el saldo de **efectivo (caja física)** del saldo de **banco**, y cuadrar la caja con un **arqueo diario**.
2. **Problema que resuelve:** hoy el PGC mezcla cuentas `570` (caja) y `572` (banco) en un único "caja disponible"; la clínica cobra en efectivo/datáfono/bizum y no hay forma de saber el efectivo real ni de detectar descuadres.
3. **Reutiliza:** `factura_pagos.metodo_pago` (ya incluye `efectivo`); motor PGC y dashboard de `financiero`; patrón append-only de `factura_pagos`.
4. **Crear/adaptar:** dimensión `medio ∈ {efectivo, banco}` (+subtipo datáfono/bizum/transferencia/domiciliación/tarjeta) en cobros/pagos; separar `570`/`572` en el mapeo del PGC; entidad de **arqueo/cierre de caja** (saldo teórico vs contado + descuadre).
5. **Archivos candidatos:** [pgcEngine.ts](apps/modules/financiero/src/lib/pgcEngine.ts) (separar 570/572), `apps/modules/financiero/src/components/views/` (dos saldos en el dashboard), `apps/modules/contabilidad/` (registro de cobros/pagos con `medio`), nueva migración para `medio` + tabla de arqueo, `@alsari/types` (enum `MedioPago`).
6. **Riesgos:** el motor PGC se conserva (no romperlo al separar 570/572); drift BD↔repo (las cuentas reales en producción pueden no coincidir); efectivo mal cuadrado = riesgo de cumplimiento.
7. **Dependencias Clínica/Fase 2:** **Fase 2** debería ir antes (toca el mismo dashboard de `financiero`); **independiente de Clínica** (el `medio` sirve para cualquier cobro/pago). El detalle por método de cobro de cita llegará con Clínica, pero el saldo efectivo/banco no la necesita.
8. **Tipo:** 🟦 SQL (medio + arqueo) · 🟩 tipos · 🟨 UI (dos saldos + pantalla de arqueo).
9. **Hecho cuando:** el dashboard muestra Efectivo y Banco por separado (y total); cada cobro/pago lleva `medio`; existe un cierre de caja diario con descuadre registrado y auditable.

### F-Op A2 — Cuentas por pagar / por cobrar + estados de seguimiento  🟢  · 🟦🟩🟨

1. **Objetivo:** una vista operativa unificada de **pendientes de pagar (CxP)** y **pendientes de cobrar (CxC)** con seguimiento de gestión.
2. **Problema que resuelve:** lo pendiente vive disperso (facturas `pendiente_pago`, vencimientos, `presupuesto_pagos`, futuras emitidas) y sin estado de gestión (responsable, reclamación, incobrable).
3. **Reutiliza:** vista `compromisos_tesoreria` (ya consolida pendientes), `vencimientos` (`es_entrada`), `facturas_recibidas`, `factura_pagos`, `VencimientosView`.
4. **Crear/adaptar:** estados de seguimiento — **CxC:** `pendiente→reclamado→parcial→cobrado` + `incobrable`; **CxP:** `pendiente→programado→parcial→pagado` + `disputado`; campos **importe, responsable, fecha de reclamación**; añadir `vencido` como derivado de fecha. Estos estados van **por encima** del estado contable, no lo sustituyen.
5. **Archivos candidatos:** vista SQL que extiende `compromisos_tesoreria`; `apps/modules/financiero/src/components/views/VencimientosView.tsx` (o vista nueva CxP/CxC); `@alsari/types` (`EstadoCobro`, `EstadoPago`).
6. **Riesgos:** deuda conocida de estados desalineados (`presupuesto_pagos.estado` no incluye `estimado/confirmado/facturado` que la vista asume) — **saldar antes**; no duplicar el estado contable.
7. **Dependencias Clínica/Fase 2:** independiente de Clínica; coordina con Fase 2 si toca el módulo `financiero`.
8. **Tipo:** 🟦 SQL (vista + estados) · 🟩 tipos · 🟨 UI (tablero CxP/CxC).
9. **Hecho cuando:** existe una pantalla que lista todo lo pendiente de cobrar y de pagar, con importe, responsable y estado de gestión, y permite marcar reclamado/parcial/cobrado/incobrable y pagado/parcial.

### F-Op A3 — Recurrencia (gastos y cobros) + vencimientos  🟢  · 🟦🟨

1. **Objetivo:** gestionar **gastos y cobros recurrentes** (alquileres, cuotas, partners) y su previsión de caja.
2. **Problema que resuelve:** la recurrencia actual es **acotada** (genera los pagos del rango `fecha_inicio→fecha_fin` repartiendo el importe **total** entre periodos) y no hay recurrencia indefinida ni concepto de cuota/partner.
3. **Reutiliza:** `presupuesto_partidas.recurrencia` + `fecha_inicio/fin`; generador [presupuestosApi.ts](apps/modules/presupuestos/src/lib/presupuestosApi.ts) (`generarFechasRecurrentes`); `vencimientos.recurrencia`.
4. **Crear/adaptar:** decidir recurrencia **acotada vs indefinida** (⚠️ DUDA F-5 del doc 04); semántica de "importe por periodo" (hoy reparte el total, lo intuitivo es importe fijo mensual); concepto de cobro recurrente/partner para la previsión.
5. **Archivos candidatos:** `apps/modules/presupuestos/src/lib/presupuestosApi.ts`, vistas de cashflow/vencimientos en `financiero`, posible migración menor si cambia la semántica de recurrencia.
6. **Riesgos:** cambiar la semántica de reparto afecta a presupuestos existentes; recurrencia indefinida complica la previsión y el borrado.
7. **Dependencias Clínica/Fase 2:** independiente de Clínica; usa lo que ya hay en `presupuestos`.
8. **Tipo:** 🟦 SQL (si cambia semántica) · 🟨 UI (alta de recurrente + previsión).
9. **Hecho cuando:** se puede dar de alta un alquiler/cuota recurrente con importe por periodo correcto, aparece en la previsión de caja, y su estado pendiente/pagado se sigue desde CxP/CxC (A2).

---

## F-Op B — Rentabilidad Clínica  🟠 (gated por schema `clinica`)

Cubre: servicio · profesional · producto/tarifa · cliente sin exponer datos sensibles · coste directo por sesión · coste fijo imputado · bonos/programas devengados sesión a sesión · margen por servicio/profesional/proyecto.

1. **Objetivo:** leer la **rentabilidad por explotación** de la Clínica: qué margen deja cada servicio, profesional, producto/tarifa y proyecto, por **devengo** (fecha de prestación).
2. **Problema que resuelve:** hoy solo hay margen **por proyecto** (`metricas_proyecto_resumen.saldo_neto_real`); no hay eje analítico por servicio/profesional/cliente ni margen por sesión, ni devengo de bonos.
3. **Reutiliza:** vista `metricas_proyecto_resumen` (margen por proyecto), análisis de **explotación** parametrizado (`proyecto_analisis_financiero` tipo `explotacion`, `ExplotacionView.tsx`) como marco de lectura; `proyecto_id_ref` como eje de agregación.
4. **Crear/adaptar:** eje analítico (`categoria_analitica` = servicio/línea); imputación de coste directo por sesión (profesional + sala); **devengo de bonos/programas** (ingreso anticipado → reconocido sesión a sesión); vista de margen por servicio/profesional. **No usar** la lente de inversión (TIR/VAN/valor de salida).
5. **Archivos candidatos:** futuro schema `clinica` (otra línea — **no se toca aquí**); `apps/modules/presupuestos/src/lib/analisisFinanciero.ts` y vistas de métricas; nuevas vistas SQL de agregación por servicio/profesional; `@alsari/types`.
6. **Riesgos:** mezclar rentabilidad (gestión) con contabilidad fiscal; doble conteo bono caja vs devengo; **exposición de datos sensibles de paciente** (ver dependencia).
7. **Dependencias Clínica/Fase 2:** **fuerte con Clínica** — las dimensiones servicio/profesional/cliente/producto y las sesiones viven en el schema `clinica` (línea de reservas). **Cliente sin datos sensibles:** la capa global agrega por proyecto/servicio/profesional; el cliente entra solo como **id/seudónimo**, los datos personales se quedan en `clinica` con RLS y **no suben** a la contabilidad global (D-op-5 del doc 04).
8. **Tipo:** 🟦 SQL (vistas analíticas) · 🟩 tipos · 🟨 UI (panel de rentabilidad). **Bloqueado hasta que exista el dato de Clínica.**
9. **Hecho cuando:** se puede ver el margen por servicio, por profesional y por proyecto en un periodo, con bonos devengados sesión a sesión y costes directos imputados, sin exponer datos personales del paciente en la capa global.

---

## F-Op C — Personas y costes compartidos  🟢 (diseño) / 🟠 (parte "por sesión")

Cubre: asalariados · autónomos por sesión · recepción compartida · reglas de imputación · retenciones si aplica · pagos pendientes a profesionales.

Se parte en dos lotes: **C1** (reglas de imputación + costes compartidos, en buena parte independiente) y **C2** (coste de personas concreto, parte gated por Clínica).

### F-Op C1 — Reglas de imputación y costes compartidos  🟢 (diseño)  · 🟦🟩

1. **Objetivo:** modelar cómo un **coste compartido** se reparte (recepción compartida con otra empresa, suministros, software) mediante una **regla de imputación** (% fijo o driver).
2. **Problema que resuelve:** hoy no existe `tipo_coste` (directo/compartido/fijo/general) ni clave de reparto; un coste compartido no se puede partir entre proyectos/empresas.
3. **Reutiliza:** `proyecto_id_ref` como destino de imputación; `proveedores_reglas` como patrón de "regla por entidad".
4. **Crear/adaptar:** `tipo_coste`; `clave_reparto` (porcentaje o driver: nº sesiones, m², horas); para recepción compartida, decidir el flujo de liquidación (¿Antifrágil paga el total y refactura, o cada empresa su parte? → posible CxC contra la otra empresa). ⚠️ DUDA F-2 del doc 04.
5. **Archivos candidatos:** nueva migración de `tipo_coste`/reglas; `@alsari/types`; vista de costes por proyecto (presupuestos/financiero).
6. **Riesgos:** reparto artificial que distorsiona el margen (preferir contribución primero, D-op-7); driver mal elegido.
7. **Dependencias Clínica/Fase 2:** el **modelo de regla** es independiente; el driver "nº sesiones" necesitaría datos de Clínica, pero un **% fijo** no.
8. **Tipo:** 🟦 SQL · 🟩 tipos (📄 mientras no se decida F-2).
9. **Hecho cuando:** un coste compartido (p. ej. recepción al X%) se reparte automáticamente a Antifrágil y queda claro qué parte asume y, si aplica, qué se refactura a la otra empresa.

### F-Op C2 — Coste de personas: asalariados y autónomos por sesión  🟠 · 🟦🟩🟨

1. **Objetivo:** imputar el **coste de las personas por devengo** — asalariado (coste fijo mensual al mes del servicio), autónomo (coste por sesión completada, pago al mes siguiente).
2. **Problema que resuelve:** no hay modelo de coste de personal; no se distingue fecha de pago vs mes del coste; falta seguimiento de **pagos pendientes a profesionales** y de **retenciones IRPF** (cuenta `475`, resumen trimestral).
3. **Reutiliza:** `facturas_recibidas` (retención IRPF `retencion_pct`/`retencion_importe`), `factura_pagos` (pagos parciales + método), `contactos`/`proveedores_reglas`, RPC `registrar_pago_factura` como patrón.
4. **Crear/adaptar:** coste de **asalariado** (coste fijo mensual imputado, probablemente importado/manual desde la gestoría — ⚠️ DUDA F-3); coste de **autónomo por sesión** (devengo en el mes del servicio, CxP hasta pago); cuentas PGC de personal `640/465/475/476` (hoy ausentes); resumen de retenciones.
5. **Archivos candidatos:** `apps/modules/contabilidad/` (alta de costes de personas), migración de cuentas de personal + (posible) tabla de coste mensual de personal, `@alsari/types`.
6. **Riesgos:** confundir caja con devengo (el caso María Moreno); construir un "módulo de nóminas" sobredimensionado cuando puede bastar el coste imputado; "por sesión" depende de Clínica.
7. **Dependencias Clínica/Fase 2:** **asalariados** y el coste fijo se pueden modelar sin Clínica; **autónomos por sesión** necesitan el dato de sesiones completadas (schema `clinica`). Decisión F-3 condiciona el alcance.
8. **Tipo:** 🟦 SQL (cuentas/coste) · 🟩 tipos · 🟨 UI (alta + CxP a profesionales). Parte gated.
9. **Hecho cuando:** el coste de un asalariado aparece en el mes del servicio (no en el de pago); el coste de un autónomo se devenga en el mes de la sesión y queda como pendiente de pago hasta liquidarse; las retenciones quedan registradas para la gestoría.

---

## F-Op D — Ingreso real vs presupuestado  🟠 (gated por ingreso real fluyendo)

Cubre: comparar ingreso real con previsión · desviaciones · forecast mensual · alertas.

1. **Objetivo:** comparar el **ingreso real** (facturas emitidas/cobros) contra el **presupuesto de ingresos**, con desviaciones y forecast mensual.
2. **Problema que resuelve:** hay presupuesto de ingreso y flujo real por separado, pero **no** una comparativa línea-a-línea real vs presupuestado, ni forecast, ni alertas.
3. **Reutiliza:** `presupuestos` (categoría `ingreso`), `presupuesto_ingresos`, `presupuesto_pagos` (estado previsto/real), vista `flujos_proyecto_consolidados` (flags `es_real`/`es_previsto`), métricas de proyecto.
4. **Crear/adaptar:** vínculo ingreso real ↔ partida de ingreso presupuestada; vista de desviación (importe y %); forecast mensual; reglas de alerta (desviación > umbral).
5. **Archivos candidatos:** vista SQL de comparación presupuesto/real; `apps/modules/presupuestos/` (panel de desviaciones), métricas de proyecto.
6. **Riesgos:** datos de ingreso real incompletos hasta que la Clínica facture/cobre y la facturación emitida esté lista; alertas ruidosas si la previsión es pobre.
7. **Dependencias Clínica/Fase 2:** depende de que fluya **ingreso real** (F-Op B y/o línea de **facturación emitida**, doc `02`); el armazón presupuestario ya existe.
8. **Tipo:** 🟦 SQL (vista comparativa) · 🟨 UI (panel desviación/forecast). 🟩 tipos si hace falta.
9. **Hecho cuando:** se ve, por proyecto y mes, ingreso presupuestado vs real con su desviación, un forecast del mes en curso y alertas cuando la desviación supera el umbral.

---

## Resumen de dependencias y tipo de trabajo

| Fase / lote | Disponibilidad | SQL | Tipos | UI | Depende de |
|---|---|---|---|---|---|
| A1 Efectivo/banco + arqueo | 🟢 | ✔ | ✔ | ✔ | Fase 2 (mismo dashboard) |
| A2 CxP/CxC + estados | 🟢 | ✔ | ✔ | ✔ | saldar deuda de estados |
| A3 Recurrencia + vencimientos | 🟢 | (✔) | — | ✔ | decisión F-5 |
| C1 Reglas imputación | 🟢 diseño | ✔ | ✔ | — | decisión F-2 |
| C2 Coste personas | 🟠 | ✔ | ✔ | ✔ | Clínica (por sesión) · decisión F-3 |
| B Rentabilidad Clínica | 🟠 | ✔ | ✔ | ✔ | **schema `clinica`** |
| D Ingreso real vs ppto | 🟠 | ✔ | (✔) | ✔ | ingreso real (B / facturación emitida) |

**Decisiones de Guille que desbloquean fases:** F-2 (recepción compartida), F-3 (asalariados/nóminas), F-4 (generales: contribución vs prorrateo), F-5 (recurrencia acotada vs indefinida). Recogidas en [04](04-finanzas-operativas-mapa-y-gaps.md) §10.

---

*Backlog de diseño. No modifica código, SQL, tipos ni UI. Cada fase requiere su propio diseño validado antes de implementarse.*
