# FOP-A2 — Cuentas por cobrar, cuentas por pagar y seguimiento operativo

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Prepara la futura implementación del lote F-Op A2 del backlog.
> **Rama:** `docs/finanzas-fop-a2-cxc-cxp`
> **Fecha:** 2026-07-05
> **Depende de:** `05-backlog-finanzas-operativas.md` (F-Op A2, PR #11) y `04` §3.3 (estados de seguimiento, D-op-4). Conecta con `02` (facturación, PR #1), `06`/PR #4 (tesorería, NO APPLY), `08` (liquidaciones, PR #13), `09` (rentabilidad, PR #15) y `10` (bonos, PR #19).
> **Regla:** reutilizar antes de crear — A2 **agrega lo que ya existe** (`compromisos_tesoreria`, `vencimientos`, `facturas_recibidas`, `factura_pagos`), no crea una contabilidad paralela. Capa operativa/precontable (D-op-6). Cliente como id/seudónimo (D-op-5); cero datos clínicos.

---

## 0. Encaje en la serie

Implementa **F-Op A2** del backlog (mismo nombre en producto y backlog, sin colisión de letras). Es el hueco prioritario nº2 del doc 04 §9: "control de pendientes". Los estados que propone son los ya decididos conceptualmente en D-op-4 (doc 04 §3.3), aquí desarrollados con seguimiento, fuentes, vistas y roles. Deuda previa conocida que hay que saldar antes de implementar: estados desalineados de `presupuesto_pagos` (05, riesgo del lote A2).

## 1. Problema

- El dinero **pendiente de cobrar** vive disperso: sesiones realizadas sin cobrar, bonos vendidos sin cobrar, facturas operativas emitidas, partners (Vivofácil/Oasis/Lidomare) sin liquidar, pagos parciales.
- El dinero **pendiente de pagar** también: liquidaciones de profesionales validadas, facturas recibidas, nóminas, devoluciones comprometidas, proveedores recurrentes, la parte compartida con Lidomare.
- No hay vista única con **responsable, estado y fecha de seguimiento**: lo pendiente existe pero nadie es dueño de reclamarlo o programarlo.
- **Caja real ≠ pendiente** (lo que hay no dice lo que falta) y **rentabilidad ≠ cobro** (un mes con buen margen devengado puede estar ahogado de CxC). A2 es la bisagra entre ambas verdades.

## 2. Objetivo

Una vista operativa unificada de **CxC** (cuentas por cobrar) y **CxP** (cuentas por pagar) con: importe pendiente, origen, responsable, estado de gestión (vencidos, parciales, reclamados, disputados, incobrables, programados) y cierre por movimiento de tesorería (conciliado). No sustituye al estado contable de cada documento: es la **capa de gestión encima** (D-op-4).

## 3. Entidades conceptuales

> Conceptual, no esquema final. Todo apunte de gestión es **append-only**; los importes pendientes son **derivados** (origen − cobros/pagos aplicados), nunca editados a mano.

| Entidad                                  | Qué es                                                                                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compromiso_financiero`                  | Abstracción común: algo que **se nos debe** (CxC) o que **debemos** (CxP), con importe, contraparte, origen, vencimiento y estado. Extiende la vista `compromisos_tesoreria` existente                    |
| `cuenta_por_cobrar` / `cuenta_por_pagar` | Especializaciones del compromiso, con su ciclo de estados propio (§6/§7)                                                                                                                                  |
| `vencimiento`                            | Fecha comprometida de cobro/pago. Reutiliza la entidad `vencimientos` existente (`es_entrada`); `vencido` es **derivado** de fecha, no un flag manual                                                     |
| `seguimiento`                            | El hilo de gestión del compromiso: responsable, próxima acción, fecha límite, último contacto, notas (§8)                                                                                                 |
| `reclamacion`                            | Evento de seguimiento tipado (aviso, llamada, email): fecha, actor, resultado. Mueve el estado a `reclamado`                                                                                              |
| `incidencia`                             | Discrepancia que bloquea (importe no cuadra, disputa, evidencia ausente); con motivo y vuelta al estado previo — mismo patrón que 08 §5                                                                   |
| `cobro_parcial` / `pago_parcial`         | Aplicación parcial de dinero a un compromiso. Reutiliza el patrón `factura_pagos` (libro append-only, sobre/infrapago con tolerancia)                                                                     |
| `responsable`                            | Persona dueña del compromiso (rol operativo, no dato sensible)                                                                                                                                            |
| `evidencia_documental`                   | Lo que respalda: factura, liquidación, acuerdo de partner, justificante de devolución. "Factura sí/no" del doc 04 §5.2: el pendiente existe aunque el papel falte, pero el hueco documental queda visible |
| `movimiento_tesoreria` relacionado       | El cobro/pago real (FOP-A1) que reduce o cierra el compromiso, con `origen_tipo`/`origen_id` enlazando ambos mundos                                                                                       |

## 4. Fuentes de CxC (de dónde nace un "nos deben")

| Fuente                                                     | Línea                                                                        | Nota                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sesión realizada **no cobrada**                            | Reservas (PR #5) + 09 §8                                                     | Incidencia operativa del día que, si no se resuelve, se convierte en CxC con responsable                                      |
| Bono vendido **pendiente de cobro**                        | 10 §4 (`borrador`→`vendido` exige cobro; si se entrega sin cobrar, nace CxC) | Excepcional; visible, no normalizado                                                                                          |
| Factura operativa emitida pendiente de cobro               | doc 02 §7 (libro de cobros)                                                  | La CxC "clásica"                                                                                                              |
| Partner pendiente de liquidar (Vivofácil, Oasis, Lidomare) | acuerdos B2B (09 B2-P3)                                                      | Sin acuerdo documentado, el pendiente se registra con evidencia "pendiente" — no se inventa el importe                        |
| Refacturación de coste compartido a tercero                | F-Op C1 (doc 12)                                                             | Si Antifrágil paga el total y refactura su parte a Lidomare                                                                   |
| Cliente con **pago parcial**                               | libro de cobros                                                              | El resto queda `parcialmente_cobrado`                                                                                         |
| **Deuda antigua migrada** (pre-OS)                         | alta administrativa                                                          | Saldo inicial declarado, marcado `origen_legacy`, sin reconstruir historia ni meter datos reales en el repo (espejo de B3-P8) |

## 5. Fuentes de CxP (de dónde nace un "debemos")

| Fuente                                                 | Línea                                                               | Nota                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Liquidación profesional **validada** pendiente de pago | 08 §9 ("entre `validada` y `pagada` la liquidación es una CxP más") | La fuente nueva más importante                                                                                             |
| Factura recibida `pendiente_pago`                      | módulo contabilidad existente                                       | Ya maduro; A2 lo agrega, no lo duplica                                                                                     |
| Nómina del mes pendiente de registrar/pagar            | 08 §3.5                                                             | Importe a cargo de Antifrágil (Lidia 400 €, María Moreno); documento privado                                               |
| Devolución pendiente de ejecutar al cliente            | 10 §6.7                                                             | CxP hasta que sale el dinero                                                                                               |
| Proveedor recurrente (alquiler, software, cuotas)      | vencimientos/presupuestos (F-Op A3)                                 | La recurrencia la genera A3; A2 la sigue                                                                                   |
| Coste compartido con Lidomare                          | reglas C1 (doc 12)                                                  | La parte que Antifrágil debe (o viceversa) según el acuerdo                                                                |
| Impuestos/gestoría                                     | —                                                                   | **Solo recordatorio documental con vencimiento**; el cálculo fiscal es de la gestoría (D-op-6), el OS no liquida impuestos |

## 6. Estados CxC

```text
pendiente ─► reclamado ─► parcialmente_cobrado ─► cobrado
    │             │                │
    │             └────────────────┴─► incobrable (decisión CEO, trazada)
    ├─► disputado (el cliente/partner no reconoce la deuda)
    ├─► cancelado (deuda anulada con motivo y autor; no se borra)
    └─► bloqueado_por_incidencia (transversal)
vencido = derivado (fecha vencimiento < hoy y no cobrado) — se combina con cualquier estado
```

## 7. Estados CxP

```text
pendiente ─► programado ─► parcialmente_pagado ─► pagado
    │             │
    ├─► disputado (no conformidad con el proveedor/importe)
    ├─► cancelado (obligación anulada con motivo)
    └─► bloqueado_por_incidencia (p. ej. liquidación sin evidencia — R2 de 08)
vencido = derivado de fecha, igual que en CxC
```

Reglas: `cobrado`/`pagado` solo los produce **dinero real aplicado** (movimiento de tesorería o libro de cobros/pagos), nunca un botón suelto; `incobrable` y `cancelado` son decisiones trazadas (quién, cuándo, por qué); los estados de gestión **no sustituyen** el estado contable del documento origen.

## 8. Seguimiento operativo (la ficha de cada compromiso)

| Campo                             | Para qué                                                           |
| --------------------------------- | ------------------------------------------------------------------ |
| `responsable`                     | Dueño de la gestión (sin dueño no hay reclamación)                 |
| `proxima_accion` + `fecha_limite` | Qué toca hacer y cuándo (llamar, reenviar factura, programar pago) |
| `ultimo_contacto`                 | Última gestión realizada (de la cadena de `reclamacion`)           |
| `nota_operativa`                  | Contexto libre **no clínico**                                      |
| `prioridad`                       | alta/media/baja (por importe y antigüedad, ajustable)              |
| `origen`                          | De qué nació (sesión, bono, factura, liquidación, partner, legacy) |
| `importe_pendiente`               | Derivado: origen − parciales aplicados                             |
| `dias_vencido`                    | Derivado de fecha                                                  |
| `evidencia`                       | Documento que respalda (o su ausencia marcada)                     |

## 9. Vistas de trabajo

- **CxC hoy** / **CxP hoy**: lo accionable del día (recepción y CEO respectivamente).
- **Vencidos** y **próximos 7 días**: la cola de riesgo y la de planificación.
- **Por responsable**: cada uno ve su cartera de gestión.
- **Por cliente/partner** (id/seudónimo; partners con nombre — son empresas, no pacientes) y **por profesional/proveedor**.
- **Por proyecto / centro / canal**: cruza con las dimensiones de 09 §6 (¿quién nos debe: la operación propia o los partners?).
- **Por importe** y **por antigüedad** (aging: 0-30, 31-60, 61-90, +90 días).

## 10. Relación con Facturación (PR #1)

- Una **factura operativa interna** (prefactura/borrador) puede generar CxC operativa: la factura oficial externa **no es requisito** para ver y gestionar el pendiente.
- Factura emitida sin cobro → CxC con vencimiento (libro de cobros del 02 §7 como fuente).
- Cobro sin factura oficial → válido en operación, pero queda **pendiente documental** visible ("factura sí/no", doc 04 §5.2): la CxC se cierra, el hueco de papel no desaparece.

## 11. Relación con Bonos (PR #19)

- Venta de bono pendiente de cobro → CxC (excepcional, §4).
- Devolución comprometida → CxP hasta ejecutarse (10 §6.7).
- **Un bono cobrado pendiente de devengar NO es CxC**: es deuda de servicio con el cliente (pasivo operativo, 10 §2), no dinero por cobrar. Confundirlos duplicaría el ingreso.
- Sesión consumida sin cobro (suelta o disputa de bono) → incidencia (10 §5 `pendiente_regularizar`), que puede derivar en CxC.

## 12. Relación con Liquidaciones (PR #13)

- Liquidación **validada** → CxP automática (08 §9); **bloqueada** → no pasa a pago (R4 de 08) y aparece como bloqueada aquí también.
- Pagos parciales a profesionales → `parcialmente_pagado`, con el resto visible (08 §5).
- Relación `pendiente_regularizar` (Carlos) → su CxP existe y se ve, con la marca de regularización pendiente; nunca pago opaco.

## 13. Relación con Tesorería (PR #4 — NO APPLY)

- El cobro/pago **real** es lo único que cierra CxC/CxP: movimiento con `origen_tipo`/`origen_id` apuntando al compromiso.
- **Caja/banco son cuentas; el medio (efectivo/tarjeta/bizum/transferencia) es otra cosa** (A1-D6, doc 07 §4.3) — A2 hereda la distinción, no la redefine.
- La **conciliación** (extracto/arqueo) añade el cierre de segundo nivel: compromiso `cobrado/pagado` → `conciliado/revisado` cuando el movimiento casa con el extracto (patrón `revisada` de 08 §5).
- Nada de esto ejecuta SQL: el modelo FOP-A1 del PR #4 sigue NO APPLY.

## 14. Relación con Rentabilidad (PR #15)

- CxC/CxP **no cambian el margen por devengo**: la sesión devengó su ingreso y su coste aunque el dinero no se haya movido (09 §4.3).
- Sí alimentan la **vista caja** (09 §4.4) y explican el desfase devengo↔caja: CxC creciente = margen sin cobrar; CxP creciente = margen sin pagar.
- Pendiente de cobro **no oculta coste devengado**; pendiente de pago **no infla margen**: las dos capas se leen juntas pero no se corrigen entre sí.

## 15. Roles

| Capacidad                                                                 | CEO           | Coordinadora                 | Recepción | Profesional    |
| ------------------------------------------------------------------------- | ------------- | ---------------------------- | --------- | -------------- |
| Todo CxC/CxP, importes globales, incobrables, cancelaciones               | ✅            | ❌                           | ❌        | ❌             |
| CxC operativa (sesiones/bonos sin cobrar, reclamaciones) y su seguimiento | ✅            | ✅                           | ✅        | ❌             |
| CxP de nóminas/liquidaciones globales                                     | ✅            | ❌ (dato retributivo, 08 §7) | ❌        | ❌             |
| Sus propias liquidaciones/pagos pendientes                                | ✅            | ✅ (las suyas)               | —         | ✅ (las suyas) |
| Marcar incobrable / cancelar deuda / programar pagos                      | ✅ (solo CEO) | proponer                     | proponer  | ❌             |

## 16. KPIs

- **Stock:** CxC total · CxP total · CxC vencida · CxP vencida · deuda por partner · deuda por cliente (agregado; detalle bajo permiso) · pagos a profesionales pendientes · devoluciones pendientes.
- **Flujo:** días medios de cobro (DSO) · días medios de pago (DPO) · % cobros parciales · importe reclamado en el periodo · importe marcado incobrable.
- **Operativa del día:** sesiones realizadas no cobradas · bonos vendidos no cobrados · compromisos sin responsable (debe tender a 0) · vencimientos a 7 días.

## 17. Riesgos y salvaguardas

| Riesgo                                                         | Salvaguarda                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Confundir caja con pendiente                                   | A2 muestra lo que falta; FOP-A1 lo que hay; nunca la misma cifra                                                   |
| Ocultar deuda pequeña ("ya se cobrará")                        | Todo compromiso tiene responsable y antigüedad; vista aging sin filtro de importe                                  |
| No reclamar a tiempo                                           | `proxima_accion` + `fecha_limite` obligatorias en CxC vencida                                                      |
| No registrar parciales                                         | Libro de parciales append-only (patrón `factura_pagos`); el pendiente es derivado                                  |
| **Duplicar CxC desde factura y bono** (mismo dinero dos veces) | Un compromiso por hecho generador; la factura del bono referencia la venta (`origen_tipo/id`), no crea segunda CxC |
| Pagar liquidaciones sin evidencia                              | R2 de 08 se hereda: CxP de liquidación bloqueada no es pagable                                                     |
| Usar datos clínicos                                            | D-op-5: cliente id/seudónimo; notas operativas sin contenido asistencial                                           |
| Mezclar banco y medio de pago                                  | A1-D6 heredada explícitamente (§13)                                                                                |
| No asignar responsable                                         | KPI "sin responsable" + alta exige responsable                                                                     |
| No diferenciar operativo/precontable/legal                     | Estados de gestión sobre el documento, nunca en su lugar; el cierre fiscal es de la gestoría                       |

## 18. Pendientes de decisión

| #     | Pendiente                                                                                     | Dueño              |
| ----- | --------------------------------------------------------------------------------------------- | ------------------ |
| A2-P1 | Política de reclamación (cadencia de avisos, tono, quién reclama a partners vs clientes)      | Guille             |
| A2-P2 | Criterio para marcar `incobrable` (antigüedad, importe, intentos)                             | Guille             |
| A2-P3 | Quién puede **cancelar** deuda (propuesta: solo CEO, trazado)                                 | Guille             |
| A2-P4 | Tolerancia de céntimos en parciales (heredar la de `factura_pagos`)                           | Guille             |
| A2-P5 | Tratamiento de la deuda antigua pre-OS (saldo inicial `origen_legacy`)                        | Guille + recepción |
| A2-P6 | Recordatorios automáticos sí/no (y por qué canal)                                             | Guille             |
| A2-P7 | Visibilidad de CxC a recepción: ¿toda la operativa o solo la del día?                         | Guille             |
| A2-P8 | Vencimientos pactados por partner (Lidomare/Vivofácil/Oasis — depende de sus acuerdos, B2-P3) | Guille + partners  |

---

_Diseño documental de FOP-A2. No modifica código productivo, SQL, tipos ni UI. Requiere validación de Guille antes de abrir implementación._
