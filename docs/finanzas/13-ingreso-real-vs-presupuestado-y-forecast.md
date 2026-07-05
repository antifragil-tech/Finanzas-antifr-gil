# FOP-D1 — Ingreso real vs presupuestado, desviaciones y forecast

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Desarrolla la fase F-Op D del backlog (control presupuestario operativo), primera pieza (D1: ingresos y forecast).
> **Rama:** `docs/finanzas-fop-d1-ingreso-real-presupuesto`
> **Fecha:** 2026-07-05
> **Depende de:** `05` (F-Op D, PR #11), `10` (devengo, PR #19 — sin él este doc sería mentira: el cobro de bonos inflaría el "real"), `09` (margen, PR #15), `11` (CxC, PR #20), `02` (documento, PR #1). La agenda futura viene de la línea Reservas (PR #5).
> **Regla:** reutilizar antes de crear — el armazón presupuestario existe (`presupuestos`, `presupuesto_ingresos`, `presupuesto_pagos`, flags `es_real`/`es_previsto`). Capa de gestión (D-op-6); cero datos clínicos (D-op-5).

---

## 0. Encaje en la serie

Implementa **F-Op D** del backlog como **FOP-D1** (ingresos y forecast; la comparativa de gastos y el forecast de margen completo quedan como evolución D2 cuando A2/C1 estén implementados). Es la fase que el backlog marca 🟠 "gated por ingreso real fluyendo": se diseña ahora, se implementa cuando B3 (devengo) y las fuentes reales existan. Cierra el hueco nº5 del doc 04 §9.

## 1. Problema

- Se presupuestan ingresos pero **no se comparan bien con la realidad**: hay presupuesto y hay flujo real, pero no comparativa línea a línea, ni forecast, ni alertas (doc 04 §6 / backlog F-Op D).
- **Cobro real, ingreso devengado y factura son tres cifras distintas** (docs 04/10): comparar el presupuesto contra la equivocada lleva a conclusiones falsas.
- **Un mes puede cobrar mucho y prestar poco** (venta fuerte de bonos): sin separar devengo de caja, ese mes "cumple objetivo" mientras acumula deuda de sesiones.
- Sin forecast, la desviación se descubre **al cerrar el mes**, cuando ya no hay margen de reacción.

## 2. Objetivo

Comparar **previsto vs realizado** con la cifra correcta en cada vista — devengado para cumplimiento real, cobrado para caja — por proyecto, centro, canal, servicio y profesional, en cortes semana/mes/trimestre, con **forecast de cierre** y alertas por umbral.

## 3. Fuentes

| Fuente                           | Aporta                                         | Línea                            |
| -------------------------------- | ---------------------------------------------- | -------------------------------- |
| Presupuesto/objetivo de ingresos | la vara de medir (versionada, ver riesgo §16)  | armazón `presupuestos` existente |
| Citas realizadas/validadas       | devengo de sesiones sueltas y consumo de bonos | Reservas (PR #5)                 |
| Bonos vendidos                   | caja del mes + pendiente de devengar           | 10 (PR #19)                      |
| Ingresos devengados              | el "real" principal                            | `devengo_registrado` (10 §3)     |
| Cobros                           | el "real" de caja                              | libro de cobros (02 §7) / FOP-A1 |
| Facturas operativas              | documentación/precontable                      | 02 (PR #1)                       |
| CxC                              | cobro esperado de lo ya prestado               | 11 (PR #20)                      |
| Cancelaciones y no-shows         | corrección de la previsión                     | Reservas + 10 §5                 |
| Devoluciones                     | menos ingreso (caja) / menos pendiente         | 10 §6.7                          |

## 4. Métricas principales

- **Ingreso presupuestado** (objetivo del periodo, por dimensión).
- **Ingreso devengado** (real principal) · **ingreso cobrado** (real de caja) · **pendiente de devengar** (deuda de sesiones, 10 §14) · **CxC** (prestado sin cobrar).
- **Desviación absoluta** (devengado − presupuestado) y **desviación %**.
- **Forecast de cierre de mes** (§6) y **run-rate** (ritmo actual proyectado).
- **% cumplimiento de objetivo** (devengado/presupuestado; la vista caja se etiqueta aparte).
- **Margen forecast** (si se cruza con coste esperado — evolución D2; v1 solo lo esboza con el coste profesional directo de 08).

## 5. Vistas

- **Mensual** (la principal) · **semanal** · **acumulado del mes** (día a día contra objetivo prorrateado).
- Por **centro**, **canal**, **servicio**, **proyecto**, **profesional**, **programa/producto**, **partner**.
- **Semáforo**: verde (≥ objetivo − umbral), ámbar (dentro del umbral de alerta), rojo (desviación > umbral) — umbrales pendientes D1-P7.
- Cada vista muestra **dos columnas de real** (devengado / cobrado) y nunca las suma.

## 6. Forecast (métodos, del más simple al más fino)

| Método                      | Cómo                                                                                    | Cuándo sirve                           |
| --------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------- |
| `lineal_por_dias`           | devengado hasta hoy ÷ días transcurridos × días del mes                                 | arranque; meses estables               |
| `run_rate_sesiones`         | sesiones/día recientes × devengo medio por sesión × días restantes                      | actividad como driver                  |
| `por_agenda_futura`         | + citas ya reservadas del resto del mes (con % histórico de cancelación/no-show)        | cuando Reservas fluya; el más útil     |
| `por_bonos_pendientes`      | + consumo esperado del pendiente de devengar (ritmo histórico de consumo)               | complementa agenda                     |
| `conservador` / `optimista` | banda: agenda confirmada sola vs agenda + reservas típicas de última hora               | decisiones con rango, no con un número |
| `ajustado_manual`           | corrección del CEO **con motivo, autor y fecha** (trazada, no sobrescribe el calculado) | eventos conocidos que el dato no ve    |

El forecast **descuenta siempre** cancelaciones/no-shows históricos y **nunca** cuenta la venta de bonos como ingreso del mes (solo su consumo esperado).

## 7. Ejemplos (mecánica, cifras ilustrativas)

- **A) Mes con mucho cobro de bonos y poco devengo:** cobrado 4.000 €, devengado 2.400 €. La vista caja luce; el cumplimiento real es 2.400 contra objetivo. El pendiente de devengar sube +1.600 € → el panel lo dice: "este mes se vendió futuro, no se prestó presente".
- **B) Mes con muchas sesiones pendientes de cobro:** devengado 3.000 €, cobrado 2.200 €, CxC +800 €. Cumplimiento real bien; alerta de caja y trabajo para A2 (reclamación).
- **C) Canal Lidomare con volumen alto y margen bajo:** ingreso devengado alto, pero al cruzar con coste (acuerdo del centro + tarifas) el margen por sesión queda por debajo del propio (09 §5.6). El forecast de ingreso solo no lo ve — por eso D2 cruza con costes.
- **D) Vivofácil con retraso de cobro:** devengo estable, cobros a 60+ días → CxC de partner crece (11 §4); el semáforo de caja se enciende aunque el de cumplimiento esté verde.
- **E) 9AM con gasto de marketing y conversión posterior:** el coste comercial se imputa al canal 9AM (12 §6); la conversión a clientes de servicio aparece semanas después — la lectura correcta es por cohorte de canal (09 §5.4), no contra el mes del gasto.

