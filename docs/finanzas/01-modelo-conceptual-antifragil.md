# Fase 1 — Modelo conceptual financiero de Antifrágil OS

> **Estado:** Fase 1 (diseño conceptual). Borrador para validar con Guille. **Sin código aún.**
> **Rama:** `docs/finanzas-contabilidad-antifragil-audit`
> **Fecha:** 2026-06-26
> **Depende de:** [00-auditoria-base-financiera-antifragil.md](00-auditoria-base-financiera-antifragil.md)
> **Marcas `⚠️ DECISIÓN`:** puntos que requieren confirmación de Guille (recogidos al final).

---

## 1. Propósito

Definir **cómo se organiza económicamente Antifrágil** sobre la base heredada, antes de tocar código. Fija: la jerarquía empresa global ↔ proyectos, la separación de las 5 capas como modelo concreto, el etiquetado dimensional, y las categorías analíticas. Es el contrato que las fases 2-5 implementan.

---

## 2. Jerarquía de entidades

```
ANTIFRÁGIL  (empresa / marca global — la visión consolidada)
│
├── Sociedad(es) jurídica(s)          ← entidad fiscal: CIF, emite/recibe facturas, tiene cuentas
│     (tabla `sociedades`)
│
└── Proyectos / líneas de negocio     ← unidad de gestión y rentabilidad
      (tabla `proyectos`, FK `sociedad_tenedora`)
      ├── Clínica Antifrágil Playamar   (operativo)
      ├── Lido Pro                       (operativo)
      ├── Eventos / 9AM                  (operativo)
      ├── Antifrágil OG                  (operativo)
      └── (futuros)
```

**Dos niveles, dos propósitos distintos:**
- **Sociedad = capa fiscal/legal.** Quién factura, con qué CIF, qué IVA, qué cuentas bancarias. La contabilidad oficial es **de la sociedad**, no del proyecto.
- **Proyecto = capa de gestión.** Cuánto ingresa/gasta/margina cada línea. La rentabilidad es **del proyecto**, no fiscal.

**Estructura fijada (Guille, 2026-06-26):** sobre la SL única se montan, **a nivel global de la SL**, cuatro capas — **contabilidad global · finanzas globales · tesorería global** (que separa **banco** y **efectivo/caja**) **· facturación global** — más los **proyectos / líneas de negocio**. Los **proyectos NO son sociedades**: son **unidades analíticas de negocio**. La **contabilidad y la facturación son globales de la SL**; la **rentabilidad se analiza por proyecto**.

> **Ejemplo de etiquetado (una sesión de fisioterapia pertenece a):** sociedad `Grupo Empresarial Antifrágil SL` · proyecto `Clínica Antifrágil Playamar` · servicio `Fisioterapia` · profesional · cliente · producto/tarifa · **caja o banco** según método de cobro.

Un proyecto cuelga de **una** sociedad (`sociedad_tenedora`). **La Clínica cuelga de `Grupo Empresarial Antifrágil SL`** (✅ DECISIÓN 1 resuelta, 2026-06-26) — la SL paraguas de Antifrágil; comparte CIF con sus proyectos. *(Nota de implementación: esta sociedad aún no existe en la BD heredada de Alsari; habrá que darla de alta en `sociedades` en Fase 2, junto con el proyecto "Clínica Antifrágil Playamar" colgando de ella.)*

**✅ DECISIÓN 2 (resuelta 2026-06-26) — Sociedad ÚNICA.** Antifrágil = **una sola SL** (`Grupo Empresarial Antifrágil SL`) con varios proyectos colgando de ella (mismo CIF). En consecuencia se **elimina** toda la maquinaria multi-holding heredada de Alsari: detección Pavier/Armia por nombre, look-through de % de participación, `proyecto_sociedades` con porcentajes y la distribución `vencimiento_sociedades`. **Modelo final: Antifrágil (global) = la SL = suma de sus proyectos.** No hay consolidación por participaciones.

> *Resto del documento asume el escenario simple (recomendado) y marca dónde cambiaría si no.*

---

## 3. Las 5 capas como modelo concreto

Cada capa es una **lectura distinta del mismo hecho económico**. No se mezclan. Tabla maestra:

