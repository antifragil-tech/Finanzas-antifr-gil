# FOP-B3 — Bonos, programas y devengo de ingresos

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Prepara la futura implementación del ciclo de vida de bonos/programas y del devengo de ingresos.
> **Rama:** `docs/finanzas-bonos-programas-devengo`
> **Fecha:** 2026-07-05
> **Depende de:** `09-rentabilidad-operativa-...md` (FOP-B2, PR #15 — este doc **resuelve su pendiente B2-P1**), `08-liquidaciones-equipo-y-profesionales.md` (coste, PR #13), `02-diseno-facturacion-emitida.md` (documento fiscal, PR #1), `04`/`05` (marco y F-7, PR #11). Conceptualmente también de FOP-A1 (caja, PR #4 — NO APPLY) y de la línea Reservas (PR #5, sesiones).
> **Regla:** reutilizar antes de crear. Capa **operativa/precontable** (D-op-6): nada de aquí sustituye al criterio fiscal de la gestoría. El cliente aparece solo como id/seudónimo (D-op-5); cero datos clínicos.

---

## 0. Nomenclatura y encaje en la serie F-Op

Nombre de producto: **FOP-B3 — Bonos, programas y devengo de ingresos**. Encaje:

- Implementa la pieza **"devengo de bonos/programas"** de F-Op B del backlog (05, PR #11: _"ingreso anticipado → reconocido sesión a sesión"_) y responde la duda **F-7** del doc 04 (criterio de devengo y caducidad).
- **Resuelve B2-P1 del doc 09** (PR #15): FOP-B2 definía la escalera de márgenes asumiendo un criterio de devengo provisional; este doc fija el criterio recomendado y su mecánica completa.
- Continúa la serie de producto: FOP-B1 = coste de personas (08), FOP-B2 = rentabilidad (09), **FOP-B3 = la pata de ingreso devengado** que B2 consume. Reconciliación de nomenclatura con el backlog: misma nota pendiente que 08 §0 / 09 §0 (post-merge de #11, ver §17).

---

## 1. Problema

- Los bonos y programas **se cobran antes** de prestar todas las sesiones: el día del cobro hay caja, pero no hay ingreso ganado — hay una **deuda de servicio** con el cliente.
- **Caja no es rentabilidad** (doc 04 §2): si el mes de la venta se apunta 225 € de "ingreso", el margen de ese mes se infla y el de los siguientes se hunde.
- **Facturación no es devengo** (doc 02 §7): la factura documenta la venta una vez; la prestación se reconoce sesión a sesión.
- Una **sesión consumida** genera dos cosas a la vez: ingreso reconocido (su porción del bono) y coste profesional (la liquidación de 08). Si solo se registra una de las dos, el margen miente.
- Sin un modelo explícito de saldo/consumo, los errores típicos son: **doble conteo** (cobro + sesión como dos ingresos), **ingreso oculto** (bonos consumidos sin reconocer), sesiones consumidas dos veces, o bonos caducados que nadie liquida.

## 2. Principio central

**Un bono es un cobro anticipado que se convierte en ingreso a medida que se consume.** Tres lecturas del mismo hecho, nunca sumadas (invariante anti-doble-conteo, docs 01/04):

```text
Bono de fisioterapia 225 € / 5 sesiones:

  CAJA         +225 € el día del cobro (una sola vez; medio: efectivo/tarjeta/bizum…)
  DEVENGO       45 € por sesión realizada (5 × 45 = 225; nunca más, nunca antes)
  DOCUMENTO     factura/prefactura según criterio fiscal de la gestoría (una sola vez)
  MARGEN        45 € − coste profesional directo de cada sesión (p. ej. 30 €) = 15 €/sesión
```

Entre el cobro y el consumo completo, la diferencia (`cobrado − devengado`) es el **pendiente de devengar**: operativamente, sesiones que se deben al cliente. El OS debe poder decir en todo momento cuánta "deuda de sesiones" hay viva — es la cifra que evita confundir un buen mes de caja con un buen mes de negocio.

---

## 3. Entidades conceptuales

> Conceptual, no esquema final. Las columnas exactas se fijan en la fase de implementación con su migración (que **no** forma parte de este PR). Todo lo económico es **append-only**: las correcciones son apuntes nuevos, no ediciones.

| Entidad                  | Qué es                                                                                                                                                                                                                                              | Claves                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `bono_programa`          | El **producto** del catálogo (línea Clínica): "Programa 5 sesiones fisio 225 €", "Plan nutrición mensual". Define nº de unidades, precio, servicio, validez estándar y regla de devengo por defecto                                                 | tipo (`bono_sesiones` \| `programa_mensual`), nº unidades, precio, caducidad estándar |
| `venta_bono`             | La **instancia comprada** por un cliente: fecha de venta, precio realmente cobrado (con descuento si lo hay), caducidad concreta, estado (§4)                                                                                                       | cliente (id), producto, importe real, vencimiento                                     |
| `cliente_administrativo` | El comprador como **id/seudónimo administrativo** (D-op-5). Sin datos personales en esta capa; los datos finos viven en `clinica` con RLS                                                                                                           | id, canal de alta (09 §5.4)                                                           |
| `saldo_sesiones`         | **Derivado, nunca almacenado a mano:** unidades compradas − consumidas − devueltas − caducadas. Si un dato fuente se corrige, el saldo se recalcula solo                                                                                            | lectura, no tabla editable                                                            |
| `sesion_consumida`       | El **consumo de una unidad** del bono por una cita/sesión de agenda (PR #5). Referencia a la sesión por id + fecha + profesional; una cita consume como máximo una unidad y una unidad se consume una sola vez                                      | venta_bono, sesión (id), fecha, tipo (§5)                                             |
| `regla_devengo`          | Cómo se reconoce el ingreso de esa venta (§6): lineal por sesión, por importe real, por periodo (programas mensuales). Referenciada e inmutable por venta (si el criterio cambia, afecta a ventas nuevas)                                           | tipo, importe/unidad, confirmada                                                      |
| `devengo_registrado`     | El apunte de ingreso reconocido (equivale al `ingreso_devengado` de 09 §6.2): venta, sesión/periodo, importe, fecha de devengo                                                                                                                      | append-only                                                                           |
| `devolucion`             | Salida de dinero que cancela unidades **no consumidas**: importe, medio, cuenta de tesorería, motivo. Nunca borra devengos ya registrados                                                                                                           | venta_bono, unidades, importe                                                         |
| `caducidad`              | Evento de vencimiento de una venta con saldo: fija cuántas unidades caducan y dispara el tratamiento de §6.6                                                                                                                                        | venta_bono, unidades caducadas, fecha                                                 |
| `cortesia`               | Unidad o sesión regalada: ingreso 0, coste real si lo hay. Marcada para poder filtrarla en la lectura comercial sin borrarla de la real (09 §8)                                                                                                     | origen (bono/suelta), motivo                                                          |
| `ajuste_manual`          | Apunte con signo sobre devengo o saldo (error de conteo, compensación). Siempre con motivo, autor y fecha — espejo del `ajuste_manual` de 08 §4.6                                                                                                   | venta_bono, importe/unidades, motivo                                                  |
| `documento_operativo`    | El vínculo con la cara documental (doc 02): prefactura/borrador interno de la venta y, cuando exista, referencia a la factura oficial. El bono ya tiene su espejo previsto en el catálogo de Clínica (`cliente_producto.factura_emitida_id`, 02 §6) | venta_bono, origen_tipo/origen_id                                                     |

**Relación entre piezas:**

```text
catálogo Clínica ─► bono_programa ─► venta_bono ──► cobro (caja, FOP-A1) ─── una vez
                                        │  │
   agenda (PR #5) ─► cita/sesión ─► sesion_consumida ─► devengo_registrado ─── sesión a sesión
                                        │  │                    │
                                        │  └─ devolucion / caducidad / cortesia / ajuste_manual
                                        │                       ▼
                                        └────────► documento_operativo (doc 02)   margen (09) = devengo − coste (08)
```

---

## 4. Estados de la venta de bono/programa

```text
borrador ─► vendido ─► activo ─► parcialmente_consumido ─► consumido
                         │                │
                         │                ├─► caducado          (vence con saldo)
                         │                ├─► devuelto_parcial  (devolución de parte del saldo)
                         │                └─► devuelto_total    (devolución de todo el saldo)
                         │
                         └─► cancelado (antes de consumir nada; con o sin devolución)

bloqueado_por_incidencia: transversal (con motivo y vuelta al estado previo)
```

| Estado                                | Significado                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `borrador`                            | Preparado en mostrador, sin cobro. Sin efecto económico                                                                   |
| `vendido`                             | Cobrado (caja +importe). Nace la deuda de servicio completa                                                               |
| `activo`                              | Vigente con saldo íntegro                                                                                                 |
| `parcialmente_consumido`              | Al menos una unidad consumida; devengo parcial registrado                                                                 |
| `consumido`                           | Saldo 0 por consumo; `devengado = cobrado`                                                                                |
| `caducado`                            | Venció con saldo > 0; tratamiento del remanente según §6.6                                                                |
| `devuelto_parcial` / `devuelto_total` | Devolución registrada (§6.7); el estado conserva la historia                                                              |
| `cancelado`                           | Anulado antes de consumir; si hubo cobro, exige devolución o ajuste trazado                                               |
| `bloqueado_por_incidencia`            | Discrepancia (consumos disputados, cobro sin cuadrar, regla sin confirmar); lo desbloquea el CEO — mismo patrón que 08 §5 |

Invariantes: **V1** — `Σ devengado + pendiente de devengar + devuelto + tratado por caducidad = importe cobrado` (la venta siempre cuadra). **V2** — ninguna unidad se consume dos veces ni sin saldo. **V3** — los estados económicos los mueven hechos (cobro, consumo, devolución), no ediciones manuales.

## 5. Estados de una sesión dentro del bono

| Estado                    | ¿Consume unidad?                                           | ¿Devenga ingreso?                        | ¿Genera coste profesional?                                                                         |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `reservada`               | no (bloquea hueco)                                         | no                                       | no                                                                                                 |
| `realizada` → `consumida` | **sí**                                                     | **sí** (su porción)                      | **sí** (regla 08 §4.3)                                                                             |
| `no_show_cobrado`         | sí (recomendado, ⚠️ B3-P2)                                 | sí (la unidad se pierde para el cliente) | según regla del profesional (⚠️ B3-P6, hereda B2-P4; recomendado: no)                              |
| `no_show_no_cobrado`      | no (recomendado)                                           | no                                       | solo si la regla del profesional lo paga → margen negativo visible                                 |
| `cancelada_a_tiempo`      | no                                                         | no                                       | no                                                                                                 |
| `cortesia`                | según origen (unidad regalada añadida, o consumo regalado) | **no** (ingreso 0)                       | sí → margen negativo visible (09 §8)                                                               |
| `pendiente_regularizar`   | en suspenso                                                | en suspenso                              | en suspenso — sesión con datos incompletos (sin validar, disputa); bloquea la venta si se acumulan |

La validación operativa de la sesión (asistencia/cobro) es la misma de Reservas/FOP-B1 (08 §6): **B3 no crea un segundo circuito de validación**, consume el existente.

---

## 6. Reglas de devengo

### 6.1 Lineal por sesión (criterio RECOMENDADO — resuelve B2-P1)

`devengo por sesión = importe realmente cobrado ÷ nº de unidades`. Para el bono canónico: 225 € / 5 = **45 €/sesión**. Simple, auditable, y estable aunque las sesiones del bono valgan distinto sueltas. Es el criterio por defecto de todo `bono_sesiones`.

### 6.2 Por importe real (bonos con descuento)

El lineal se aplica **siempre sobre lo cobrado, no sobre el PVP del catálogo**: un bono de 225 € vendido a 200 € (tarifa Founder/VIP) devenga 40 €/sesión. El descuento no es un coste: es menos ingreso (09 §4.1).

### 6.3 Por periodo (programas/planes mensuales)

Los `programa_mensual` (p. ej. plan de nutrición) devengan **la cuota en el mes del plan**, no por sesión. Es el espejo de ingreso de la regla de coste `mensual_por_plan` de 08 §4.4 — y hereda su pendiente (B1-P1: definición exacta de "cliente activo", prorrateos).

### 6.4 Cortesías

Ingreso devengado **0**; coste profesional real si la regla del profesional paga la sesión. Margen negativo **visible y etiquetado** — es una inversión comercial, no un error, pero no se esconde.

### 6.5 No-show cobrado

Recomendación (⚠️ pendiente B3-P2): la unidad **se consume y devenga** (el cliente la pierde; el dinero está ganado) en la fecha de la cita. Si el profesional no cobra el no-show (B3-P6), el margen de esa "sesión" es el 100 % del devengo. Si negocio decidiera no consumir unidad en no-shows, el modelo lo soporta cambiando el tipo de la `sesion_consumida` — sin rediseño.

### 6.6 Caducidad

Cuando una venta vence con saldo, el remanente (`pendiente de devengar`) **no puede quedar en el limbo**. Propuesta operativa: reconocerlo como ingreso en el mes de caducidad, etiquetado `ingreso_por_caducidad` (separado del devengo por prestación, para no ensuciar el margen de servicios). ⚠️ **El criterio fiscal no se inventa aquí** (B3-P1): cómo tributa un bono caducado —y si conviene política de prórroga en vez de caducidad— lo fija la gestoría. Hasta entonces, la caducidad se registra y el remanente aparece como "pendiente de criterio", nunca desaparece.

### 6.7 Devoluciones

- Solo se devuelven unidades **no consumidas**: `importe = unidades no consumidas × devengo unitario` (parcial) o el saldo completo (total).
- La devolución **reduce saldo y pendiente de devengar** y genera **salida de caja** (movimiento de tesorería FOP-A1, con medio y cuenta). **Nunca toca los devengos ya registrados**: las sesiones prestadas están prestadas.
- Si excepcionalmente se pactara devolver más que el pendiente (gesto comercial), la diferencia es un `ajuste_manual` negativo trazado, no una edición del histórico.
- Si la venta tuvo factura oficial, la devolución exige su **rectificativa** por el circuito del doc 02 §3.3 — B3 registra el hecho operativo y enlaza el documento; no emite nada.

---

## 7. Ejemplos numéricos

**A) Bono 5 sesiones de fisioterapia** (regla 6.1; coste profesional 30 €/sesión — tarifa de 08 §2):

```text
Cobro inicial (caja):            225 €   (día de la venta, una vez)
Ingreso devengado por sesión:     45 €   (en la fecha de cada sesión realizada)
Coste profesional por sesión:    −30 €
Margen bruto por sesión (M1):     15 €   (5 sesiones → 75 € de margen total del bono)
```

**B) Sesión suelta** (referencia, sin bono):

```text
Cobro: 55 € · Coste profesional: −30 € · Margen bruto M1: 25 €
```

La misma sesión margina 25 € suelta y 15 € dentro del bono: el bono compra recurrencia a cambio de margen unitario. Ese trade-off es visible en el panel por `tipo_venta` (09 §5.3), no una sorpresa a fin de año.

**C) Bono parcialmente consumido** (foto a fin de mes):

```text
Cobrado:                    225 €   (caja del mes de la venta)
Sesiones realizadas:          3
Ingreso devengado:          135 €   (3 × 45; margen devengado 3 × 15 = 45 €)
Pendiente de devengar:       90 €   (deuda de servicio: 2 sesiones)
```

**D) Bono caducado con 2 sesiones pendientes:** los 90 € restantes se registran como remanente de caducidad. **El criterio fiscal no se inventa** (§6.6, B3-P1): operativamente la propuesta es reconocerlos como `ingreso_por_caducidad` en el mes del vencimiento, pero queda pendiente de validación de la gestoría. El panel los muestra separados del margen de servicios.

**E) Sesión de cortesía:**

