# FOP-B1 — Liquidaciones de equipo y pagos a profesionales

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Prepara la futura implementación del módulo de liquidaciones de equipo.
> **Rama:** `docs/finanzas-liquidaciones-equipo`
> **Fecha:** 2026-07-05
> **Depende de:** `05-backlog-finanzas-operativas.md` (F-Op C1/C2) y `07-sincronizacion-prs-y-modelo-operativo.md` — ambos viven hoy en la rama `docs/finanzas-modelo-operativo` (**PR #11**, aún no mergeada) — y de `06-fop-a1-efectivo-banco-arqueo.md` (FOP-A1 Tesorería) para el impacto en caja/banco.
> **Regla:** reutilizar antes de crear. Operativo/precontable: ninguna cifra de este módulo sustituye a la nómina oficial de la gestoría ni a la liquidación fiscal.
> **Datos:** nombres y reglas operativas proporcionados por Fernando (2026-07-05). Sin datos clínicos; las sesiones se referencian por identificador, nunca por contenido asistencial.

---

## 0. Nomenclatura y encaje en la serie F-Op

Fernando bautiza este módulo como **FOP-B1 — Liquidaciones de equipo y pagos profesionales**. Nota de encaje con el backlog existente (`05-backlog-finanzas-operativas.md`, PR #11):

- En ese backlog la letra **B** está asignada a _F-Op B — Rentabilidad Clínica_, y el contenido funcional de este módulo corresponde a **F-Op C2** (coste de personas: asalariados y autónomos por sesión) más el caso de **recepción compartida** de **F-Op C1** (reglas de imputación).
- **Decisión de este doc:** se mantiene el nombre de producto **FOP-B1 (Liquidaciones)** que usa negocio, y se deja constancia de que implementa C2 + parte de C1 del backlog. Cuando el PR #11 se mergee, el backlog debe reconciliar la nomenclatura (una línea en 05 y otra en 07; ver §12). **No se editan aquí los docs 05/07 para no generar conflicto con el PR #11.**

---

## 1. Problema y objetivo

### 1.1 Problema

Antifrágil paga cada mes a un equipo mixto (nóminas, autónomos por sesión, colaboradores sin regularizar) y hoy:

- no hay un sitio único que responda **"¿cuánto debemos pagar este mes y a quién?"**;
- las nóminas llegan como documento (gestoría) pero no quedan guardadas ni ligadas a la cantidad exacta que paga Antifrágil;
- los autónomos cobran por sesión, pero nadie cruza sistemáticamente **sesiones realizadas × tarifa**;
- hay al menos un flujo (Carlos) **sin documentar**, que debe aflorar como "pendiente de regularización" en vez de quedar opaco;
- el coste de recepción está **compartido con un tercero (Lidomare)** y la parte de cada empresa debe quedar explícita.

### 1.2 Objetivo

Diseñar la zona **Equipo / Liquidaciones** del OS para que cada mes exista una **liquidación por persona** con: regla de cálculo aplicada, importe exacto a pagar por Antifrágil, documento de evidencia adjunto, estado de validación y de pago, e impacto trazado en tesorería.

**Fuera de alcance de FOP-B1:** cálculo de nómina (lo hace la gestoría), contratos y RRHH legal, retenciones/modelos fiscales (solo se anotan como datos si vienen en el documento), y cualquier dato clínico.

---

## 2. Personas y casos actuales

| Persona          | Rol                           | Relación                          | Regla de cálculo                                                                | Evidencia mensual                                                 | Estado del caso                                                                                       |
| ---------------- | ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Lidia Muesa**  | Recepción                     | **Nómina compartida con tercero** | Antifrágil paga **400 €/mes fijos**; el resto de la nómina lo paga **Lidomare** | Nómina mensual (documento) + importe exacto a cargo de Antifrágil | Activo                                                                                                |
| **María Moreno** | Fisioterapeuta / coordinadora | **Nómina**                        | Importe según nómina mensual                                                    | Nómina mensual (documento) + importe exacto                       | Activo                                                                                                |
| **María Solís**  | Fisioterapeuta                | **Autónoma**                      | **30 €/sesión** realizada                                                       | Factura de la profesional + detalle de sesiones del mes           | Activo                                                                                                |
| **Cecilia**      | Fisioterapeuta                | **Autónoma**                      | **20 €/sesión** realizada                                                       | Factura de la profesional + detalle de sesiones del mes           | Activo                                                                                                |
| **Marta**        | Nutricionista                 | **Autónoma**                      | **35 €/sesión suelta**; **30 €/mes por cliente** en plan de varios meses        | Factura + detalle de sesiones y de clientes en plan               | ⚠️ **Regla de plan pendiente de confirmación exacta** (§11)                                           |
| **Carlos**       | Entrenador                    | **Pendiente de regularizar**      | **25 €/sesión** realizada                                                       | Hoy sin documento estándar                                        | 🔴 **Pendiente de regularización/documentación** — se modela explícito, nunca como flujo opaco (§4.5) |

Notas:

- Los importes son **reglas operativas**, no contratos: la fuente legal de cada nómina es el documento de la gestoría; la de cada autónomo, su factura.
- El caso Lidia es además un **coste compartido** (F-Op C1): la regla de reparto Antifrágil/Lidomare debe quedar modelada como regla explícita (400 € fijos hoy), no como apunte manual suelto.

---

## 3. Entidades conceptuales

> Conceptual, no esquema final. Nombres y campos tentativos; las columnas exactas se fijan en la fase de implementación con su migración (que **no** forma parte de este PR).

### 3.1 `profesional` (trabajador/profesional)

Persona que presta servicio y se liquida. Campos: identidad, rol operativo (recepción, fisioterapeuta, nutricionista, entrenador, coordinación), activo/baja. Se apoya en `contactos` si ya existe la persona como contacto.

### 3.2 `relacion_profesional` (relación laboral/colaboración)

La relación vigente entre Antifrágil y la persona. Una persona puede cambiar de relación en el tiempo (histórico, no sobrescritura).

| Campo                        | Para qué                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `tipo`                       | `nomina` \| `nomina_compartida` \| `autonomo` \| `colaborador` \| `pendiente_regularizar` |
| `fecha_inicio` / `fecha_fin` | vigencia                                                                                  |
| `tercero_copagador`          | solo `nomina_compartida`: quién paga el resto (Lidomare)                                  |
| `notas`                      | contexto operativo                                                                        |

### 3.3 `regla_liquidacion`

Cómo se calcula lo que Antifrágil paga. Una relación tiene una o varias reglas vigentes (Marta tiene dos). Catálogo de tipos en §4.

| Campo                | Para qué                                                         |
| -------------------- | ---------------------------------------------------------------- |
| `tipo_regla`         | ver §4                                                           |
| `importe` / `unidad` | 400 €/mes · 30 €/sesión · 30 €/mes·cliente…                      |
| `condicion`          | p. ej. "sesión suelta" vs "cliente en plan multi-mes"            |
| `vigencia`           | desde/hasta (las tarifas cambian sin borrar historia)            |
| `confirmada`         | `true` \| `false` — la regla de plan de Marta nace `false` (§11) |

### 3.4 `sesion_liquidable`

El hecho generador de coste por sesión. **Referencia** a la sesión/cita de la agenda (línea Reservas/Clínica) por identificador + fecha + profesional + tipo de servicio. **Nunca** contiene datos del paciente ni contenido asistencial; el cliente aparece solo como id/seudónimo (misma salvaguarda D-op-5 que la rentabilidad).

Estados propios: `realizada` → `validada` (por recepción/coordinación) → `liquidada` (incluida en una liquidación). Una sesión solo puede pertenecer a **una** liquidación (invariante §4.8-R3).

### 3.5 `nomina_mensual`

Registro mensual por persona con nómina: mes, importe total de la nómina (informativo), **importe a cargo de Antifrágil** (el dato operativo), y documento adjunto. Para Lidia: total según gestoría, 400 € Antifrágil, resto Lidomare (informativo).

### 3.6 `factura_profesional` (factura/recibo del autónomo)

El documento que emite el autónomo. Se apoya en el flujo existente de `facturas_recibidas` (que ya maneja retención IRPF y pagos): la factura del profesional **es** una factura recibida, etiquetada como coste de personal y ligada a su liquidación. No se inventa un flujo paralelo de facturas.

### 3.7 `liquidacion_mensual`

La entidad central: **persona × mes**. Agrega el cálculo (según reglas), el importe final, los ajustes manuales, el documento de evidencia, el estado (§5) y el enlace al pago.

| Campo                | Para qué                                      |
| -------------------- | --------------------------------------------- |
| `profesional`, `mes` | clave                                         |
| `importe_calculado`  | resultado de aplicar reglas a sesiones/nómina |
| `ajustes`            | apuntes manuales trazados (§4.6)              |
| `importe_final`      | calculado + ajustes                           |
| `estado`             | ciclo de §5                                   |
| `evidencias`         | nómina / factura / recibo vinculados          |
| `incidencias`        | motivo de bloqueo si lo hay                   |

### 3.8 `pago_liquidacion`

El pago (total o parcial) de una liquidación: fecha, importe, **medio** (transferencia, efectivo, bizum…) y **cuenta de tesorería** de origen (banco o caja), siguiendo el modelo FOP-A1 (§9). Append-only: las correcciones son pagos/apuntes nuevos, no ediciones.

### 3.9 `documento_adjunto` (privado)

Nóminas, facturas y recibos como archivos adjuntos **privados**: visibles solo para CEO (todo) y para el propio profesional (los suyos). Una nómina es dato personal — nunca visible para otros roles ni referenciada en vistas globales (§7, §10).

### 3.10 Relación entre entidades

```
profesional ──► relacion_profesional ──► regla_liquidacion (1..n)
                                              │
agenda/citas ──► sesion_liquidable ───────────┤ (solo relaciones por sesión)
gestoría ─────► nomina_mensual ───────────────┤ (solo relaciones con nómina)
                                              ▼
                                   liquidacion_mensual (persona × mes)
                                              │
autónomo ──► factura_profesional ──(evidencia)┤
                                              ▼
                                   pago_liquidacion ──► movimiento de tesorería (FOP-A1)
                                              │
                                   documento_adjunto (privado)
```

---

## 4. Reglas de liquidación (catálogo)

### 4.1 `nomina_fija`

Importe fijo mensual a cargo de Antifrágil, con nómina como evidencia. **Caso: María Moreno** (el importe exacto lo fija la nómina de cada mes; el OS guarda documento + cantidad).

### 4.2 `nomina_compartida`

Como 4.1, pero Antifrágil paga solo **su parte fija** y un tercero paga el resto. La liquidación de Antifrágil es su parte (400 €); el total de la nómina queda como dato informativo para cuadre. **Caso: Lidia Muesa (Antifrágil 400 €/mes, resto Lidomare).** Es también una regla de imputación de coste compartido (F-Op C1): si el acuerdo cambiara a "%", la entidad `regla_liquidacion` lo soporta sin rediseño.

### 4.3 `por_sesion`

`importe_final = nº sesiones validadas del mes × tarifa`. **Casos: María Solís (30 €), Cecilia (20 €), Carlos (25 €, con la salvedad de 4.5), Marta en sesión suelta (35 €).** Requiere que las sesiones estén **validadas** (§6) antes de calcular.

### 4.4 `mensual_por_plan`

`importe = nº clientes activos en plan multi-mes × 30 €/mes`. **Caso: Marta.** ⚠️ **Regla pendiente de confirmación exacta** (§11): qué cuenta como "cliente activo" (¿mes natural completo?, ¿prorrateo de altas/bajas a mitad de mes?, ¿compatibilidad con sesiones sueltas del mismo cliente?). Hasta confirmarse, la regla existe con `confirmada = false` y las liquidaciones que la usen **no pueden pasar de `calculada`** sin revisión manual del CEO.

### 4.5 `pendiente_regularizar`

Regla explícita para relaciones aún sin encaje documental. El cálculo se hace igual (Carlos: 25 €/sesión) y la deuda **aflora en la liquidación mensual**, pero la liquidación queda **`bloqueada_por_incidencia`** con motivo `relacion_sin_regularizar` hasta que exista relación documentada (alta como autónomo con factura, u otra fórmula que decida Fernando con la gestoría). Principio: **el OS nunca oculta un pago real; lo muestra como pendiente de regularización.** Ningún flujo opaco.

### 4.6 `ajuste_manual`

Apunte con signo sobre una liquidación (corrección de sesiones mal contadas, anticipo, compensación). Siempre con motivo, autor y fecha; nunca editando el cálculo. El `importe_final = importe_calculado + Σ ajustes`.

### 4.7 `bonus_descuento` (futuro)

Reservado para bonus por objetivos o descuentos pactados. No se implementa en B1; el modelo lo soporta como tipo adicional de regla/ajuste para no rediseñar.

### 4.8 Invariantes

- **R1.** Toda liquidación referencia la **regla vigente** con la que se calculó (si la tarifa cambia, las liquidaciones antiguas no cambian).
- **R2.** Ninguna liquidación se **valida** sin su evidencia: nómina (relaciones con nómina) o factura/recibo (autónomos).
- **R3.** Una `sesion_liquidable` pertenece como máximo a **una** liquidación (sin doble pago).
- **R4.** Reglas no confirmadas o relaciones sin regularizar **bloquean** el avance del ciclo, no lo esconden.
- **R5.** Todo pago referencia su liquidación y genera movimiento de tesorería (§9). No hay pagos "sueltos" a profesionales fuera del módulo.

---

## 5. Ciclo de vida y estados de la liquidación

```
pendiente_calculo ──► calculada ──► pendiente_documento ──► validada ──► pendiente_pago ──► pagada ──► revisada
        │                 │                  │                  │               │
        └────────────── bloqueada_por_incidencia (transversal, con motivo y vuelta al estado previo) ──────┘
```

| Estado                     | Significado                                                                                          | Quién lo mueve                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pendiente_calculo`        | Mes abierto; faltan sesiones por validar o nómina por llegar                                         | sistema                                                          |
| `calculada`                | Reglas aplicadas; importe calculado disponible                                                       | sistema / coordinadora                                           |
| `pendiente_documento`      | Falta la evidencia (nómina no subida, factura no recibida)                                           | sistema                                                          |
| `validada`                 | Importe y evidencia cuadran; listo para pagar                                                        | CEO (nóminas y total) / coordinadora (parte operativa: sesiones) |
| `pendiente_pago`           | Aprobada y en cola de pago                                                                           | CEO                                                              |
| `pagada`                   | Pago registrado con medio y cuenta de tesorería                                                      | CEO                                                              |
| `revisada`                 | Cierre de mes: revisada contra extracto/arqueo                                                       | CEO                                                              |
| `bloqueada_por_incidencia` | Discrepancia (sesiones disputadas, importe no cuadra, relación sin regularizar, regla sin confirmar) | cualquiera detecta; CEO desbloquea                               |

Reglas de transición: no se llega a `validada` sin evidencia (R2); las liquidaciones con regla 4.4 sin confirmar o relación 4.5 quedan bloqueadas antes de `validada` (R4); `pagada` exige al menos un `pago_liquidacion` que cubra el `importe_final` (los parciales mantienen `pendiente_pago` con el pendiente visible).

---

## 6. Cómo se valida y cómo se paga (ciclo mensual)

1. **Durante el mes** — recepción/coordinación validan asistencia y cobro de cada sesión en agenda (la sesión pasa a `validada`). Esto ya es parte del flujo de Reservas; B1 solo lo consume.
2. **Cierre de mes (día 1-5)** — el sistema genera las liquidaciones del mes: por sesión (recuento × tarifa), por nómina (a la espera del documento de la gestoría), por plan (recuento de clientes activos, si la regla está confirmada).
3. **Evidencias** — se sube la nómina de Lidia y María Moreno (documento privado + importe exacto Antifrágil); los autónomos remiten factura, que entra por el flujo de facturas recibidas y se liga a su liquidación. Cruce automático: ¿la factura de María Solís coincide con sesiones × 30 €? Si no cuadra → `bloqueada_por_incidencia`.
4. **Validación** — coordinadora confirma la parte operativa (sesiones); CEO valida importes finales y nóminas.
5. **Pago** — CEO ejecuta pagos (normalmente transferencia bancaria; excepcionalmente caja, siempre trazado) y los registra con medio + cuenta (§9).
6. **Revisión** — al conciliar extracto/arqueo, la liquidación pasa a `revisada`. Lo no documentado permanece como pendiente de regularizar — nunca desaparece en silencio.

---

## 7. Permisos y visibilidad por rol

| Capacidad                                                | CEO | Coordinadora                                                | Trabajador/profesional | Recepción                     |
| -------------------------------------------------------- | --- | ----------------------------------------------------------- | ---------------------- | ----------------------------- |
| Ver todas las liquidaciones e importes                   | ✅  | ❌                                                          | ❌                     | ❌                            |
| Ver sesiones realizadas y validaciones (parte operativa) | ✅  | ✅                                                          | solo las suyas         | ✅ (validar asistencia/cobro) |
| Ver nóminas (documentos)                                 | ✅  | ❌ (ni la suya propia por este rol: la ve como trabajadora) | solo la suya           | ❌                            |
| Ver su propia liquidación y sus sesiones                 | ✅  | ✅ (la suya)                                                | ✅ (la suya)           | ✅ (la suya)                  |
| Validar liquidación / mover a pago / pagar               | ✅  | ❌                                                          | ❌                     | ❌                            |
| Validar asistencia/cobro de sesiones                     | ✅  | ✅                                                          | ❌                     | ✅                            |
| Ajustes manuales                                         | ✅  | proponer (aprueba CEO)                                      | ❌                     | ❌                            |

Principios: los **importes de nómina son dato personal** — solo CEO y el interesado; la coordinadora ve **operativa** (sesiones, validaciones), no retribuciones de terceros; recepción valida hechos (asistencia/cobro) sin ver nóminas ni pagos globales. María Moreno acumula dos roles (profesional + coordinadora): ve su liquidación como profesional y la operativa como coordinadora, **no** los importes de los demás.

---

## 8. Relación con sesiones, facturación y rentabilidad

- **Una sesión de agenda tiene dos caras económicas:** genera **ingreso** (cobro al cliente / consumo de bono — línea facturación/cobros) y puede generar **coste profesional** (esta línea, si la relación es por sesión).
- **La liquidación profesional NO es la factura emitida al cliente.** La factura/cobro al cliente es ingreso (doc 02, PR #1); la liquidación es coste. Comparten el hecho generador (la sesión) pero son documentos, flujos y estados distintos.
- **Rentabilidad (F-Op B del backlog):** el margen por sesión/servicio/profesional sale de cruzar `ingreso de la sesión − coste profesional de la sesión` (+ imputación de fijos según C1). FOP-B1 aporta la pata de coste con devengo correcto: el coste se imputa al **mes de la sesión**, aunque se pague al mes siguiente.
- **Costes de nómina** (Lidia 400 €, María Moreno) entran en rentabilidad como **coste fijo mensual** imputado, no por sesión.

## 9. Relación con tesorería (FOP-A1)

- **Pagar una liquidación genera un movimiento de tesorería** con `origen_tipo = 'pago_liquidacion'` + `origen_id`, sobre una `cuenta_tesoreria` (modelo FOP-A1, draft SQL en PR #4 — **NO APPLY**, nada de esto se implementa aquí).
- **Nómina/transferencia** → cuenta tipo `banco` (el movimiento se conciliará con el extracto importado).
- **Pago en caja** (excepcional) → cuenta tipo `caja`, medio `efectivo`, y entra en el arqueo del día. Siempre trazado.
- **Pago sin documento** → no se registra como movimiento "normal": la liquidación queda `bloqueada_por_incidencia` / relación `pendiente_regularizar`, y el pago (si ocurrió) se anota con marca explícita de **pendiente de regularizar/documentar** para que el descuadre sea visible, no invisible.
- **CxP:** entre `validada` y `pagada`, la liquidación es una **cuenta por pagar** más y debe aparecer en la vista CxP de F-Op A2 (pendientes de pago con responsable y estado).

---

## 10. Privacidad y documentos

- Nóminas, facturas y recibos se almacenan como **documentos adjuntos privados** con control de acceso por rol (§7). Futuro storage con RLS estricta; **jamás** en el repo.
- Este diseño usa nombres y reglas operativas autorizadas por Fernando. **No incluye** DNIs, IBANs, salarios totales, ni ningún dato clínico. Las sesiones se referencian por id; el cliente, por id/seudónimo.
- Los importes de liquidación son confidenciales a nivel de fila: la implementación futura exigirá RLS por persona (cada profesional ve solo lo suyo).

---

## 11. Pendientes de confirmación y fuera de alcance

| #     | Pendiente                                                                                                                          | Dueño               | Efecto mientras tanto                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| B1-P1 | **Regla de plan de Marta** (30 €/mes·cliente): definición exacta de "cliente activo", prorrateos, convivencia con sesiones sueltas | Fernando + Marta    | Regla `confirmada = false`; sus liquidaciones no pasan de `calculada` sin revisión del CEO |
| B1-P2 | **Regularización de Carlos**: fórmula documental (autónomo con factura u otra)                                                     | Fernando + gestoría | Relación `pendiente_regularizar`; liquidaciones calculadas pero bloqueadas; deuda visible  |
| B1-P3 | **Acuerdo Lidia/Lidomare**: ¿existe documento del reparto 400 €/resto? Conviene evidenciarlo                                       | Fernando            | Regla operativa vigente (400 € fijos); anotar evidencia cuando exista                      |
| B1-P4 | **Medio de pago habitual por persona** (transferencia/bizum/efectivo)                                                              | Fernando            | El modelo lo soporta todos; se fijará el defecto por persona al implementar                |
| B1-P5 | Retenciones IRPF de facturas de autónomos: ya las soporta `facturas_recibidas`; confirmar tratamiento en el resumen para gestoría  | gestoría            | Sin efecto en B1 (dato informativo del documento)                                          |

**Fuera de alcance:** emisión de nóminas, contratos, altas/bajas SS, fiscalidad (gestoría); automatismos de pago (el pago se registra, no se ejecuta desde el OS en B1); bonus/objetivos (§4.7).

---

## 12. Sincronización con PRs y docs (notas de dependencia — sin editar otros PRs)

Para evitar conflictos con PRs abiertos, este PR **solo añade este archivo**. Cambios que deben hacerse en otros documentos **después** de sus merges:

| Doc a tocar                                                   | Vive en | Cambio pendiente                                                                                                                                                                     |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/finanzas/05-backlog-finanzas-operativas.md`             | PR #11  | Añadir en F-Op C2 la nota: "diseño funcional en [08-liquidaciones...](08-liquidaciones-equipo-y-profesionales.md) (FOP-B1, nombre de producto)"; reconciliar nomenclatura B1↔C2 (§0) |
| `docs/finanzas/07-sincronizacion-prs-y-modelo-operativo.md`   | PR #11  | Añadir esta línea de trabajo a la tabla de líneas (rama `docs/finanzas-liquidaciones-equipo`)                                                                                        |
| `docs/integration/01-orden-prs.md` / `05-registro-riesgos.md` | PR #10  | Añadir este PR al orden (bloque "finanzas docs", sin dependencias duras de merge; dependencia **conceptual** de #11 y #4)                                                            |
| `docs/finanzas/02-diseno-facturacion-emitida.md`              | PR #1   | Referencia cruzada opcional: sesión = ingreso (02) + coste (08)                                                                                                                      |

Dependencias conceptuales (no de merge): **PR #11** (serie F-Op y backlog), **PR #4** (modelo de tesorería A1, NO APPLY), **PR #5/línea Reservas** (las sesiones/citas que alimentan `sesion_liquidable`). Este doc no exige ningún orden de merge concreto: es archivo nuevo sin colisiones.

---

## 13. Criterio de "hecho" (para la futura implementación, no para este PR)

- [ ] Existe la zona Equipo/Liquidaciones con la lista de personas, su relación y su regla vigente.
- [ ] Cada mes se genera una liquidación por persona con importe calculado según su regla.
- [ ] Nóminas y facturas quedan adjuntas como documentos privados, con el importe exacto a cargo de Antifrágil.
- [ ] Las sesiones validadas en agenda alimentan las liquidaciones por sesión sin doble conteo (R3).
- [ ] Los estados del ciclo (§5) funcionan, incluidos bloqueos por incidencia y pendientes de regularización visibles.
- [ ] Cada pago registrado genera su movimiento de tesorería (banco o caja) trazado.
- [ ] La visibilidad por rol respeta §7 (nóminas solo CEO + interesado).
- [ ] Los pendientes B1-P1 y B1-P2 están resueltos o siguen explícitamente bloqueando.

---

_Diseño documental de FOP-B1. No modifica código productivo, SQL, tipos ni UI. Requiere validación de Fernando antes de abrir implementación._