| # | Capa | Unidad | Fecha que manda | Fuente de datos hoy | Granularidad |
|---|---|---|---|---|---|
| 1 | **Contabilidad** | Sociedad | Fecha de factura / asiento | `facturas_recibidas`, `facturas_emitidas`, `asientos_*`, PGC | Documento fiscal |
| 2 | **Finanzas (ejecutivo)** | Antifrágil global + por proyecto | Periodo (mes) | Overview + PGC + agregación | KPI agregado |
| 3 | **Tesorería / cashflow** | Sociedad / proyecto | Fecha de **cobro/pago** | `cashflow_consolidado` | Movimiento de caja |
| 4 | **Facturación** | Sociedad (emisor) → cliente | Fecha de **emisión** | `facturas_emitidas` *(a construir)* | Documento emitido |
| 5 | **Rentabilidad analítica** | Proyecto / servicio / profesional | Fecha de **prestación** (devengo) | *(no existe — a crear)* | Margen |

**Ejemplo canónico — bono de fisio de 225 € (regla de Guille):**

| Capa | Cómo lo ve | Cuándo |
|---|---|---|
| Cashflow | +225 € de caja, **una vez** | día de cobro |
| Facturación | 1 factura de 225 €, con IVA/exención y estado de cobro | día de emisión |
| Rentabilidad | ~45 €/sesión imputados − coste profesional/sala | a medida que se consumen las 5 sesiones |

**Invariante anti-doble-conteo:** un mismo ingreso entra **una vez** en caja, se reconoce **progresivamente** en rentabilidad y se documenta **una vez** en factura. Las tres cifras no se suman entre sí.

**Requisito de tesorería (Guille, 2026-06-26) — separar EFECTIVO y BANCO.** La clínica cobra por varios medios (efectivo, datáfono, bizum, transferencia). La tesorería debe distinguir el **saldo en efectivo (caja física)** del **saldo en banco**, y **no** agregarlos en un único "caja disponible" como hace hoy el motor PGC (que mezcla cuentas `570` caja + `572` bancos). Implicaciones:
- **Dashboard:** dos saldos separados — *Efectivo* y *Banco* (y total).
- **Cada cobro/pago lleva un `medio`:** `efectivo` | `banco` (con subtipo opcional datáfono / bizum / transferencia).
- **Caja física → arqueo/cuadre diario:** los cobros en efectivo requieren cierre de caja al final del día.
- Se detalla y construye en **Fase 3** (tesorería de la clínica); en Fase 2 solo se deja el modelo PGC preparado para separar `570` de `572`.

---

## 4. Etiquetado dimensional (cómo todo se cruza)

Cada hecho económico se etiqueta con las dimensiones que apliquen. Esto es lo que permite responder "¿cuánto deja la fisioterapia del profesional X en la Clínica este mes?" sin crear contabilidades paralelas.

| Dimensión | Dónde vive | Estado |
|---|---|---|
| **Sociedad** | `*.sociedad_id_ref` / `sociedad_tenedora` | ✅ existe |
| **Proyecto** | `*.proyecto_id_ref` | ✅ existe |
| **Categoría contable** (PGC) | cuenta del asiento | ✅ existe |
| **Categoría analítica** | *a definir* (ver §5) | ⚠️ nuevo |
| **Servicio / Profesional / Cliente / Producto-tarifa / Sede** | schema `clinica` (futuro, otra línea) | 🔜 Fase 3 |

**Regla de agregación:** las dimensiones clínicas (servicio, profesional, cliente, producto) viven en el schema `clinica` y **suben por `proyecto_id_ref`** a las capas globales. La contabilidad global **no** necesita conocer al paciente; solo recibe el agregado por proyecto/sociedad. Así reservas no se convierte en un monstruo financiero y la clínica conserva su lectura fina.

---

## 5. Categorías analíticas y centros de coste

La **categoría contable (PGC)** responde al fisco; la **categoría analítica** responde a la gestión. Son ejes distintos sobre el mismo gasto/ingreso.

**Ingresos analíticos de la Clínica (ejes):** por **línea** (fisioterapia —incluye la deportiva, es el mismo servicio según decisión de Guille—, entrenamiento personal, nutrición), por **tipo de venta** (sesión suelta, bono, programa, mensualidad), por **profesional**, por **cliente**.

**Costes directos imputables a un proyecto:**
- Profesionales (coste por sesión / nómina / colaboradores)
- Espacio (alquiler o imputación de sala/sede)
- Material
- Software
- Comisiones (datáfono, plataformas)
- Marketing

**Costes generales (estructura):** ⚠️ DECISIÓN 4 — ¿se imputa una parte proporcional a cada proyecto o se dejan a nivel global? Recomendado: **margen de contribución por proyecto** (ingreso − costes directos) y **resultado global** después de generales, sin forzar reparto artificial al principio.

