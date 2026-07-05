# Fase 1 (op) — Finanzas operativas de Antifrágil: mapa y huecos

> **Estado:** Diseño conceptual. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Sirve para decidir las fases de implementación.
> **Rama:** `docs/finanzas-modelo-operativo`
> **Fecha:** 2026-06-26
> **Depende de:** [00-auditoria...](00-auditoria-base-financiera-antifragil.md) · [01-modelo-conceptual...](01-modelo-conceptual-antifragil.md) · [03-plan-fase2...](03-plan-fase2-adaptacion-financiero.md)
> **Regla de partida:** los Excel históricos **no se importan ni se copian**; solo valen como referencia conceptual. El trabajo parte de lo que **ya existe en GitHub**. No duplicar contabilidad/tesorería/facturas: primero mapear, luego decidir.
> **Marcas `⚠️ DUDA`:** puntos que requieren confirmación de Guille (recapitulados en §10).

---

## 0. Resumen ejecutivo (para Guille)

Antifrágil necesita gestionar el dinero operativo del día a día: **qué entra y sale de caja, qué deja cada servicio, y qué papeles necesita la gestoría**. La base heredada ya cubre buena parte de lo primero (caja, gastos, pagos, presupuestos) pero **no** distingue todavía tres cosas que para una clínica son críticas:

1. **Efectivo vs banco** (hoy se mezclan en "caja disponible"; falta el arqueo de caja diario).
2. **Rentabilidad por servicio/profesional** (hoy solo hay margen por proyecto, no por lo que deja una sesión de fisio de un profesional concreto).
3. **El coste de las personas** según _cuándo se devenga_ — no según cuándo se paga (una asalariada, un autónomo que cobra al mes siguiente, una recepción que pagamos a medias con otra empresa).

Este documento **separa tres lentes** que miran el mismo dinero de forma distinta y que **no deben mezclarse**: **Tesorería/cashflow** (caja), **Rentabilidad analítica** (margen) y **Precontabilidad/facturación** (papeles y fechas fiscales). Para cada lente dice qué hay, qué falta y qué casos reales debe resolver (María Moreno asalariada, autónomos por sesión, recepción compartida, alquileres, cobros pendientes, cobros recurrentes). Y ordena los huecos por prioridad para decidir las siguientes fases.

**No abre implementación.** Es el contrato de diseño que las fases siguientes ejecutarán cuando Guille lo valide.

---

## 1. Propósito y alcance

**Propósito:** definir _cómo debe funcionar_ Antifrágil OS a nivel financiero **operativo**, sobre la base que ya existe, de forma que se puedan decidir y priorizar las fases de implementación.

**Dentro de alcance:** tesorería operativa (banco/efectivo/caja, pagos/cobros reales y pendientes, vencimientos, conciliación, arqueo), rentabilidad analítica operativa (margen por servicio/profesional/producto/proyecto, costes directos/compartidos/fijos, devengo de bonos), y precontabilidad (facturas recibidas, pagos, documentos para la gestoría, trazabilidad).

