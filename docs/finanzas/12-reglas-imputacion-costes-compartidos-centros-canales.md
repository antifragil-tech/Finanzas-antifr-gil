# FOP-C1 — Reglas de imputación, costes compartidos, centros y canales

> **Estado:** Diseño documental. **Sin código, sin SQL, sin tipos, sin UI, sin migraciones.** Desarrolla el lote F-Op C1 del backlog (reglas de imputación y costes compartidos).
> **Rama:** `docs/finanzas-fop-c1-imputacion-costes`
> **Fecha:** 2026-07-05
> **Depende de:** `05` (F-Op C1, PR #11), `04` §4.3/§7 (capas de coste y dudas F-2/F-4), `08` (coste de personas, PR #13 — su regla `nomina_compartida` es la primera regla C1 viva), `09` (escalera M1-M4 y dimensiones centro/canal, PR #15), `10` (bonos, PR #19).
> **Regla:** reutilizar antes de crear. Capa de gestión, no fiscal (D-op-6). **Contribución primero** (D-op-7): no se prorratea lo que no tiene regla explícita. Cero datos clínicos (D-op-5).

---

## 0. Encaje en la serie

Implementa **F-Op C1** del backlog (mismo nombre producto↔backlog). FOP-B1 (08) ya materializó su primer caso — la regla de reparto de la nómina compartida de Lidia (400 € Antifrágil / resto Lidomare) — y avisó de que "si el acuerdo cambiara a %, `regla_liquidacion` lo soporta". Este doc generaliza esa idea a **cualquier coste** y resuelve en diseño la duda **F-2** del doc 04 (recepción compartida) y el criterio **F-4** (generales: contribución, no prorrateo). Las dimensiones **centro** y **canal** son las definidas en 09 §5.4-5.6; aquí se les da la pata de coste.

## 1. Problema

- Hay costes que **no pertenecen a una única sesión**: la recepción compartida con Lidomare, el software, la gestoría, el alquiler, el marketing, la coordinación de María Moreno.
- Sin regla explícita pasan dos cosas malas: o **no se imputan** (el margen por servicio/centro parece mejor de lo que es) o se **prorratean por intuición** (el margen se distorsiona y nadie sabe por qué).
- **Centro, canal y proyecto se mezclan** en la conversación ("¿cuánto nos cuesta Lidomare?") y cada pregunta necesita una dimensión distinta (§4).
- Hoy no existe `tipo_coste` ni clave de reparto (doc 04 §4.2): un coste compartido no se puede partir entre proyectos/empresas.

## 2. Objetivo

Un catálogo de **reglas de imputación** que asigne cada coste a las dimensiones de gestión — proyecto, centro, canal, servicio, profesional, línea de negocio — y al **periodo** correcto (mes del devengo, no del pago), de forma trazable y versionada. Lo que no tenga regla, queda **sin imputar y visible** — nunca repartido en silencio.

## 3. Conceptos

| Concepto | Definición |
|---|---|
| `coste_directo` | Atribuible a una sesión/servicio concreto (profesional por sesión, material de la sesión, comisión del cobro). Entra en M1/M2 |
| `coste_variable` | Crece con la actividad aunque no sea de una sesión concreta (consumibles, comisiones TPV agregadas) |
| `coste_fijo` | Del periodo, independiente del volumen (alquiler, nóminas, software con cuota) |
| `coste_compartido` | Lo soportan dos o más entidades/proyectos/centros (recepción con Lidomare, suministros de sede compartida) → **exige regla explícita** |
| `coste_general` | Estructura no asignable con criterio razonable (gestoría global, seguros, administración) → al resultado global (M4), no se reparte por defecto |
| `coste_comercial` | De captación: marketing, campañas, eventos de captación → imputable a **canal/campaña** |
| `coste_de_personas` | El de FOP-B1 (08): por sesión (autónomos) o fijo mensual (nóminas, parte compartida) |
| `regla_imputacion` | Cómo se asigna un coste: destino(s), método (§5), driver si aplica, vigencia, autor. **Versionada**: cambiar una regla crea versión nueva, la historia no se reescribe |
| `driver` | La variable que reparte (nº sesiones, ingresos, horas, m², clientes captados) |
| `periodo_imputacion` | El mes del devengo del coste (fecha de servicio, no de pago — D-op-2) |
| `centro` / `canal` / `proyecto` | Dimensiones de 09 §6.1: dónde se presta / quién trajo al cliente / línea de negocio |

## 4. Centro, canal y proyecto: la misma marca, tres preguntas

Regla de 09 §5.6, ahora con la pata de coste. **La dimensión la elige la pregunta, no la marca:**

| Marca | Como centro | Como canal | Como proyecto |
|---|---|---|---|
| **Lidomare** | Sede donde se prestan sesiones (coste de espacio/recepción compartida) | Derivación de clientes desde su comunidad | "Lidomare x Antifrágil" si adquiere P&L propio |
| **Vivofácil** | Red donde se presta servicio B2B | Partner que trae clientes administrativos | Proyecto B2B si se gestiona como línea |
| **Oasis** | Sede/espacio de colaboración | Canal de derivación | Proyecto de colaboración |
| **9AM** | (Espacio de eventos, si aplica) | Canal de comunidad/captación | Proyecto/evento con presupuesto propio (doc 01: proyecto previsto) |

Consecuencia: un coste de marketing de 9AM puede imputarse **al canal 9AM** (para medir coste de captación) aunque 9AM sea también un proyecto. La regla de imputación declara **a qué dimensión** va cada coste; el panel cruza después.

## 5. Tipos de reglas de imputación

| Tipo | Cuándo usarlo | Ejemplo |
|---|---|---|
| `directa_100` | El coste es de un único destino | Alquiler de Playamar → 100 % proyecto Clínica / centro Playamar |
| `porcentaje_fijo` | Reparto pactado estable | Recepción: X % Antifrágil / resto Lidomare (hoy es importe fijo, ver §6) |
| `importe_fijo` | Parte fija pactada (caso real actual) | Lidia: 400 €/mes Antifrágil, resto Lidomare (08 §4.2) |
| `por_sesiones` | Driver de actividad | Material común repartido por nº de sesiones de cada servicio |
| `por_ingresos` | Driver económico | Comisión de plataforma repartida por ingreso devengado de cada línea |
| `por_horas` | Driver de dedicación | Coordinación de María Moreno clínica/estructura (B2-P6) |
| `por_profesional` | Coste ligado a personas concretas | Seguro de RC por profesional |
| `por_centro` | Coste de sede repartido entre centros | Software de agenda si sirve a varios centros |
| `por_m2` | Solo si hay espacios compartidos medibles | Suministros de sede compartida (si aplica) |
| `por_campana` | Coste comercial → canal/campaña | Ads de una campaña concreta |
| `manual_trazada` | Excepción puntual con motivo y autor | Ajuste de un mes atípico |
| `no_imputable_todavia` | **No hay criterio** → visible sin repartir | Acuerdos partners sin documentar (B2-P3) |

## 6. Casos reales actuales (con lo ya documentado; nada inventado)

| Caso | Tipo de coste | Regla propuesta |
|---|---|---|
| **Lidia Muesa** (recepción) | compartido (personas) | `importe_fijo`: 400 €/mes Antifrágil, resto Lidomare (08 §2). Dentro de Antifrágil: al centro donde presta (Playamar/Lidomare, B2-P3 aclara) |
| **María Moreno** | personas, mixto | Nómina como fijo del proyecto Clínica; split clínica/coordinación pendiente (`por_horas`, hereda B2-P6) |
| **Alquiler** | fijo | `directa_100` al centro/proyecto de la sede |
| **Gestoría** | general | Sin repartir → M4 (contribución primero) |
| **Software** | fijo | `directa_100` al proyecto si es de un módulo; `por_centro`/`por_sesiones` si sirve a varios; general si es de estructura |
| **Marketing** | comercial | `por_campana` → canal; permite coste de captación por cliente (09 §5.4, CAC futuro) |
| **TPV/comisiones** | variable/directo | Ya resuelto en 09 §4.2: coste directo del cobro (M2) |
| **Material** | directo o variable | De la sesión → M1/M2; común → `por_sesiones` |
| **Eventos 9AM** | comercial/proyecto | Al proyecto 9AM y/o al canal 9AM según finalidad del gasto (captación vs producción del evento) |
| **Lidomare x Antifrágil / Vivofácil / Oasis** | compartido/partner | `no_imputable_todavia` hasta documentar acuerdos (B2-P3); el modelo los recibe como `porcentaje_fijo`/`importe_fijo`/driver sin rediseño |

## 7. Prioridad de imputación (criterio en cascada)

1. **Coste directo real** — si el coste es de una sesión/servicio, va ahí (M1/M2). No se promedia lo que se puede atribuir.
2. **Coste compartido con regla explícita** — se reparte según su `regla_imputacion` versionada.
3. **Coste fijo asignado** — al proyecto/centro del periodo (M3).
4. **Coste general no asignado** — al resultado global (M4), etiquetado como estructura.
5. **No inventar:** sin criterio → `no_imputable_todavia`, visible en el panel como "sin imputar". Un margen con costes sin imputar se muestra **marcado**, igual que los márgenes provisionales de 09.

## 8. Relación con Rentabilidad (PR #15)

- La escalera es la de 09 §4: **M1** usa coste directo; **M2** resta variables/comisiones; **M3** resta fijos y compartidos imputados; **M4** resta generales.
- C1 es quien define **cómo** llegan los costes a M3: cada peldaño consume las reglas de este doc, sin recalcular nada propio.
- **No prorratear de forma artificial sin marcarlo**: si un día se decide repartir generales (F-4), el panel debe distinguir "margen de contribución" vs "margen con reparto", nunca sustituir uno por otro en silencio.

## 9. Relación con Liquidaciones (PR #13)

- Las **nóminas** y la parte Antifrágil de compartidas (Lidia) son el caso `importe_fijo` ya vivo; los **autónomos por sesión** son coste directo puro (no pasan por C1).
- El **coste de coordinación** (María Moreno) es el caso de `por_horas` pendiente de B2-P6.
- C1 no toca el ciclo de liquidación (08 §5): toma el coste devengado que FOP-B1 calcula y decide **a qué dimensión** se imputa.

## 10. Relación con Bonos (PR #19)

- Los bonos afectan al **ingreso devengado** (10 §6); la imputación de costes **no duplica ni reparte ingreso** — solo costes.
- Descuentos y promociones **no son coste**: son menos ingreso (09 §4.1, 10 §6.2). Lo que sí puede imputarse a canal/campaña es el **coste comercial** de la promoción (ads, material del evento).
- Las cortesías (10 §6.4) llevan su coste directo a la dimensión de la sesión, etiquetadas.

## 11. Relación con Tesorería (PR #4 — NO APPLY)

- **El pago real no decide la imputación**: fecha de pago ≠ fecha de coste (D-op-2); un alquiler pagado en julio es coste de julio aunque se pague en agosto.
- Caja/banco pertenecen a la **vista caja** (09 §4.4); las reglas C1 operan solo en devengo.
- Nada de SQL: el modelo de tesorería del PR #4 sigue NO APPLY.

## 12. Roles

| Capacidad | CEO | Coordinadora | Recepción | Profesional |
|---|---|---|---|---|
| Crear/editar/versionar reglas de imputación | ✅ (solo CEO) | ❌ | ❌ | ❌ |
| Ver reglas operativas no sensibles (drivers, destinos) | ✅ | ✅ | ❌ | ❌ |
| Ver costes imputados con importes (incluye retribuciones) | ✅ | ❌ | ❌ | ❌ |
| Ver imputación global / comparativas | ✅ | ❌ (salvo permiso) | ❌ | ❌ |

Las reglas son **configuración económica**: misma frontera dura que en 10 §13 — recepción y coordinación operan, no configuran.

## 13. KPIs

- Coste fijo mensual · coste directo mensual · coste compartido del mes · coste **sin imputar** (debe tender a 0 o estar justificado).
- Coste por centro · por canal · por proyecto · coste de recepción por línea.
- Coste de marketing por cliente captado (por canal/campaña) · coste de software por proyecto.
- **Margen antes/después de imputación** (contributivo M2 vs operativo M3) — la doble lectura que evita castigar servicios rentables con fijos mal repartidos.

## 14. Riesgos y salvaguardas

| Riesgo | Salvaguarda |
|---|---|
| Prorrateo artificial que distorsiona | Cascada §7 + contribución primero (D-op-7); reparto siempre con regla explícita |
| Castigar un servicio rentable con demasiados fijos | Doble lectura M2/M3 en paneles; los fijos se imputan a proyecto/centro, no a servicio, salvo regla justificada |
| Mezclar canal y centro | Dimensiones ortogonales (§4, 09 §5.6); la regla declara a cuál va |
| No evidenciar acuerdos con partners | `no_imputable_todavia` + pendiente B2-P3: sin documento no hay regla, y se ve |
| Asignar costes por intuición | Toda imputación referencia su regla; `manual_trazada` exige motivo y autor |
| Que recepción modifique reglas | §12: configuración solo-CEO |
| Ocultar costes generales | M4 los muestra siempre; "general" no significa invisible |
| Usar datos clínicos | Ningún driver usa datos de pacientes; solo volúmenes administrativos (D-op-5) |
| Convertir las reglas en contabilidad fiscal | Capa de gestión (D-op-6); el PGC y la gestoría no leen de aquí |
| Cambiar reglas sin versionado | Reglas versionadas con vigencia; los meses cerrados no se recalculan al cambiar una regla |

## 15. Pendientes de decisión

| # | Pendiente | Dueño |
|---|---|---|
| C1-P1 | **Acuerdo económico Lidomare** (recepción compartida: ¿sigue importe fijo 400 € o pasa a %? ¿quién paga qué del espacio?) — consolida F-2 y B2-P3 | Guille + Lidomare |
| C1-P2 | **Acuerdo Vivofácil** (¿fee por sesión, % o cuota?) | Guille + Vivofácil |
| C1-P3 | **Acuerdo Oasis** | Guille + Oasis |
| C1-P4 | **Criterio de recepción compartida** dentro de Antifrágil: ¿a qué centro(s) se imputa la parte propia? | Guille |
| C1-P5 | **Split María Moreno** coordinación/clínica (driver horas) — hereda B2-P6 | Guille |
| C1-P6 | **Criterio marketing 9AM**: ¿canal de captación, proyecto evento, o mixto por finalidad? | Guille |
| C1-P7 | **Tratamiento del software** (por proyecto/centro/general según herramienta) | Guille |
| C1-P8 | **Confirmar contribución-antes-de-prorrateo como vista principal** (cierra F-4 del doc 04) | Guille |

---

*Diseño documental de FOP-C1. No modifica código productivo, SQL, tipos ni UI. Requiere validación de Guille (y acuerdos con partners para C1-P1..P3) antes de abrir implementación.*