## 8. Relación con Bonos (PR #19)

- **El cobro anticipado no es ingreso del mes**: el cumplimiento se mide sobre devengo (10 §2).
- **Pendiente de devengar** es métrica crítica del panel: es el "colchón" de ingreso futuro ya cobrado.
- Los **bonos caducados** se muestran separados (`ingreso_por_caducidad`, 10 §6.6): no maquillan el cumplimiento de servicios.

## 9. Relación con Rentabilidad (PR #15)

- El forecast de ingresos **no basta**: un objetivo cumplido con mix de bajo margen es peor que uno casi cumplido con buen mix. D1 muestra ingreso; la lectura completa cruza con la escalera M1-M4 (margen forecast, evolución D2).
- Las dimensiones (centro/canal/proyecto/servicio/profesional) son las de 09 §6 — mismas etiquetas, mismos catálogos.

## 10. Relación con Facturación (PR #1)

- **La factura no manda en devengo** (regla de oro del 02): documenta y alimenta la precontabilidad.
- Una factura pendiente **no bloquea** el control operativo: el devengo y el cobro se miden aunque el papel llegue después (hueco documental visible, 11 §10).

## 11. Relación con Reservas (PR #5)

- La **agenda futura** alimenta el forecast (`por_agenda_futura`); las **citas realizadas** alimentan el devengo; **cancelaciones y no-shows** corrigen la previsión con tasas históricas.
- Solo ids administrativos; el motivo de la cita jamás entra en el panel (D-op-5).

## 12. Relación con Liquidaciones (PR #13)