**Fuera de alcance de este documento (líneas propias, no se tocan aquí):** clínica/reservas, facturación **emitida** (doc `02` — **PR #1**, rama `docs/finanzas-facturacion-emitida-design`), el rebrand `@alsari/*`, y la lente de **inversión inmobiliaria** (TIR/VAN/cap-rate/valor de salida), que no aplica a un negocio operativo.

**Principio rector:** la **cita/sesión** es la verdad operativa que en el futuro alimentará las tres lentes (ver [01](01-modelo-conceptual-antifragil.md) §3). Mientras la clínica no esté conectada, este modelo se diseña **multi-proyecto y genérico**, listo para recibir esos datos sin reescribirse.

---

## 2. Las tres lentes (separación obligatoria)

El mismo hecho económico se lee de tres formas. **No se suman entre sí.**

| Lente                                | Pregunta que responde                                     | Fecha que manda                   | Unidad                                |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------- | ------------------------------------- |
| **1. Tesorería / cashflow**          | ¿Cuánto dinero entra/sale y cuándo? ¿Qué queda pendiente? | Fecha de **cobro / pago**         | Movimiento de caja (banco o efectivo) |
| **2. Rentabilidad analítica**        | ¿Qué deja cada servicio/profesional/proyecto?             | Fecha de **prestación** (devengo) | Margen                                |
| **3. Precontabilidad / facturación** | ¿Qué documento lo respalda? ¿Qué necesita la gestoría?    | Fecha de **factura / documento**  | Documento fiscal                      |

**Invariante anti-doble-conteo (regla de Guille):** un ingreso entra **una vez** en caja, se reconoce **progresivamente** en rentabilidad y se documenta **una vez** en factura. Tres lecturas del mismo hecho, no tres ingresos.

**Ejemplo canónico — bono de fisio de 225 € (5 sesiones):**

| Lente           | Cómo lo ve                                                             | Cuándo                       |
| --------------- | ---------------------------------------------------------------------- | ---------------------------- |
| Tesorería       | +225 € de caja (efectivo o banco), **una sola vez**                    | día de cobro                 |
| Rentabilidad    | ~45 €/sesión − coste del profesional/sala, a medida que se consumen    | a lo largo de las 5 sesiones |
| Precontabilidad | 1 factura de 225 € (si procede), con su IVA/exención y estado de cobro | día de emisión               |

---

## 3. Lente 1 — Tesorería / cashflow

**Qué responde:** la caja real y prevista, lo pendiente de cobrar y pagar, y el cuadre del efectivo.

### 3.1 Qué existe ya (reutilizable)

| Pieza                                                                                                           | Dónde                                                                             | Estado                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| Cashflow por capas (real / comprometido / previsto) y por fuente (factura / presupuesto / vencimiento / manual) | vistas `cashflow_consolidado`, `flujos_proyecto_consolidados`; `CashflowView.tsx` | ✅ sirve                      |
| Vencimientos (entradas/salidas, recurrencia informativa, estado pendiente/gestionado)                           | `vencimientos` (+ `es_entrada`, `recurrencia`); `VencimientosView.tsx`            | ✅ sirve                      |
| Pagos reales de facturas (libro append-only, pagos parciales, sobre/infrapago, método de pago)                  | `factura_pagos` (`metodo_pago` incluye `efectivo`); RPC `registrar_pago_factura`  | ✅ sirve                      |
| Pendientes consolidados (CxP/CxC embrionario)                                                                   | vista `compromisos_tesoreria`                                                     | 🟡 parcial                    |
| Importación de extractos bancarios (atómica, dedup por hash)                                                    | `extractos_bancarios`, `movimientos_bancarios`; RPC `importar_extracto_bancario`  | ✅ sirve                      |
| Conciliación banco ↔ contabilidad                                                                               | `reconciliacion_log` (+ FKs `movimiento_id` en factura)                           | 🟡 log manual, sin auto-match |

### 3.2 Cómo debe funcionar (diseño)

- **Medio de cobro/pago = dimensión obligatoria.** Cada movimiento de caja lleva `medio ∈ {efectivo, banco}` con subtipo opcional (`datáfono`, `bizum`, `transferencia`, `domiciliación`, `tarjeta`, `metálico`). Hoy el dato existe parcialmente en `factura_pagos.metodo_pago`, pero **ni los `movimientos_bancarios` ni el motor PGC distinguen efectivo de banco** (mezclan cuentas `570` caja + `572` banco en un único "caja disponible").
- **Dos saldos, no uno.** El dashboard debe mostrar **Efectivo (caja física)** y **Banco** por separado (y total). Son dos "cajas" distintas con dinámicas distintas.
- **Arqueo de caja diario.** El efectivo requiere **cierre de caja**: saldo teórico (cobros efectivo − pagos efectivo del día) vs saldo contado, con descuadre registrado. Hoy **no existe**. Es el hueco nº1 (§9).
- **Cuentas por pagar / por cobrar como vista operativa unificada.** Hoy lo pendiente vive disperso (facturas recibidas `pendiente_pago`, vencimientos `pendiente`, `presupuesto_pagos` previstos, y —futuro— facturas emitidas por cobrar). La lente operativa los unifica en **CxP** y **CxC** con seguimiento propio (§3.3), sin crear una contabilidad paralela: agrega lo que ya existe.
- **Conciliación.** Importación de extracto → emparejar cada movimiento con su factura/pago. Hoy el emparejado es **manual** (FK opcional `factura_recibida_id` / `movimiento_id`) y `reconciliacion_log` solo guarda el resultado de comparar asientos. Diseño objetivo: sugerencia de match por importe+fecha+contraparte, confirmación humana, y vínculo explícito pago↔movimiento (hoy `factura_pagos` no apunta al `movimiento_bancario`).

### 3.3 Estados de seguimiento operativo (CxC / CxP)

Más finos que el `pendiente/pagado` contable. **Decisión conceptual** de este documento:

- **Cobros (CxC):** `pendiente → reclamado → parcial → cobrado` · ramal `incobrable`. Cada cobro pendiente lleva **importe, responsable y estado** (caso real §6.5).
- **Pagos (CxP):** `pendiente → programado → parcial → pagado` · ramal `disputado`. Vinculado a vencimiento/factura y a su `medio`.

> Esto no sustituye al estado contable de la factura; es la **capa de gestión del cobro/pago** encima.

---

## 4. Lente 2 — Rentabilidad analítica

**Qué responde:** qué margen deja cada servicio, profesional, producto/tarifa y proyecto. **Fecha que manda: la de prestación (devengo)**, nunca la de cobro/pago.

### 4.1 Qué existe ya

| Pieza                                                                                  | Dónde                                                                                               | Estado                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Margen **por proyecto** (ingreso real − gasto real)                                    | vista `metricas_proyecto_resumen` (`saldo_neto_real`)                                               | ✅ a nivel proyecto                          |
| Desviación presupuesto vs real (si hay presupuesto maestro)                            | `proyecto_escenarios` / métricas fase 1                                                             | 🟡 parcial                                   |
| Análisis de **explotación** parametrizado (EBITDA, costes variables/fijos, break-even) | `proyecto_analisis_financiero` (tipo `explotacion`); `analisisFinanciero.ts`, `ExplotacionView.tsx` | 🟡 **parámetros manuales, no flujos reales** |
| Análisis de **inversión** (TIR/VAN/cap-rate/valor de salida)                           | `proyecto_analisis_financiero` (tipos `compra_venta`/`renta`/`alternativo`)                         | ⛔ **no usar** sobre proyectos operativos    |

### 4.2 Qué falta (el corazón del hueco analítico)

- **Eje analítico por debajo del proyecto.** Hoy no hay forma de imputar un ingreso/coste a **servicio, profesional, producto/tarifa o cliente**. `presupuesto_partidas`/`presupuesto_pagos` no tienen ese eje; la única "categoría" analítica existente es la de _tareas_ (general/obra/legal/financiero), inservible aquí.
- **Distinción coste directo / compartido / fijo / general.** No existe `tipo_coste` ni centro de coste ni clave de reparto. El margen por proyecto se calcula como ingreso−gasto **sin** desagregar.
- **Margen por sesión.** Requiere imputar a cada sesión su ingreso devengado y su coste directo (profesional + sala/recurso). Depende del eje analítico y de los datos de la clínica (futuro schema `clinica`).
- **Devengo de bonos/programas.** Un bono cobrado es **ingreso anticipado** (pasivo por servicios no prestados). En rentabilidad se reconoce **sesión a sesión**; en caja entró entero. Hoy no hay modelo de devengo.

### 4.3 Cómo debe funcionar (diseño)

- **El ingreso analítico se devenga en la fecha de prestación**, repartiendo bonos/programas entre sus sesiones; los costes directos se imputan a la **misma** sesión/servicio.
- **Costes en tres capas:** **directos** (profesional, sala, material, comisión datáfono) → imputables a servicio/sesión; **compartidos** (recepción, software, suministros) → repartidos por una **clave de imputación** (% o driver); **fijos/generales** (alquiler de estructura, administración) → a proyecto o a global.
- **Margen de contribución primero** (decisión 4 de [01](01-modelo-conceptual-antifragil.md), recomendada): ingreso − costes directos por servicio/proyecto; los generales se restan al **resultado global**, sin forzar un reparto artificial al principio. ⚠️ DUDA F-4 (§10).
- **Las dimensiones finas viven en `clinica` (futuro) y agregan hacia arriba por `proyecto_id_ref`.** La contabilidad global no necesita conocer al paciente; recibe el agregado por proyecto. Así reservas no se convierte en un monstruo financiero y la clínica conserva su lectura fina.
- **Esta capa es de gestión, no una segunda contabilidad oficial.** No alimenta el fisco; alimenta decisiones.

---

## 5. Lente 3 — Precontabilidad / facturación (recibidas)

**Qué responde:** qué documento respalda cada movimiento y qué necesita la gestoría. **El sistema no sustituye a la gestoría: le prepara un paquete trazable.**

### 5.1 Qué existe ya (lo más maduro del repo)

| Pieza                                                                                               | Dónde                                                              | Estado                                  |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Factura recibida completa (base, IVA, IRPF, `cuenta_gasto`, proyecto/sociedad, OCR, estados, Drive) | `facturas_recibidas`; módulo `contabilidad`                        | ✅ ~90%                                 |
| Workflow de aprobación auditado (append-only)                                                       | `factura_aprobaciones`; RPC `avanzar_estado_factura_con_auditoria` | ✅ patrón a copiar                      |
| Pagos asociados (parciales, método, justificante, trazabilidad operador)                            | `factura_pagos`; RPC `registrar_pago_factura`                      | ✅ sirve                                |
| Proveedores/contactos + reglas de auto-sugerencia (cuenta, IVA, IRPF, proyecto)                     | `contactos`, `proveedores_reglas`                                  | ✅ v1 (sugerencias)                     |
| Asientos borrador + plan de cuentas + reglas de categorización                                      | `asientos_borrador`, `plan_cuentas`, `reglas_categorizacion`       | 🟡 falta semilla de cuentas de personal |

### 5.2 Cómo debe funcionar (diseño)

- **"Factura sí / factura no".** No todo gasto o cobro tiene factura: un ticket sin factura completa, una nómina, un cobro en efectivo sin factura, un pago a un autónomo pendiente de su factura. El modelo debe marcar **si hay documento o no**, qué falta, y permitir el flujo aunque el papel llegue después. Esto conecta tesorería (el dinero se movió) con precontabilidad (el papel puede no estar).
- **Documentos pendientes.** Lista operativa de "movimientos sin justificante" y "facturas esperadas" (p. ej. el autónomo que aún no ha mandado su factura del mes). Hoy implícito; debe hacerse explícito.
- **Paquete para gestoría.** Salida periódica trazable: facturas recibidas + clasificación (cuenta/IVA/IRPF/exención) + pagos + extractos conciliados. **Decisión ya firme (F4-D, 2026-06-26 — doc `02` / PR #1):** la emisión fiscal oficial y el cierre **se delegan** en la gestoría / software homologado (Veri\*factu fuera del OS por ahora); el OS es el **libro operativo / precontable** que la alimenta y **no emite factura legal oficial todavía**.
- **Trazabilidad.** Todo cambio relevante (aprobación, pago, conciliación) queda en log append-only con actor y fecha — el patrón `factura_aprobaciones` ya lo hace y se reutiliza.

### 5.3 Hueco específico de personal (entra por aquí y por la lente 2)

- **Nóminas:** no hay modelo de empleado/salario ni cuentas PGC `640/465/476`. Hoy una persona se trataría como proveedor. ⚠️ DUDA F-3.
- **Autónomos/colaboradores:** la retención IRPF en factura **sí** existe; falta el modelo de "colaborador que cobra por sesión", la cuenta `475` de IRPF por pagar y el resumen trimestral de retenciones.

---

## 6. Casos reales que el modelo debe resolver

Cada caso se lee en las tres lentes. La clave recurrente: **caja ≠ rentabilidad ≠ documento**.

### 6.1 María Moreno — asalariada (coste fijo mensual, imputado a Clínica)

- **Rentabilidad:** coste **fijo mensual** imputado al **mes del servicio** (devengo), repartido como coste de estructura del proyecto Clínica (o directo si solo atiende clínica). No depende de cuándo se pague la nómina.
- **Tesorería:** la salida de caja ocurre el día del pago de nómina (banco), que puede caer en otro mes → **no confundir** la fecha de pago con el coste del mes.
- **Precontabilidad:** nómina (no factura). Cuentas de personal `640/465/476` (hoy ausentes). Probable origen del dato: importado/manual desde la gestoría, no un módulo de RR.HH. completo. ⚠️ DUDA F-3.

### 6.2 Autónomos por sesión (coste por sesión completada, pago al mes siguiente)

- **Rentabilidad:** el coste se genera **al completar la sesión** y se imputa al **mes del servicio**, como coste directo del servicio/profesional.
- **Tesorería:** el pago suele ser **al mes siguiente** → aparece como **CxP pendiente** hasta que se paga; la salida de caja cae en el mes posterior.
- **Precontabilidad:** factura del autónomo (con su IRPF). Puede llegar **después** de la sesión → "factura no (todavía)" + documento pendiente. La retención alimenta el `475` (futuro).

### 6.3 Recepción asalariada **compartida** con otra empresa

- **Coste compartido:** Antifrágil asume **solo una parte**; otra empresa asume el resto. Debe existir una **regla de imputación / porcentaje** (clave de reparto). ⚠️ DUDA F-2 (¿% fijo o driver variable?; ¿quién es la otra empresa y cómo se liquida?).
- **Rentabilidad:** solo la parte de Antifrágil entra como coste compartido del proyecto.
- **Tesorería:** según cómo se pague (¿Antifrágil paga el total y refactura a la otra empresa? ¿cada una paga su parte?) cambia el movimiento de caja y puede generar una **CxC** contra la otra empresa.

### 6.4 Alquileres (gasto recurrente, vencimiento, imputado a proyecto)

- **Tesorería:** gasto **recurrente** con **vencimiento** mensual y estado **pendiente/pagado**, por banco normalmente.
- **Rentabilidad:** coste **fijo** imputado al proyecto (o repartido si la sede es compartida).
- **Hoy:** modelable como vencimiento recurrente o partida recurrente, **pero** la recurrencia es **acotada** (se generan los pagos del rango `fecha_inicio→fecha_fin` repartiendo el importe total entre periodos: para 1.500 €/mes hay que meter `importe = 1.500 × nº meses` con fecha fin). No hay recurrencia **indefinida** ni generación continua. ⚠️ DUDA F-5.

### 6.5 Cobros pendientes (importes a reclamar, con responsable y estado)

- **Tesorería / CxC:** cada cobro pendiente lleva **importe, responsable y estado** del ciclo `pendiente → reclamado → parcial → cobrado → incobrable` (§3.3). Hoy lo pendiente existe pero **sin** ese seguimiento operativo (responsable, reclamación, incobrable).

### 6.6 Cobros recurrentes (cuotas, partners, servicios recurrentes, previsión)

- **Tesorería:** cuotas/partners como **cobros recurrentes** que alimentan la **previsión** de caja.
- **Hoy:** mismo motor de recurrencia acotada que los gastos (§6.4); aplica a `tipo_flujo='ingreso'`. Falta recurrencia abierta y el concepto de "partner/cuota" como tal. ⚠️ DUDA F-5 / F-6.

---

## 7. La pieza transversal: etiquetado e imputación

Lo que hace que las tres lentes cuadren sin contabilidades paralelas es **etiquetar cada hecho** y definir **cómo se imputa**:

- **Dimensiones existentes:** `sociedad_id_ref` ✅, `proyecto_id_ref` ✅, cuenta PGC ✅.
- **Dimensiones a añadir (diseño, futuras):** `medio` (efectivo/banco) · `categoria_analitica` (servicio/línea) · `tipo_coste` (directo/compartido/fijo/general) · `clave_reparto` (para compartidos) · y las finas de clínica (servicio/profesional/cliente/producto) que **agregan por proyecto**.
- **Regla de imputación** = cómo un coste compartido se reparte (porcentaje fijo o driver: nº sesiones, m², horas). Es lo que resuelve la recepción compartida (§6.3) y el reparto de generales (§4.3).

> Nada de esto se implementa aquí. Se enumera para que las fases siguientes sepan **qué columnas/conceptos** harán falta y dónde enganchan con lo existente.

---

## 8. Qué se reutiliza / adapta / crea (resumen)

| Bloque          | Reutilizar ✅                                                            | Adaptar 🔧                                                  | Crear ❌                                                                                                              |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tesorería       | cashflow consolidado, vencimientos, factura_pagos, importación extractos | separar 570/572 en PGC; vínculo pago↔movimiento             | `medio` efectivo/banco, arqueo de caja, CxP/CxC con seguimiento, auto-match conciliación                              |
| Rentabilidad    | margen por proyecto                                                      | usar explotación (no inversión)                             | eje analítico (servicio/profesional/producto), `tipo_coste`, reparto compartidos, devengo de bonos, margen por sesión |
| Precontabilidad | facturas recibidas, aprobación auditada, pagos, proveedores/reglas       | semilla de cuentas de personal; roles/categorías Antifrágil | "factura sí/no" + documentos pendientes, paquete gestoría explícito, modelo colaborador/nómina                        |

---

## 9. Huecos priorizados (orden de Guille)

1. **Efectivo vs banco + arqueo de caja.** Sin esto, la caja real de la clínica no es fiable. Toca PGC (separar `570`/`572`), `medio` en cobros/pagos, y cierre de caja diario.
2. **Cuentas por pagar/cobrar y seguimiento operativo.** Estados `pendiente/reclamado/parcial/cobrado/incobrable` (cobros) y `pendiente/programado/parcial/pagado` (pagos), con importe y responsable. Agrega lo que ya existe.
3. **Colaboradores, asalariados y costes compartidos.** Modelo de coste de personas por **devengo** (no por pago): asalariado mensual, autónomo por sesión, recepción compartida con clave de reparto.
4. **Rentabilidad analítica por servicio/profesional.** Eje analítico + costes directos imputados; margen por sesión cuando llegue el dato de clínica.
5. **Ingreso real vs presupuestado.** Comparativa línea-a-línea (factura/cobro real contra partida de ingreso presupuestada).

> Orden razonado: primero la **verdad de caja** (1-2), luego el **coste real** de operar (3), luego la **lectura de margen** (4) y por último el **control presupuestario** (5). Cada nivel se apoya en el anterior.

---

## 10. Decisiones conceptuales tomadas · dudas abiertas

### Decisiones tomadas en este documento (sujetas a validación)

- **D-op-1.** Tres lentes separadas (tesorería/rentabilidad/precontabilidad) con invariante anti-doble-conteo. La fecha que manda es distinta en cada una.
- **D-op-2.** Rentabilidad se mide por **devengo** (fecha de prestación); el coste de personas se imputa al **mes del servicio**, no al mes de pago.
- **D-op-3.** La tesorería separa **efectivo y banco** como **cuentas de tesorería distintas** y exige **arqueo de caja** para el efectivo. _Precisión posterior (PR #4, ver [06 §9](06-fop-a1-efectivo-banco-arqueo.md)): `banco` **no** es un valor de `medio_pago` — el medio (efectivo/tarjeta/transferencia/bizum/domiciliación) describe cómo se mueve el dinero; caja/banco son tipos de cuenta donde vive._
- **D-op-4.** Estados de seguimiento operativo CxC/CxP por encima del estado contable (§3.3).
- **D-op-5.** Las dimensiones finas (servicio/profesional/cliente/producto) viven en `clinica` y **agregan por `proyecto_id_ref`**; la capa global recibe agregados, no pacientes.
- **D-op-6.** El OS es el **libro operativo / precontabilidad**; el cierre fiscal y la emisión oficial **se delegan en la gestoría / software homologado** (✅ ya decidido — F4-D, 2026-06-26, doc `02` / PR #1: el OS no emite factura legal oficial todavía; Veri\*factu fuera del OS).
- **D-op-7.** **Margen de contribución primero** (costes directos por proyecto; generales al resultado global) como punto de partida.

### Dudas abiertas para Guille

- **⚠️ F-1 — Efectivo real:** ¿qué volumen de efectivo maneja la clínica y qué nivel de arqueo necesitamos (diario estricto vs cuadre semanal)?
- **⚠️ F-2 — Recepción compartida:** ¿% fijo o driver variable? ¿quién es la otra empresa y cómo se liquida (Antifrágil paga el total y refactura, o cada una su parte)?
- **⚠️ F-3 — Asalariados:** ¿se modela el coste de personal en el OS (coste mensual importado/manual desde la gestoría) o se trae solo el agregado? ¿Hace falta algún día un módulo de nóminas, o basta el coste imputado?
- **⚠️ F-4 — Costes generales:** ¿contribución (recomendado) o prorrateo proporcional a proyectos desde el principio?
- **⚠️ F-5 — Recurrencia:** ¿nos vale el modelo **acotado** actual (rango con fecha fin) o necesitamos recurrencia **indefinida** para alquileres/cuotas?
- **⚠️ F-6 — Cobros recurrentes/partners:** ¿hay clientes B2B con cuota (partners) y cómo se define la previsión?
- **⚠️ F-7 — Bonos:** criterio de devengo (lineal por sesión vs por tarifa de cada sesión) y caducidad.
- **⚠️ Riesgo transversal — Drift BD↔repo:** antes de cualquier fase con datos hay que **auditar la paridad del schema real** (migraciones aplicadas a mano por Dashboard).

---

## 11. Qué desbloquea (no abre implementación)

Con este mapa, las fases operativas pueden priorizarse sobre el roadmap de [00](00-auditoria-base-financiera-antifragil.md) §9 / [03](03-plan-fase2-adaptacion-financiero.md):

- **F-Op A — Tesorería real:** efectivo vs banco, arqueo, CxP/CxC (huecos 1-2).
- **F-Op B — Coste de personas:** asalariados/autónomos/compartidos por devengo (hueco 3).
- **F-Op C — Analítica operativa:** eje servicio/profesional + costes directos + margen (huecos 4-5).

Cada fase con código requiere su propio diseño validado y se coordina con las líneas de `financiero` (Fase 2), facturación emitida y clínica para no colisionar. **Ninguna se abre sin OK de Guille.**

---

_Documento de diseño. No modifica código productivo, SQL, tipos ni UI. Sujeto a validación de Guille antes de abrir cualquier fase de implementación._
