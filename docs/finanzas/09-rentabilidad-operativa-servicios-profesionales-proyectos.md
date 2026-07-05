# FOP-B2 — Rentabilidad operativa: sesión, profesional, servicio, canal, proyecto y centro

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Prepara la futura implementación de la capa de rentabilidad operativa (F-Op B del backlog).
> **Rama:** `docs/finanzas-rentabilidad-operativa`
> **Fecha:** 2026-07-05
> **Depende de:** `04-finanzas-operativas-mapa-y-gaps.md` y `05-backlog-finanzas-operativas.md` (F-Op B, lente 2) — PR #11 —, `02-diseno-facturacion-emitida.md` (ingreso documental y cobros, PR #1) y `08-liquidaciones-equipo-y-profesionales.md` (coste profesional, PR #13). Conceptualmente también de FOP-A1 (`06`, tesorería) y de la línea Clínica/Reservas (sesiones).
> **Regla:** reutilizar antes de crear. Esta capa es **de gestión, no fiscal**: ninguna cifra sustituye a la contabilidad oficial de la gestoría (D-op-6). Se calcula por **devengo** (fecha de prestación), nunca por fecha de cobro (D-op-2).
> **Datos:** tarifas y reglas operativas ya documentadas en los docs 02 y 08. Sin datos clínicos; el cliente aparece solo como id/seudónimo (D-op-5).

---

## 0. Nomenclatura y encaje en la serie F-Op