---

## 6. La Clínica como proyecto operativo (la lente correcta)

La tabla `proyectos` **sirve tal cual** para la Clínica. Lo que **no** se usa es la *lente de inversión inmobiliaria* (TIR/VAN/valor de salida/horizonte 10 años/`fecha_prevista_salida`). La Clínica se lee por **explotación**:

**KPIs de la Clínica (como proyecto):**
- Facturación del mes · Caja cobrada · Pendiente de cobro
- Margen bruto · Margen neto (de contribución)
- Ingresos por servicio · Ingresos por profesional
- Ticket medio · Recurrencia
- Bonos vendidos · Sesiones consumidas · Sesiones pendientes
- Ocupación (% de agenda usada)

**✅ DECISIÓN 3 (parcial, 2026-06-26) — Alcance actual = solo la Clínica.** La **Clínica Antifrágil Playamar** es el **único proyecto que se desarrolla ahora** (operativo). El **siguiente previsto es 9 A.M. (Eventos)**, que se deja **preparado pero diferido**; Lido Pro y Antifrágil OG también diferidos. **Implicación de diseño:** el modelo se mantiene **genuinamente multi-proyecto** (nada hardcodeado a la clínica) para que 9 A.M. y los demás enchufen después solo dando de alta el proyecto. Por ahora todos los proyectos previstos son **operativos** → lectura de explotación; si en el futuro hay alguno inmobiliario, se reactiva el análisis de inversión heredado solo para ese.

---

## 7. Qué se conserva / adapta / jubila (consecuencia del modelo)

| Pieza heredada | Acción | Cuándo |
|---|---|---|
| PGC, balance, sumas y saldos | **Conservar** | — |
| Cashflow consolidado + vencimientos | **Conservar** (simplificar a sociedades reales) | Fase 2 |
| Facturas recibidas (OCR + aprobación + pago) | **Conservar**, adaptar roles/categorías/umbral | Fase 2 |
| Presupuestos gasto/ingreso + recurrencia | **Conservar** | — |
| Detección holding "Pavier/Armia", IDs socios, `pct_pavier/pct_armia` | **Adaptar o eliminar** (según DECISIÓN 2) | Fase 2 |
| PersonaView / patrimonio personal / CorporateMap familiar | **Jubilar** (✅ confirmado 2026-06-26) | Fase 2 |
| `analisisFinanciero.ts` (lente de inversión) | **No usar** sobre proyectos operativos; mantener solo si hay proyecto inmobiliario real | Fase 2 |
| Facturación emitida | **Construir** (línea paralela — `02-diseno-facturacion-emitida.md`) | Fase 4 |
| Rentabilidad analítica operativa | **Crear** capa nueva (devengo + costes directos) | Fase 3 |

---

## 8. Decisiones pendientes de Guille (recapitulación)

1. **✅ DECISIÓN 1 (resuelta 2026-06-26) — La Clínica cuelga de `Grupo Empresarial Antifrágil SL`** (SL paraguas; alta pendiente en BD, comparte CIF con sus proyectos).
2. **✅ DECISIÓN 2 (resuelta 2026-06-26) — Sociedad única.** Antifrágil = una SL con varios proyectos; se elimina la consolidación multi-holding de Alsari.
3. **✅ DECISIÓN 3 (parcial) — Alcance actual = solo Clínica** (operativa). 9 A.M./Eventos = siguiente proyecto, diferido; Lido Pro y Antifrágil OG diferidos. El modelo se mantiene multi-proyecto.
4. **⚠️ DECISIÓN 4 — Costes generales:** ¿reparto proporcional a proyectos o margen de contribución + resultado global? *Recomendado: contribución primero.*
5. **✅ DECISIÓN 5 (resuelta 2026-06-26) — Jubilar el patrimonio personal** (PersonaView, PatrimonioView personal, mapa societario familiar). Fuera del alcance de Antifrágil.

**Requisito transversal (Guille, 2026-06-26):** la **tesorería debe separar EFECTIVO y BANCO** (no mezclarlos en "caja disponible"). Ver §3.

---

## 9. Qué desbloquea esto

Con las decisiones 1-3 confirmadas, **Fase 2 (adaptación mínima de UI)** puede arrancar: renombrar lo visible a Antifrágil, simplificar la carcasa de holding, y dejar el dashboard global + por proyecto listos para recibir los datos de la Clínica en Fase 3.

---

*Borrador de modelo conceptual. No modifica código productivo. Sujeto a validación de Guille.*