```text
Ingreso: 0 € · Coste profesional: según regla (p. ej. −30 €) · Margen: −30 € (visible, etiquetado cortesía)
```

## 8. Relación con Reservas (PR #5)

- La **cita/sesión de agenda es el hecho operativo**: B3 no tiene agenda propia; consume la de Reservas por **id administrativo** (cita, cliente-id, profesional, servicio). Sin datos clínicos, jamás (D-op-5).
- Una cita **completada** puede consumir una unidad del bono (una y solo una — invariante V2); Reservas muestra el saldo al reservar ("le quedan 2 sesiones").
- Una cita realizada pero **no cobrada** (suelta) o con consumo disputado queda como **incidencia** (`pendiente_regularizar`), visible en el día a día de recepción — no se resuelve borrándola.
- El estado de validación de la sesión es el de Reservas/08 §6; B3 solo lo lee.

## 9. Relación con Facturación (PR #1)

- **Factura operativa interna ≠ factura oficial** (D1, doc 02 §0.1): el OS es precontable; la emisión legal se delega en gestoría/software homologado.
- El bono puede cobrarse **antes** de que exista factura oficial; el documento puede emitirse después y **documenta la venta completa** (225 €, una vez, con su tratamiento fiscal — Clínica hoy sin IVA, D2).
- **Fecha de factura ≠ fecha de prestación:** la rentabilidad reconoce sesión a sesión aunque la factura tenga otra fecha (regla de oro del doc 02 §0).
- El gancho ya existe: `origen_tipo = 'bono'` + `origen_id` en `facturas_emitidas` (02 §6) y `cliente_producto.factura_emitida_id` en el catálogo. B3 los usa; no crea vínculos nuevos.