- El **margen forecast** necesita el coste profesional esperado: sesiones previstas × regla vigente de cada profesional (08 §4) + nóminas como fijo del mes.
- Liquidaciones pendientes o bloqueadas **no ocultan coste**: el coste esperado se devenga igual en la previsión.

## 13. Relación con el modelo financiero (PR #11)

- Encaja como **F-Op D** del backlog; depende de A2 (pendientes), B2 (margen) y B3 (devengo) — por eso es la última fase en orden conceptual.
- **No abre implementación**: diseño listo para cuando fluya el ingreso real.

## 14. Roles

| Capacidad                                                      | CEO | Coordinadora       | Recepción | Profesional    |
| -------------------------------------------------------------- | --- | ------------------ | --------- | -------------- |
| Objetivos, forecast, desviaciones, margen                      | ✅  | ❌ (salvo permiso) | ❌        | ❌             |
| Cumplimiento operativo (sesiones, ocupación, agenda vs plan)   | ✅  | ✅                 | ❌        | ❌             |
| Cobros pendientes y agenda del día                             | ✅  | ✅                 | ✅        | ❌             |
| Métricas propias (sus sesiones vs su plan, si se decide D1-P2) | ✅  | ✅ (las suyas)     | —         | ✅ (las suyas) |

## 15. KPIs

- Ingreso previsto · devengado · cobrado · pendiente de devengar · CxC proyectada.
- Forecast de cierre (+ banda conservador/optimista) · desviación (€ y %) · % cumplimiento · run-rate.
- Margen previsto vs margen real (v1: con coste profesional directo; completo en D2).
- **Sesiones necesarias para objetivo** (lo que falta ÷ ticket devengado medio — accionable para coordinación).
- Ticket medio devengado · ingreso por canal/centro/servicio · ratio bono/suelta.
- Conversión 9AM → servicio · conversión Lidomare → servicio (cohortes de canal).

## 16. Riesgos y salvaguardas

| Riesgo                                           | Salvaguarda                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Perseguir caja y no margen                       | Cumplimiento sobre devengo; caja etiquetada aparte; D2 cruza con coste                            |
| Inflar el forecast con ventas de bonos           | La venta no devenga (10 §2); solo cuenta el consumo esperado                                      |
| No descontar cancelaciones/no-shows              | Tasas históricas obligatorias en `por_agenda_futura`                                              |
| No meter coste profesional en el margen forecast | Sesiones previstas × regla 08 + nóminas fijas                                                     |
| Usar datos clínicos                              | Solo ids y volúmenes administrativos (D-op-5)                                                     |
| Objetivos irreales que queman al equipo          | Objetivo versionado con autor; revisión periódica (D1-P8); el panel muestra objetivo vs histórico |
| No separar centro/canal/proyecto                 | Dimensiones de 09/12; cada cifra lleva su etiqueta                                                |
| Doble conteo factura + cobro                     | El real es devengo o caja, nunca factura + cobro sumados (invariante anti-doble-conteo)           |
| No versionar el presupuesto                      | Cambiar el objetivo crea versión con fecha/autor; lo publicado no se reescribe                    |
| Ajustar el forecast a mano sin traza             | `ajustado_manual` exige motivo/autor/fecha y convive con el calculado (no lo sustituye)           |

## 17. Pendientes de decisión

| #     | Pendiente                                                                             | Dueño  |
| ----- | ------------------------------------------------------------------------------------- | ------ |
| D1-P1 | Cómo se fijan los objetivos (histórico + crecimiento, capacidad de agenda, o manual)  | Guille |
| D1-P2 | ¿Objetivo por profesional? (sensible: puede tensionar al equipo)                      | Guille |
| D1-P3 | ¿Objetivo por centro? (depende de acuerdos C1-P1..P3)                                 | Guille |
| D1-P4 | ¿Objetivo por servicio?                                                               | Guille |
| D1-P5 | Método de forecast principal para el panel (propuesta: `por_agenda_futura` con banda) | Guille |
| D1-P6 | ¿El forecast incluye agenda no confirmada? (propuesta: solo en la banda optimista)    | Guille |
| D1-P7 | Umbrales de alerta del semáforo (% de desviación por dimensión)                       | Guille |
| D1-P8 | Frecuencia de revisión (propuesta: semanal operativa, mensual de dirección)           | Guille |

---

_Diseño documental de FOP-D1. No modifica código productivo, SQL, tipos ni UI. Gated por B3/A2/Reservas; requiere validación de Guille antes de abrir implementación._