Nombre de producto: **FOP-B2 — Rentabilidad operativa**. Encaje con el backlog (`05-backlog-finanzas-operativas.md`, PR #11):

- Implementa **F-Op B — Rentabilidad Clínica** del backlog, generalizada a "rentabilidad operativa" porque el eje ya no es solo la Clínica: entran **canal** y **centro** como dimensiones nuevas (§6), y el modelo es multi-proyecto (doc 01 §6).
- Continúa la serie de producto iniciada en el doc 08: **FOP-B1** (Liquidaciones) implementó C2 + parte de C1 del backlog; **FOP-B2** implementa la letra B. La colisión de letras producto↔backlog ya quedó documentada en 08 §0; cuando el PR #11 se mergee, el backlog reconcilia ambas nomenclaturas (una línea en 05 y otra en 07; ver §14).
- Sigue **gated** como en el backlog: el margen por sesión necesita las sesiones de la línea Clínica/Reservas. Aquí se diseña completo para implementarlo cuando exista el dato.

---

## 1. Problema y objetivo

### 1.1 Problema

Hoy el OS (heredado + drafts) sabe cuánto entra y sale por proyecto, pero **no sabe qué deja cada cosa**:

- solo existe margen **por proyecto** (`metricas_proyecto_resumen.saldo_neto_real`), sin desagregar por servicio, profesional, canal ni centro;
- el ingreso de un bono entra entero el día del cobro y **no se reparte** entre las sesiones que lo consumen;
- el coste profesional no se cruza con el ingreso de la misma sesión (FOP-B1 lo calcula para pagar, no para medir margen);
- no hay forma de responder si Lidomare, Vivofácil u Oasis **compensan** frente a la clínica propia, ni qué canal trae clientes que dejan margen.

### 1.2 Objetivo

Que el OS responda, con datos y por devengo, a las preguntas de dirección:

| Pregunta                                                                            | Nivel que la responde (§5) |
| ----------------------------------------------------------------------------------- | -------------------------- |
| ¿Cuánto ganamos realmente por una sesión?                                           | Sesión (5.1)               |
| ¿Qué profesional es rentable? ¿Qué parte del coste es nómina y qué parte autónomos? | Profesional (5.2)          |
| ¿Qué servicio deja más margen?                                                      | Servicio (5.3)             |
| ¿Qué canal trae clientes rentables?                                                 | Canal (5.4)                |
| ¿Qué proyecto funciona?                                                             | Proyecto (5.5)             |
| ¿Qué margen deja Lidomare vs clínica propia? ¿Y Vivofácil?                          | Centro (5.6)               |
| ¿Qué clientes/programas son rentables?                                              | Cliente/programa (5.7)     |

**Fuera de alcance de FOP-B2:** contabilidad fiscal y cierre (gestoría), la lente de inversión (TIR/VAN — no aplica a proyectos operativos, doc 01 §6), presupuesto vs real (F-Op D, capa posterior que consumirá estas cifras), y cualquier dato clínico.

---

## 2. Qué conecta (fuentes, todas ya diseñadas)

La rentabilidad **no crea hechos nuevos**: cruza los que otras líneas ya registran. Cada pieza aporta una cara del mismo hecho (la sesión):

```
Reservas/agenda ──► sesión realizada+validada (fecha de prestación, servicio,
      │             profesional, cliente-id, proyecto, centro, medio de cobro)
      │
      ├─ cara INGRESO:  cobro / bono / programa / prefactura   (doc 02, PR #1; tesorería FOP-A1, doc 06/PR #4)
      │                 └─► ingreso DEVENGADO por sesión (§4.1)
      │
      └─ cara COSTE:    liquidaciones FOP-B1 (doc 08, PR #13)
                        ├─► coste directo profesional por sesión (autónomos)
                        └─► coste fijo mensual (nóminas: María Moreno; parte Antifrágil
                             de nóminas compartidas: Lidia 400 €) + reglas C1 (compartidos)
                                      │
                                      ▼
                          margen por sesión ──agrega──► profesional · servicio · canal
                                                        · centro · proyecto · cliente
```

- **Reservas/citas:** la sesión validada es el hecho generador (misma `sesion_liquidable` de 08 §3.4, leída ahora por su cara de ingreso además de la de coste).
- **Cobros y facturación operativa:** el cobro dice cuánto entró y por qué medio (doc 02 §7, libro de cobros); la rentabilidad **no** usa la fecha de cobro sino la de prestación.
- **Liquidaciones/nóminas (FOP-B1):** aportan el coste de personas con devengo correcto (08 §8): el coste se imputa al mes de la sesión aunque se pague al mes siguiente.
- **Tesorería (FOP-A1):** no participa en el cálculo (caja ≠ margen), pero la comisión del datáfono sí es coste directo del cobro (§4.2).
- **Proyectos/servicios/canales/centros:** dimensiones de agregación (§6).

**Invariante anti-doble-conteo (doc 04 §2):** un ingreso entra una vez en caja, se documenta una vez en factura y se reconoce **progresivamente** en rentabilidad. Tres lecturas, un hecho.

---

## 3. Principios de cálculo

1. **Devengo estricto (D-op-2).** La fecha que manda es la de **prestación**. Un bono cobrado en junio con sesiones en julio es margen de julio.
2. **Margen de contribución primero (D-op-7).** Los costes directos se restan donde se generan; los generales/estructura se restan al resultado del proyecto o global, **sin reparto artificial** por defecto.
3. **Coste real, no estándar.** El coste profesional de una sesión es el de la **regla de liquidación vigente** de ese profesional (08 §4), no una media. Si la tarifa cambia, el margen histórico no cambia (invariante R1 de 08).
4. **Capa de gestión (D-op-6).** Estas cifras orientan decisiones; no alimentan al fisco ni sustituyen a la gestoría.
5. **Privacidad (D-op-5).** Las dimensiones finas viven en `clinica` y agregan hacia arriba por `proyecto_id_ref`. El cliente entra solo como **id/seudónimo**; ningún dato personal ni clínico sube a la capa global ni aparece en paneles.
6. **Nada se oculta.** Sesiones con coste y sin ingreso (no-show sin cobrar, cortesías), o con ingreso y sin coste, aparecen con su margen real — igual que FOP-B1 no oculta pagos sin regularizar.

---

## 4. La escalera de márgenes (definiciones)

Cuatro peldaños, del más fino al más agregado. Cada nivel de §5 se lee en el peldaño que le corresponde.

| #   | Peldaño                                  | Fórmula                                                                                                                          | Se calcula a nivel de   |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| M1  | **Margen bruto de sesión**               | ingreso devengado de la sesión − coste profesional de la sesión                                                                  | sesión                  |
| M2  | **Margen de contribución**               | M1 − otros costes directos imputables (comisión datáfono, material de la sesión, coste de sala/centro si es variable)            | sesión / servicio       |
| M3  | **Margen operativo del proyecto/centro** | Σ M2 − costes fijos imputados del periodo (nóminas, parte Antifrágil de compartidas, alquiler del centro, software del proyecto) | proyecto · centro · mes |
| M4  | **Resultado operativo global**           | Σ M3 de todos los proyectos − costes generales de estructura                                                                     | Antifrágil · mes        |

### 4.1 Ingreso devengado por sesión

- **Sesión suelta:** el precio de catálogo cobrado (Clínica hoy sin IVA, D2 del doc 02: el precio final **es** el ingreso; si la gestoría convirtiera algún servicio en sujeto, el ingreso analítico pasaría a ser la base sin IVA — el modelo debe leer el desglose de la factura/cobro, no repetir el precio de catálogo).
- **Bono/programa:** el importe cobrado se reparte entre sus sesiones **a medida que se consumen**. Criterio de reparto ⚠️ pendiente (B2-P1, hereda F-7 del doc 04): lineal (225 € / 5 = 45 €/sesión) vs por tarifa de cada sesión. **Recomendado: lineal** por simplicidad, salvo bonos mixtos. La caducidad de un bono no consumido devenga el resto como ingreso en el mes de caducidad (regla a confirmar en B2-P1).
- **Plan mensual (nutrición de Marta):** la cuota del cliente se devenga en el mes del plan; su coste es la regla `mensual_por_plan` de 08 §4.4.
- **Descuentos y tarifas** (Founder/VIP/UG): el ingreso devengado es el **precio realmente cobrado**, no el de catálogo. El descuento no se modela como coste; simplemente reduce ingreso (y el panel por tarifa lo hace visible).
- **Sesión sin ingreso** (cortesía, garantía, no-show no cobrado): ingreso 0. El coste, si lo hay, la hace deficitaria — visible, no filtrada.

### 4.2 Costes por capa (alineado con doc 04 §4.3 y FOP-B1)

- **Directo por sesión:** coste del profesional según su regla de liquidación (por_sesion de 08 §4.3) + material específico + **comisión del medio de cobro** (datáfono ~1-2 %; efectivo/bizum/transferencia 0). Solo para relaciones por sesión.
- **Fijo mensual de personas:** nóminas (María Moreno) y parte Antifrágil de nóminas compartidas (Lidia 400 €/mes) entran como coste fijo del proyecto/centro en el mes del servicio (08 §8), **no** repartidas por sesión en M1.
- **Compartido:** recepción, software, suministros → regla de imputación C1 (% fijo o driver). Mientras C1 no esté implementado, quedan como fijos del proyecto.
- **General/estructura:** administración, gestoría, seguros globales → al resultado global (M4), sin prorrateo por defecto (F-4/D-op-7).

> **Métrica derivada (no reparto):** para comparar personas con relación distinta, el panel por profesional muestra el **coste efectivo por sesión** = coste fijo mensual / sesiones del mes (§5.2). Es una lectura, no una imputación: no altera M1 ni M2.

### 4.3 Fórmula base (común a todos los niveles)

```text
margen operativo = ingresos devengados (o cobrados, según vista §4.4)
                 − costes directos   (profesional por sesión, material, comisiones)
                 − costes asignados  (fijos del proyecto/centro; compartidos vía C1)
```

Tres distinciones que el modelo **nunca** mezcla:

- **Ingreso devengado ≠ ingreso cobrado.** Una sesión realizada puede no estar cobrada (CxC); un bono cobrado entero aún no está devengado.
- **Coste devengado ≠ coste pagado.** La sesión de la autónoma es coste del mes de la sesión aunque su liquidación se pague al mes siguiente (08 §8).
- **Margen bruto ≠ beneficio neto.** M1/M2 no incluyen fijos ni generales; M4 es resultado operativo de gestión, no resultado fiscal (D-op-6).

### 4.4 Dos vistas: devengo y caja

| Vista                   | Qué cuenta                                                                               | Para qué sirve                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Devengo** (principal) | Lo realizado en el periodo, cobrado o no; los costes del mes aunque no estén pagados     | Medir el margen real de operar (todos los niveles de §5 se leen aquí por defecto)                                                 |
| **Caja** (control)      | Lo efectivamente cobrado y pagado en el periodo (libro de cobros + pagos de liquidación) | Contraste con tesorería FOP-A1; detectar desfases: mucho margen devengado con poca caja = CxC creciendo o liquidaciones atrasadas |

Las dos vistas se muestran **etiquetadas y por separado**, nunca sumadas (invariante anti-doble-conteo). La vista caja no sustituye a la tesorería: es la misma rentabilidad releída por fecha de cobro/pago.

---

## 5. Niveles de rentabilidad

### 5.1 Por sesión

La unidad atómica. Ejemplo canónico (tarifas reales de docs 02 y 08):

```text
Sesión de fisioterapia suelta atendida por María Solís (autónoma, 30 €/sesión):

  Ingreso cliente:            55 €
  Coste profesional:         −30 €
  ───────────────────────────────
  M1 Margen bruto sesión:     25 €   (45,5 % del ingreso)

  Comisión datáfono (1,5 %): −0,83 €
  ───────────────────────────────
  M2 Margen contribución:     24,17 €
```

La misma sesión dentro de un **programa de 5 sesiones (225 €)** devenga 45 €/sesión → M1 = 15 €. El mismo servicio con **Cecilia (20 €/sesión)** → M1 = 25 € sobre 45 € devengados. El panel por sesión existe para auditar casos concretos; la gestión diaria se hace en los niveles agregados.

**Ficha económica de la sesión** (lo que el panel muestra por sesión):

| Campo                     | Fuente                                | Ejemplo                       |
| ------------------------- | ------------------------------------- | ----------------------------- |
| Ingreso previsto          | tarifa/catálogo de la cita            | 55 €                          |
| Ingreso devengado         | §4.1 (suelta, o porción de bono/plan) | 55 € / 45 €                   |
| Ingreso cobrado           | libro de cobros (doc 02 §7)           | 55 € · 0 € si pendiente       |
| Estado de cobro           | CxC operativo (F-Op A2)               | cobrada · pendiente · parcial |
| Coste profesional directo | regla de liquidación vigente (08 §4)  | 30 €                          |
| Estado de liquidación     | ciclo FOP-B1 (08 §5)                  | pendiente_calculo … pagada    |
| Margen bruto M1           | devengado − coste directo             | 25 €                          |

Los estados de cobro y liquidación **no cambian el margen devengado**: cambian su lectura en la vista caja (§4.4) y su fiabilidad (una sesión sin validar no entra; una liquidación bloqueada marca el margen como provisional).

### 5.2 Por profesional

Σ de sus sesiones del periodo + su coste fijo si su relación es de nómina. Las **cuatro relaciones** de FOP-B1 (08 §3.2) se leen distinto:

- **Autónomos por sesión (María Solís 30 €, Cecilia 20 €, Marta 35 €/suelta o 30 €/mes·cliente en plan):** margen = Σ ingresos devengados de sus sesiones − Σ coste por sesión (su liquidación FOP-B1). Directamente comparable con lo que se le paga. Ejemplo de mes tipo:

```text
María Solís (autónoma, 30 €/sesión), mes tipo:
  Ingresos devengados por sus sesiones:  40 sesiones ≈ 2.000 €  (mix sueltas 55 € y bonos 45 €)
  Coste liquidado (FOP-B1):              40 × 30 € = 1.200 €
  ────────────────────────────────────────────────
  Margen bruto antes de indirectos:        800 €
```

- **Colaborador con regla pendiente (Carlos, 25 €/sesión):** su coste se devenga igual con la regla provisional y su margen se marca **provisional** mientras la relación siga `pendiente_regularizar` (08 §4.5). Nunca margen "sin coste" por falta de papeles.
- **Profesional compartido con tercero (Lidia, recepción — 400 €/mes parte Antifrágil, resto Lidomare):** no genera sesiones con ingreso; su parte Antifrágil es coste fijo/compartido que entra en M3 del proyecto/centro vía regla C1, no en el margen de ningún profesional asistencial.
- **Nómina (María Moreno):** sus sesiones aportan M1 = ingreso completo (coste directo 0); su nómina entra como fijo en M3. Para leer su rentabilidad individual: margen aportado = Σ ingresos de sus sesiones − nómina del mes; y coste efectivo por sesión = nómina / nº sesiones (si además coordina, parte de su coste es estructura — ⚠️ B2-P6).
- **Respuesta a "¿qué parte del coste viene de nóminas y qué parte de autónomos?":** el panel de coste de personas separa por `tipo` de relación (08 §3.2): Σ nóminas + parte compartida vs Σ liquidaciones por sesión, por mes y por proyecto/centro.
- Un profesional con margen bajo no es automáticamente "no rentable": puede estar en un centro con peor acuerdo o atender más bonos que sesiones sueltas. El panel debe permitir cruzar profesional × servicio × centro antes de concluir.

### 5.3 Por servicio

Σ de sesiones del servicio (catálogo de la Clínica: fisioterapia —sin subtipo deportivo, es el mismo servicio—, nutrición, entrenamiento personal; futuro: los de otros proyectos).

- KPIs: ingreso devengado, coste directo, M1/M2 absolutos y en %, nº sesiones, **ticket devengado medio**, mix sesión suelta vs bono vs plan.
- Responde "¿qué servicio deja más margen?" en dos lecturas que el panel separa: **margen unitario** (€/sesión) y **margen total** (€/mes) — un servicio de margen unitario alto y poco volumen puede dejar menos que uno mediano con mucho volumen.
- El tratamiento fiscal futuro por servicio (doc 02 §4) no cambia esta capa: si entrenamiento pasara a llevar IVA incluido en el precio, su ingreso devengado baja a la base (55 € → 45,45 €) y su margen real se lee igual.

### 5.4 Por canal

**Dimensión nueva en la serie.** El canal es **cómo llegó el cliente** (captación): recomendación, Instagram/redes, Google/web, partner B2B (Vivofácil, seguros, empresas), walk-in del centro (Lidomare/Oasis), campaña concreta.

- **Catálogo inicial propuesto (⚠️ B2-P5):** `orgánico/walk-in` · `recomendación` · `campaña` (Instagram/Google/otras, una etiqueta por campaña) · `partner B2B` (Vivofácil, seguros, empresas) · `derivación de centro` (Lidomare, Oasis) · `9AM` (cruce entre proyectos propios).
- **Atribución:** el canal se asigna al **cliente** en su alta (primer contacto) y hereda a todas sus compras; opcionalmente una venta puntual puede llevar canal propio (una campaña que reactiva a un cliente antiguo). Regla simple primero: **último canal antes del alta**; nada de modelos multi-touch en v1.
- **Margen por canal** = Σ margen de contribución de los clientes atribuidos al canal en el periodo. Como el cliente es id/seudónimo (D-op-5), el panel por canal es agregado y no expone identidades.
- Responde "¿qué canal trae clientes rentables?" mirando margen **acumulado por cliente** (no solo la primera compra): un canal que trae bonos recurrentes vale más que uno de sesiones sueltas aunque el ticket inicial sea igual.
- **Coste de captación (CAC):** fuera de v1. Cuando exista gasto de marketing etiquetado por canal (recibidas con `categoria_analitica`), el panel restará CAC al margen del canal. El modelo lo prevé; no se implementa aún.
- ⚠️ B2-P5: catálogo inicial de canales y quién lo mantiene.

### 5.5 Por proyecto

El nivel que **ya existe** (`metricas_proyecto_resumen`) y se mejora: hoy es ingreso real − gasto real (caja); pasa a leerse **por devengo** con la escalera M1→M3.

- Proyectos según doc 01 §2/§6: **Clínica Antifrágil Playamar** (activo), **9AM/Eventos** (siguiente, diferido), Lido Pro y Antifrágil OG (diferidos). Multi-proyecto genuino: nada hardcodeado a la Clínica.
- **La lista de proyectos la decide negocio, no este doc.** Candidatos que el modelo soporta con un simple alta en `proyectos` (sin rediseño): "Lidomare x Antifrágil" o "Vivofácil" si dejan de ser centros y adquieren P&L propio (B2-P2), "9AM Club", un "Proyecto digital" (programas/venta online), o elevar un servicio (nutrición, entrenamiento) a proyecto si se gestiona como línea independiente.
- M3 del proyecto = Σ M2 de sus sesiones/ventas − fijos imputados del proyecto (nóminas, alquiler, software, parte Antifrágil de compartidos vía C1).
- El resultado global M4 (Antifrágil = la SL, doc 01) = Σ M3 − generales. Es la cifra "¿ganamos dinero operando?" — siempre etiquetada como operativa, no fiscal.

### 5.6 Por centro

**Dimensión nueva en la serie.** El **centro** es el lugar/acuerdo operativo donde se presta la sesión: **Antifrágil Playamar** (clínica propia), **Lidomare**, **Vivofácil**, **Oasis**, y **9AM si aplica** (9AM es proyecto según doc 01; si además funciona como espacio donde la Clínica presta sesiones, existe también como centro — ambas cosas no se excluyen).

- **Centro ≠ proyecto.** Decisión de este doc (⚠️ validar, B2-P2): los centros arrancan como **dimensión del proyecto Clínica**, no como proyectos propios. Si un centro adquiere P&L propio (equipo, alquiler y catálogo propios), se eleva a proyecto dándolo de alta en `proyectos` — el modelo lo permite sin rediseño.
- Cada centro puede tener **economía distinta**, y ahí está el valor de la dimensión: tarifa distinta, coste de espacio distinto (alquiler propio en Playamar; cesión/%/renta en los demás — ⚠️ acuerdos por confirmar, B2-P3), costes compartidos distintos (la recepción de Lidia es compartida precisamente con **Lidomare**, 08 §4.2 — su regla C1 imputa al centro).
- **"¿Qué margen deja Lidomare vs clínica propia?"** = comparar M3 por centro: mismo servicio y profesional pueden dejar margen distinto según el acuerdo del centro. El panel por centro muestra ingreso devengado, coste directo, coste del acuerdo (renta/%, cuando se confirme) y M3.
- **Una misma marca puede etiquetar tres dimensiones sin ambigüedad.** Lidomare, Vivofácil u Oasis pueden aparecer como **centro** (dónde se presta la sesión), como **canal** (quién trajo al cliente) y — si negocio lo decide — como **proyecto** (P&L propio, 5.5). El modelo las separa siempre: "¿qué margen deja Vivofácil?" tiene tres respuestas distintas (sesiones prestadas en su red · clientes que trae · su línea de negocio) y el panel puede cruzarlas. Lo que **no** se hace es tratarlos como "servicios": el servicio es qué se presta (fisioterapia, nutrición, entrenamiento, bonos/programas, eventos), no con quién.
- ⚠️ Los términos económicos de Lidomare, Vivofácil y Oasis **no están documentados** en ningún doc de la serie; este diseño no los inventa. Quedan como pendientes B2-P3 con el modelo listo para recibirlos como reglas C1 (%, renta fija o driver).

### 5.7 Por cliente y por programa

- **Cliente (seudónimo):** margen acumulado = Σ M2 de sus sesiones/compras. Sirve para leer cohortes y canales (5.4), y para detectar programas deficitarios; **no** para exponer una lista nominal de "clientes malos" — el panel global agrega, el detalle vive en `clinica` con RLS (D-op-5).
- **Programa/bono como producto:** margen del programa = Σ ingreso devengado de sus sesiones − Σ costes directos. Un programa de 225 € con 5 sesiones de María Solís deja 225 − 150 − comisiones ≈ 71 € (31 %); el mismo con Cecilia ≈ 121 € (54 %). Responde "¿qué programas son rentables?" y alimenta decisiones de precio de catálogo (línea Clínica).

---

## 6. Dimensiones y modelo conceptual

> Conceptual, no esquema final. Las columnas exactas se fijan en la fase de implementación con su migración (que **no** forma parte de este PR).

### 6.1 Dimensiones de cada hecho (extiende doc 04 §7)

| Dimensión                                      | Vive en                                           | Estado            |
| ---------------------------------------------- | ------------------------------------------------- | ----------------- |
| `sociedad` / `proyecto`                        | global (`*_id_ref`)                               | ✅ existe         |
| `servicio` (línea del catálogo)                | `clinica` (futuro), agrega por proyecto           | 🔜 línea Clínica  |
| `profesional`                                  | FOP-B1 (`profesional`, 08 §3.1)                   | 🔜 PR #13         |
| `centro`                                       | **nuevo** — catálogo propio (§6.2)                | ⚠️ este doc       |
| `canal`                                        | **nuevo** — catálogo propio, atribuido al cliente | ⚠️ este doc       |
| `cliente` (id/seudónimo)                       | `clinica`, nunca sube identidad                   | 🔜 línea Clínica  |
| `tipo_venta` (suelta/bono/programa/plan)       | catálogo Clínica                                  | 🔜 línea Clínica  |
| `medio` de cobro                               | FOP-A1 / libro de cobros                          | 🔜 PR #4 / doc 02 |
| `tipo_coste` (directo/compartido/fijo/general) | C1                                                | 🔜 F-Op C1        |

### 6.2 Entidades conceptuales nuevas (solo las de esta capa)

- **`centro`** — catálogo: nombre, proyecto al que pertenece, tipo de acuerdo (`propio` \| `cesion` \| `porcentaje` \| `renta` \| `pendiente_confirmar`), vigencia. Los términos del acuerdo se modelan como reglas C1 asociadas al centro.
- **`canal`** — catálogo: nombre, tipo (`organico` \| `referido` \| `pagado` \| `partner_b2b` \| `walk_in`), activo. El cliente lleva `canal_id` de alta; la venta puede sobrescribirlo puntualmente.
- **`ingreso_devengado`** — el reparto de un cobro/bono/plan en porciones por sesión/mes: referencia al origen (cobro, factura operativa, bono), a la sesión (si aplica), importe devengado, fecha de devengo. Append-only; las correcciones son apuntes nuevos.
- **`vista de margen`** — M1/M2/M3 son **vistas derivadas** (agregaciones), nunca cifras almacenadas a mano: se calculan cruzando `ingreso_devengado` × coste FOP-B1 × reglas C1. Si un dato fuente se corrige, el margen se recalcula solo.

### 6.3 Relación entre piezas

```
cobro / factura operativa ──► ingreso_devengado ──┐
                                                  ├──► margen sesión (M1, M2)
sesion_liquidable (08) ──► coste por sesión ──────┘         │ agrega por dimensiones
                                                            ▼
nomina_mensual (08) + reglas C1 (centro/compartidos) ──► margen proyecto/centro (M3)
                                                            ▼
                                     costes generales ──► resultado global (M4)
```

---

## 7. Ejemplo numérico integrado (mes tipo, cifras ilustrativas)

Mes de la Clínica con dos centros activos y tarifas reales de la serie; volúmenes inventados solo para ilustrar la mecánica:

| Concepto                                      | Playamar     | Lidomare           | Total       |
| --------------------------------------------- | ------------ | ------------------ | ----------- |
| Sesiones fisio sueltas (55 €)                 | 60 → 3.300 € | 20 → 1.100 €       | 4.400 €     |
| Sesiones de programa (devengo 45 €)           | 40 → 1.800 € | —                  | 1.800 €     |
| Planes nutrición (cuotas devengadas)          | 600 €        | —                  | 600 €       |
| **Ingreso devengado**                         | **5.700 €**  | **1.100 €**        | **6.800 €** |
| Coste profesional por sesión (mix 20-30 €)    | −2.400 €     | −600 €             | −3.000 €    |
| Comisiones datáfono                           | −60 €        | −10 €              | −70 €       |
| **M2 Margen de contribución**                 | **3.240 €**  | **490 €**          | **3.730 €** |
| Nómina María Moreno (fijo)                    | −1.400 €     | —                  | −1.400 €    |
| Recepción Lidia — parte Antifrágil (regla C1) | −300 €       | −100 €             | −400 €      |
| Alquiler / acuerdo del centro                 | −800 €       | ⚠️ pendiente B2-P3 | −800 €      |
| **M3 Margen operativo del centro**            | **740 €**    | **390 €\***        | **1.130 €** |

\* El M3 de Lidomare quedará **incompleto y marcado** hasta confirmar su acuerdo económico (B2-P3): el panel debe mostrar el hueco, no un margen falsamente alto.

Lecturas que este cuadro habilita: fisio suelta margina más que el programa por sesión (25 € vs 15 € con la misma profesional); el mix de tarifas de autónomas (20/30 €) mueve el margen del servicio; y el coste de personas se descompone en nóminas (1.400 + 400) vs autónomos (3.000).

---

## 8. Casos especiales (reglas explícitas)

| Caso                                                                                                             | Tratamiento                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No-show cobrado** (política de cancelación)                                                                    | Ingreso devengado en la fecha de la cita; coste profesional solo si la regla de liquidación lo paga (⚠️ confirmar por profesional, B2-P4). Margen alto visible, no filtrado. |
| **No-show sin cobro con coste**                                                                                  | Margen negativo visible. Si se repite, es señal operativa (política de cancelación), no un dato a esconder.                                                                  |
| **Cortesías / garantías**                                                                                        | Ingreso 0, coste real. Etiquetadas como cortesía para poder filtrarlas en la lectura comercial sin borrarlas de la real.                                                     |
| **Bono caducado con sesiones sin consumir**                                                                      | El resto se devenga como ingreso del mes de caducidad (recomendación; confirmar en B2-P1).                                                                                   |
| **Sesión de bono con profesional distinto al habitual**                                                          | El coste es el del profesional que la dio (regla vigente de ese profesional); el devengo del ingreso no cambia.                                                              |
| **Regla de liquidación sin confirmar** (plan de Marta, 08 §4.4) o **relación sin regularizar** (Carlos, 08 §4.5) | El coste se calcula igual con la regla provisional y el margen se marca **provisional**; nunca margen "sin coste" por falta de confirmación.                                 |
| **Cobro parcial / impago** de una sesión ya prestada                                                             | El devengo no se revierte: la rentabilidad la mide igual; el impago vive en CxC (F-Op A2). Si se condona, apunte de ajuste de ingreso trazado.                               |

---

## 9. KPIs y paneles (para la futura UI)

**KPIs prioritarios**, agrupados por lo que miden:

- **Ingreso:** ingresos devengados · ingresos cobrados · cobros pendientes (CxC) · sesiones no cobradas.
- **Actividad:** ocupación de agenda · no-shows · sesiones realizadas/validadas · sesiones pendientes de liquidar.
- **Coste:** coste profesional directo (partido **nóminas vs autónomos**) · coste fijo mensual · liquidaciones pendientes de pago (CxP).
- **Margen:** margen bruto M1 · margen operativo M3/M4 · margen por sesión, servicio, profesional, canal, centro y proyecto · **punto de equilibrio** del proyecto (fijos del mes ÷ margen de contribución medio por sesión = sesiones necesarias para cubrir fijos).

**Paneles:**

- **Panel dirección (mensual):** M4 global; M3 por proyecto y por centro; top/bottom servicios y profesionales por margen; % coste de personas sobre ingreso, partido nóminas vs autónomos; punto de equilibrio y distancia a él.
- **Panel servicio:** margen unitario y total, mix de tipo_venta, ticket devengado, evolución.
- **Panel profesional (solo CEO):** margen aportado, coste efectivo por sesión, nº sesiones, mix de servicios y centros.
- **Panel canal:** clientes nuevos, margen acumulado por cohorte de alta, margen medio por cliente.
- **Semáforos, no juicios:** el panel señala márgenes provisionales (reglas sin confirmar, acuerdos de centro pendientes) con marca explícita, siguiendo el principio de FOP-B1 de no ocultar nada.
- KPIs ya listados en doc 01 §6 (ticket medio, ocupación, bonos vendidos/consumidos) se leen desde esta misma capa cuando exista el dato de agenda.

---

## 10. Permisos y visibilidad por rol

El margen por profesional **revela retribuciones** (coste = lo que cobra la persona). Hereda la matriz de FOP-B1 (08 §7) endurecida:

| Capacidad                                                                               | CEO | Coordinadora               | Profesional  | Recepción |
| --------------------------------------------------------------------------------------- | --- | -------------------------- | ------------ | --------- |
| Márgenes por profesional (implican coste/retribución de terceros)                       | ✅  | ❌                         | ❌           | ❌        |
| Márgenes por servicio/canal/centro/proyecto (agregados, sin desglose por persona)       | ✅  | ✅                         | ❌           | ❌        |
| Su propio margen aportado (ingresos de sus sesiones − su coste)                         | ✅  | ✅ (el suyo)               | ✅ (el suyo) | —         |
| Datos operativos que alimentan la capa (sesiones, validaciones, ocupación, incidencias) | ✅  | ✅                         | los suyos    | ✅        |
| Cobros pendientes, citas no cobradas, errores administrativos (gestión CxC del día)     | ✅  | ✅                         | ❌           | ✅        |
| Costes fijos y comparativas entre proyectos/centros                                     | ✅  | ❌ (salvo permiso expreso) | ❌           | ❌        |

Principio: la coordinadora gestiona **rendimiento operativo** (mix, volumen, ocupación, incidencias, productividad) sin ver retribuciones de terceros ni la rentabilidad global sensible salvo permiso; recepción gestiona el **cobro del día** sin ver márgenes ni nóminas; cada profesional ve lo que aporta y su liquidación, nunca el margen del negocio.

---

## 11. Relación con otras capas y PRs (conectar, no redefinir)

| Capa / línea                                    | Qué toma FOP-B2                                             | Qué NO hace                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Facturación operativa** (doc 02, PR #1)       | Ingreso documental, desglose fiscal futuro, libro de cobros | No emite ni redefine facturas; no usa fecha de emisión como devengo           |
| **Liquidaciones FOP-B1** (doc 08, PR #13)       | Coste por sesión y fijo de personas, con sus estados        | No recalcula liquidaciones; si una liquidación cambia, el margen se recalcula |
| **Reservas/Agenda** (PR #5, versión canónica)   | Sesiones/citas realizadas y validadas: el hecho generador   | No gestiona agenda ni catálogo; solo consume sesiones validadas               |
| **Tesorería FOP-A1** (doc 06, PR #4 — NO APPLY) | Medio de cobro (para comisiones)                            | No mezcla caja con margen; no toca SQL del baseline                           |
| **F-Op C1** (backlog)                           | Reglas de imputación de compartidos y acuerdos de centro    | No decide los repartos; los consume cuando existan                            |
| **F-Op A2 CxC**                                 | Destino de los impagos                                      | No gestiona cobros pendientes                                                 |
| **F-Op D** (presupuesto vs real)                | — (es su consumidor futuro)                                 | No compara contra presupuesto                                                 |
| **Línea Clínica/Reservas**                      | Sesiones, catálogo, tipo_venta, cliente-id                  | No define catálogo ni precios; no accede a datos clínicos                     |

**Lectura de los estados de liquidación (08 §5) en esta capa:** cada `sesion_liquidable` genera coste y la liquidación mensual los agrupa; con la liquidación `pendiente_calculo`/`calculada` el coste **ya está devengado** (la sesión existe); `validada`/`pendiente_pago` → coste firme y CxP viva en tesorería; `pagada` → solo mueve la vista caja (§4.4); `bloqueada_por_incidencia` → el margen se marca provisional, pero el devengo no se borra ni el pago avanza.

**Gating honesto (como en el backlog):** sin sesiones de agenda no hay margen por sesión. Lo implementable **antes** de Clínica: catálogos de centro y canal, `ingreso_devengado` para ventas manuales, y el partido nóminas/autónomos del coste de personas (que FOP-B1 ya trae). El margen fino llega cuando llegue el dato.

---

## 12. Riesgos y salvaguardas

| Riesgo                                                                                        | Salvaguarda en el modelo                                                                                                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confundir cobrado con rentable**                                                            | Dos vistas separadas (§4.4); la principal es devengo. Un mes de muchos bonos cobrados puede ser un mes de margen mediocre                     |
| **No devengar costes profesionales** (margen inflado hasta que llega la factura del autónomo) | El coste nace de la sesión validada, no de la factura (08 §8); factura tardía no retrasa el devengo                                           |
| **No imputar nóminas** (los autónomos parecen caros y la nómina "gratis")                     | Fijos de personas en M3 + coste efectivo por sesión como métrica comparativa (§4.2)                                                           |
| **Usar pagos no documentados**                                                                | Herencia FOP-B1: `pendiente_regularizar` bloquea y aflora; ningún coste opaco entra "por fuera"                                               |
| **Mezclar rentabilidad con historia clínica**                                                 | D-op-5: cliente id/seudónimo; ningún dato clínico es dimensión ni aparece en paneles; la finalidad terapéutica no se usa para explicar margen |
| **No separar canal / centro / proyecto**                                                      | Tres dimensiones ortogonales (§6.1); la misma marca puede etiquetar las tres sin ambigüedad (§5.6)                                            |
| **Mezclar caja y banco**                                                                      | Territorio FOP-A1 (D-op-3); esta capa no toca saldos ni medios, solo lee la comisión del cobro                                                |
| **Duplicar sesiones liquidadas** (doble coste)                                                | Invariante R3 de 08 (una sesión ∈ una liquidación) + `ingreso_devengado` append-only (§6.2)                                                   |
| **Confundir margen bruto con beneficio neto**                                                 | Escalera M1-M4 siempre etiquetada; M4 es operativo, no resultado fiscal (D-op-6)                                                              |
| **Reparto artificial de generales que distorsiona**                                           | Contribución primero (D-op-7); los generales se restan al global, no se prorratean por defecto                                                |

---

## 13. Pendientes de confirmación

| #     | Pendiente                                                                                                     | Dueño                            | Efecto mientras tanto                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| B2-P1 | **Criterio de devengo de bonos/programas** (lineal recomendado; y regla de caducidad) — hereda F-7 del doc 04 | Guille                           | Se diseña con lineal; los paneles marcan "criterio provisional"                      |
| B2-P2 | **Centro como dimensión del proyecto Clínica** (no proyectos separados) — recomendación de este doc           | Guille                           | Se asume dimensión; elevar un centro a proyecto es alta en `proyectos`, sin rediseño |
| B2-P3 | **Términos económicos de Lidomare, Vivofácil y Oasis** (renta, %, cesión; y si 9AM actúa también como centro) | Guille (+ acuerdos con terceros) | M3 de esos centros marcado **incompleto**; ningún acuerdo se inventa                 |
| B2-P4 | **¿Se paga al profesional el no-show cobrado?** (por profesional/regla)                                       | Guille + profesionales           | Se asume que no; margen del no-show = ingreso completo                               |
| B2-P5 | **Catálogo inicial de canales** y quién lo mantiene                                                           | Guille                           | Catálogo mínimo propuesto en §5.4                                                    |
| B2-P6 | **Parte del coste de María Moreno que es coordinación** (estructura) vs asistencial                           | Guille                           | Toda su nómina como fijo del proyecto Clínica, sin partir                            |

**Fuera de alcance:** CAC/marketing por canal (previsto, no en v1), multi-touch attribution, presupuesto vs real (F-Op D), pricing del catálogo (línea Clínica).

---

## 14. Sincronización con PRs y docs (sin editar otros PRs)

Este PR **solo añade este archivo**. Cambios que deben hacerse en otros documentos **después** de sus merges:

| Doc a tocar                                   | Vive en | Cambio pendiente                                                                                                                                                                                                  |
| --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `05-backlog-finanzas-operativas.md`           | PR #11  | En F-Op B, nota: "diseño funcional en [09-rentabilidad...](09-rentabilidad-operativa-servicios-profesionales-proyectos.md) (FOP-B2, nombre de producto)"; reconciliar nomenclatura junto con la de FOP-B1 (08 §0) |
| `07-sincronizacion-prs-y-modelo-operativo.md` | PR #11  | Añadir esta línea de trabajo a la tabla de líneas (rama `docs/finanzas-rentabilidad-operativa`)                                                                                                                   |
| `08-liquidaciones-equipo-y-profesionales.md`  | PR #13  | Referencia cruzada opcional en su §8: el diseño de la cara de margen vive en el 09                                                                                                                                |
| `02-diseno-facturacion-emitida.md`            | PR #1   | Referencia cruzada opcional: el devengo del ingreso facturado/cobrado se diseña en el 09                                                                                                                          |
| `docs/integration/01-orden-prs.md`            | PR #10  | Añadir este PR al bloque "finanzas docs" (archivo nuevo, sin dependencias duras de merge)                                                                                                                         |

Dependencias conceptuales (no de merge): PR #11 (backlog F-Op y marco general), PR #13 (coste profesional), PR #1 (facturas operativas), PR #4 (tesorería A1, NO APPLY), PR #5 (Reservas: fuente de sesiones/citas), PR #10 (orden de entrada en integración). Archivo nuevo sin colisiones: no exige orden de merge.

---

## 15. Criterio de "hecho" (para la futura implementación, no para este PR)

- [ ] Existen los catálogos de **centro** y **canal**, y cada sesión/venta queda etiquetada con proyecto, servicio, profesional, centro y canal.
- [ ] Los bonos/programas devengan ingreso sesión a sesión según el criterio confirmado en B2-P1, y el cobro entra **una sola vez** en caja (invariante anti-doble-conteo).
- [ ] El margen M1/M2 por sesión cruza ingreso devengado y coste FOP-B1 sin doble conteo ni sesiones perdidas.
- [ ] Los paneles por servicio, profesional, canal, centro y proyecto responden las preguntas de §1.2 con datos del periodo.
- [ ] El coste de personas aparece partido en nóminas vs autónomos por mes y proyecto/centro.
- [ ] Los márgenes provisionales (reglas sin confirmar, acuerdos de centro pendientes) se muestran marcados, nunca como definitivos.
- [ ] La visibilidad respeta §10 (margen por profesional solo CEO; agregados para coordinación).
- [ ] Ningún dato personal ni clínico aparece en la capa global (D-op-5).

---

_Diseño documental de FOP-B2. No modifica código productivo, SQL, tipos ni UI. Requiere validación de Guille antes de abrir implementación._