## 10. Relación con Tesorería (PR #4 — NO APPLY)

- El **cobro** del bono entra una vez en caja o banco según su medio (efectivo/tarjeta/bizum/transferencia), con su **comisión TPV** como coste directo del cobro (09 §4.2).
- Las **devoluciones** son salidas de caja/banco trazadas (movimiento con `origen_tipo = 'devolucion_bono'`).
- **Vista caja ≠ vista devengo** (09 §4.4): el mes de la venta luce en caja; los meses de consumo lucen en devengo. Ninguna de las dos se corrige para parecerse a la otra.
- Nada de esto ejecuta SQL: el modelo FOP-A1 del PR #4 sigue **NO APPLY**.

## 11. Relación con Liquidaciones (PR #13)

- Cada **sesión realizada genera coste profesional** según la regla vigente del profesional (08 §4), **aunque el cliente pagara meses antes**: el coste se devenga en el mes de la sesión.
- Bono cobrado con sesión **no realizada** = sin coste profesional (salvo la regla de no-show de §6.5/B3-P6).
- Una liquidación `bloqueada_por_incidencia` (08 §5) marca como **provisional** el margen de sus sesiones (09 §11) — el devengo de ingreso no se detiene por ello.
- Invariante compartida: una sesión ∈ una liquidación (R3 de 08) y una sesión consume ≤ 1 unidad de bono (V2) — el mismo hecho, contado una vez en cada cara.

## 12. Relación con Rentabilidad (PR #15)

- **Este doc resuelve B2-P1:** criterio lineal por importe real (§6.1-6.2) para bonos, por periodo para planes (§6.3), caducidad separada del margen de servicios (§6.6).
- `devengo_registrado` **es** el `ingreso_devengado` que 09 §6.2 dejaba definido de forma abstracta; la escalera M1-M4 y los paneles de 09 lo consumen sin cambios.
- El anti-doble-conteo queda cerrado extremo a extremo: caja una vez (§10), documento una vez (§9), devengo progresivo (§6) — tres lecturas, un hecho.

## 13. Vistas por rol

Hereda las matrices de 08 §7 y 09 §10; lo específico de bonos:

| Capacidad                                                                                          | CEO           | Coordinadora | Recepción | Profesional  |
| -------------------------------------------------------------------------------------------------- | ------------- | ------------ | --------- | ------------ |
| Saldo económico global: cobrado, devengado, pendiente de devengar, caducados, devoluciones, margen | ✅            | ❌           | ❌        | ❌           |
| Sesiones disponibles/consumidas por bono, incidencias operativas                                   | ✅            | ✅           | ✅        | ❌           |
| Vender bono, registrar cobro, consumir unidad en cita                                              | ✅            | ✅           | ✅        | ❌           |
| Devoluciones y ajustes manuales                                                                    | ✅            | proponer     | proponer  | ❌           |
| Cambiar reglas de devengo, precios, caducidades                                                    | ✅ (solo CEO) | ❌           | ❌        | ❌           |
| Ver su sesión asignada (sin saldo económico del cliente ni del negocio)                            | ✅            | ✅           | —         | ✅ (la suya) |

Regla dura: **recepción opera el día a día (vender, cobrar, consumir) pero no modifica reglas económicas** — precios, devengo y caducidad son configuración, no operación (riesgo §15).

## 14. KPIs

- **Venta y caja:** bonos vendidos (nº e importe) · ingresos cobrados por bonos · devoluciones (nº e importe).
- **Devengo:** ingresos devengados por bonos · **pendiente de devengar** (la deuda de sesiones, el KPI que evita el espejismo de caja) · ingreso por caducidad (separado).
- **Consumo:** sesiones disponibles vivas · consumidas en el periodo · caducadas · cortesías · no-shows cobrados y no cobrados · velocidad de consumo (semanas hasta agotar bono).
- **Margen:** margen bruto por bono (precio − Σ costes de sus sesiones) · margen por sesión consumida · margen por `tipo_venta` (suelta vs bono vs plan, 09 §5.3).
- **Control:** bonos `bloqueados_por_incidencia` · sesiones `pendiente_regularizar` · ventas que vencen en <30 días con saldo (alerta para recepción: avisar al cliente **antes** de caducar).

## 15. Riesgos y salvaguardas

| Riesgo                                                            | Salvaguarda                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Doble contar cobro y sesión** como dos ingresos                 | Principio central §2 + invariante V1: la venta cuadra siempre (`devengado + pendiente + devuelto + caducado = cobrado`)        |
| **Reconocer ingreso antes de la prestación**                      | El devengo solo lo dispara una `sesion_consumida` (o el periodo del plan); nunca la venta                                      |
| **Olvidar el coste profesional** de sesiones de bono ya cobradas  | La sesión consumida referencia la misma `sesion_liquidable` de 08: sin coste no cuadra la liquidación del profesional          |
| **No registrar devoluciones** (caja miente)                       | Devolución = movimiento de tesorería obligatorio + estado de la venta; no existe "devolver de palabra"                         |
| **Caducar bonos sin criterio** (ingreso fantasma o regalo eterno) | Evento de caducidad explícito + remanente etiquetado pendiente de criterio fiscal (B3-P1); alerta de vencimiento próximo (§14) |
| **Mezclar factura legal con devengo operativo**                   | §9: documento una vez, devengo por prestación; fechas independientes (regla de oro doc 02)                                     |
| **Usar datos clínicos**                                           | D-op-5: solo ids administrativos; el motivo de la sesión jamás entra en B3                                                     |
| **Recepción modifica reglas económicas sin control**              | §13: precios/devengo/caducidad son configuración solo-CEO; recepción opera, no configura                                       |
| **Bonos que distorsionan el margen mensual**                      | Vistas devengo/caja separadas (09 §4.4) + KPI pendiente de devengar: el mes de venta no se apunta el margen de los siguientes  |
| **No distinguir caja de rentabilidad**                            | Todo el diseño existe para esto; si una cifra no dice de qué vista es, está mal presentada                                     |

## 16. Pendientes de decisión

| #     | Pendiente                                                                                                                         | Dueño                  | Efecto mientras tanto                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| B3-P1 | **Criterio fiscal/contable de caducidad** (¿ingreso al caducar? ¿prórroga en vez de caducar?)                                     | Gestoría + Guille      | Remanentes registrados como "pendiente de criterio"; propuesta operativa §6.6                                                    |
| B3-P2 | **No-show cobrado:** ¿consume unidad y devenga? (recomendado: sí)                                                                 | Guille                 | Se asume la recomendación, marcada provisional                                                                                   |
| B3-P3 | **Devolución parcial:** ¿siempre a devengo unitario, o admite penalización/recargo?                                               | Guille                 | Se asume devengo unitario sin penalización                                                                                       |
| B3-P4 | **Bonos promocionales / cortesía de captación** (unidades regaladas al vender): ¿diluyen el devengo unitario o van como cortesía? | Guille                 | Recomendado: recalcular devengo unitario = cobrado ÷ unidades totales (incluidas regaladas)                                      |
| B3-P5 | **Política de cortesías** (quién autoriza, tope mensual)                                                                          | Guille                 | Cualquier cortesía queda trazada con motivo y autor                                                                              |
| B3-P6 | **¿El profesional cobra el no-show?** (por profesional/regla — hereda B2-P4 de 09)                                                | Guille + profesionales | Se asume que no                                                                                                                  |
| B3-P7 | **¿Bonos transferibles entre clientes?**                                                                                          | Guille                 | Recomendado: no transferibles por defecto; si se autoriza, traspaso trazado como ajuste (nunca reventa)                          |
| B3-P8 | **Bonos antiguos previos al OS:** cómo se cargan (saldo vivo, importe cobrado histórico, sin inventar devengos pasados)           | Guille + recepción     | Propuesta: alta de migración con saldo y pendiente de devengar declarados, marcados `origen_legacy`, sin datos reales en el repo |

**Fuera de alcance:** pricing del catálogo (línea Clínica), emisión fiscal (gestoría, doc 02), pasarelas de pago/automatismos de cobro, y cualquier implementación (SQL/tipos/UI).

## 17. Sincronización con PRs y docs (sin editar otros PRs)

Este PR **solo añade este archivo**. Cambios a aplicar en otros docs **después** de sus merges:

| Doc a tocar                                  | Vive en | Cambio pendiente                                                                                                                                         |
| -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `09-rentabilidad-...md` §13 (B2-P1)          | PR #15  | Marcar B2-P1 como "resuelto en diseño por [10-bonos...](10-bonos-programas-y-devengo-de-ingresos.md) (FOP-B3); pendiente solo la confirmación de Guille" |
| `05-backlog-finanzas-operativas.md` (F-Op B) | PR #11  | Nota: "devengo de bonos/programas diseñado en el doc 10 (FOP-B3)"; reconciliar nomenclatura de la serie FOP-B1/B2/B3                                     |
| `07-sincronizacion-prs-...md`                | PR #11  | Añadir esta línea a la tabla de líneas de trabajo                                                                                                        |
| `02-diseno-facturacion-emitida.md`           | PR #1   | Referencia cruzada opcional: el devengo del bono facturado vive en el 10                                                                                 |
| `docs/integration/01-orden-prs.md`           | PR #10  | Añadir este PR al bloque "finanzas docs" (archivo nuevo, sin dependencias duras)                                                                         |

Dependencias conceptuales (no de merge): #15 (consume este criterio), #13 (coste), #1 (documento), #4 (caja, NO APPLY), #5 (sesiones), #11 (marco). Archivo nuevo sin colisiones: no exige orden de merge.

## 18. Criterio de "hecho" (para la futura implementación, no para este PR)

- [ ] Vender un bono registra cobro (caja, una vez) y nace su deuda de servicio; el saldo es derivado, nunca editable.
- [ ] Cada cita completada consume ≤ 1 unidad y registra su devengo y su coste en la fecha de la sesión (V1/V2 verificables).
- [ ] Cortesías, no-shows, caducidades y devoluciones siguen §5-§6 y quedan trazadas append-only.
- [ ] El panel muestra cobrado / devengado / **pendiente de devengar** por venta y agregado, y las vistas caja/devengo por separado.
- [ ] Las devoluciones generan movimiento de tesorería y, si hay factura oficial, enlazan su rectificativa.
- [ ] La visibilidad respeta §13 (saldo económico global solo CEO; recepción opera sin configurar).
- [ ] Los pendientes B3-P1..P8 están resueltos o siguen bloqueando explícitamente.
- [ ] Ningún dato clínico ni personal en esta capa (D-op-5).

---

_Diseño documental de FOP-B3. No modifica código productivo, SQL, tipos ni UI. Requiere validación de Guille (y de la gestoría en caducidad/fiscalidad) antes de abrir implementación._
