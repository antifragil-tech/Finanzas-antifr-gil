# Auditoría Fase 0 — Base financiera/contable y su adaptación a Antifrágil OS

> **Estado:** Fase 0 (auditoría). Solo estudio y documentación. **Cero código funcional, cero migraciones, cero tipos nuevos.**
> **Rama:** `docs/finanzas-contabilidad-antifragil-audit`
> **Fecha:** 2026-06-26
> **Autor:** Claude (arquitecto técnico-financiero) · **Validación:** Guille
> **Regla de oro:** no duplicar tablas/contabilidad/facturas/cashflow. Primero mapear lo que hay, luego decidir qué se conserva / renombra (solo UI) / adapta / depreca / migra / crea.

---

## 0. Resumen ejecutivo (para Guille)

La base que heredamos de **Alsari Capital OS** es **mucho más madura de lo que parecía**: ya tiene contabilidad (facturas, banco, asientos, PGC), tesorería (cashflow consolidado, vencimientos), presupuestos por proyecto y un dashboard financiero. **No hay que reescribir; hay que adaptar.**

El problema de fondo es de **encaje conceptual**, no de calidad del código:

- **Alsari es un holding inmobiliario** de dos socios (Javier/Iván) con dos sociedades cabecera (Pavier/Armia), participaciones cruzadas y proyectos que se compran, reforman y **venden** (métricas TIR/VAN/valor de salida).
- **Antifrágil es una empresa operativa** sanitaria/deportiva con **líneas de negocio que no se venden, sino que facturan mes a mes** (Clínica, Lido Pro, Eventos/9AM, Antifrágil OG...).

Por eso la estrategia es: **conservar el esqueleto genérico** (sociedades, proyectos, cashflow, PGC, facturas, presupuestos) y **quitar la carcasa específica de Alsari** (lógica de doble holding, patrimonio personal de los socios, y la valoración de inversión inmobiliaria como lente por defecto).

**Lo que mejor encaja y se reutiliza casi tal cual:** contabilidad de facturas recibidas, tesorería/cashflow, presupuestos gasto/ingreso, motor PGC, utilidades de formato y cálculo.
**El gran hueco para la clínica:** **facturación emitida** (hoy al 35 %) y una **lectura de rentabilidad operativa** (no de inversión).
**Lo que sobra o estorba para Antifrágil:** detección de "Pavier/Armia" por nombre, vistas de patrimonio personal de los socios, y correr TIR/VAN de salida sobre una clínica.

---

## 1. Qué módulos financieros/contables existen

| Módulo (`apps/modules/`) | Qué hace | Madurez | Veredicto rápido |
|---|---|---|---|
| **financiero** | Dashboard ejecutivo: KPIs consolidados (caja, deuda, fondo de maniobra, patrimonio), balance vía PGC, cashflow, vencimientos, patrimonio, mapa societario | Alta | Núcleo reutilizable; quitar carcasa Alsari |
| **contabilidad** | Facturas recibidas (OCR + aprobación + pago + Drive), facturas emitidas, contactos, movimientos bancarios, diario/asientos, reconciliación, fichas de sociedad | Recibidas **90 %** · Emitidas **35 %** | Conservar recibidas; **ampliar emitidas** |
| **presupuestos** | Proyectos (CRUD + detalle), presupuestos gasto/ingreso con partidas y recurrencia, tareas (Kanban), objetivos (OKR), análisis financiero de inversión, informe PDF | Media-alta | Presupuestos OK; el **análisis es inmobiliario** |
| **reservas** | Spike de calendario clínica (DayPilot) — **solo UI mock, sin backend** | Spike | **NO TOCAR** (otra línea de trabajo) |
| **facturas** (antiguo) | Módulo legacy archivado; `/facturas` redirige a `/contabilidad` | Deprecado | Ignorar |

**Backend (`services/supabase/migrations/`):** ~66 migraciones. Tablas canónicas en schema `public`: `sociedades`, `proyectos`, `proyecto_sociedades`, `facturas_recibidas`, `facturas_emitidas`, `factura_pagos`, `factura_aprobaciones`, `contactos`, `proveedores_reglas`, `movimientos_bancarios`, `extractos_bancarios`, `asientos_*`, `presupuestos*`, `vencimientos`, `vencimiento_sociedades`, `activos_patrimonio`. Vistas clave: `flujos_proyecto_consolidados` y `cashflow_consolidado`.

**No existe** schema `clinica` ni ninguna tabla `pagos_cita`/`bonos`/`citas` a nivel SQL. El módulo reservas es 100 % mock.

---

## 2. Tablas y tipos ya reutilizables (lo aprovechable)

**Reutilizable casi tal cual (genérico, no atado a Alsari):**

- **Motor PGC** (`financiero/src/lib/pgcEngine.ts`) + parser de sumas y saldos y de libro mayor → clasifica cualquier contabilidad española. Cero cambios.
- **Tesorería/cashflow:** vistas `flujos_proyecto_consolidados` + `cashflow_consolidado`, `CashflowView`, `VencimientosView`. Modelo de capas (real / comprometido / previsto) y fuentes (factura / presupuesto / flujo manual / vencimiento). Genérico.
- **Facturas recibidas:** OCR (Claude Vision), workflow de estados, RPC de auditoría `avanzar_estado_factura_con_auditoria` (patrón `SECURITY DEFINER` + `factura_aprobaciones`), pagos (`factura_pagos`), incidencias, archivo en Drive. Solo hay que adaptar roles/categorías/umbral.
- **Presupuestos:** `presupuestos` / `presupuesto_capitulos` / `presupuesto_partidas` / `presupuesto_pagos`, gasto vs ingreso, recurrencia automática. Genérico y directamente útil para una clínica.
- **`@alsari/utils`:** `formatCurrency`, `parseCurrency`, `formatPercent`, `calcularVAN`, `calcularXIRR`, `calcularMOIC`, `cn`. Puro y reutilizable.
- **`@alsari/types`:** `presupuestos.ts`, `workspace.ts` y la parte de `financial.ts` de flujos/métricas → reutilizables. `contabilidad.ts` es muy de Alsari.
- **`@alsari/supabase-client`:** resolución de JWT (`window.alsariToken` → `localStorage` → anon) y RLS obligatorio. Reutilizable; solo expone `public` (habría que exponer `clinica` con RLS si se crea).
- **`@alsari/ui`:** design system Quiet Luxury (paleta zinc/crema, glassmorphism, Geist) — pero **solo 6 componentes** (Button, KPICard, Modal, Badge, EmptyState, Skeleton). Falta lo demás.

**Modelo de tagging dimensional (ya presente, a aprovechar):** facturas, presupuestos y flujos ya pueden referenciar `sociedad_id_ref` y `proyecto_id_ref`. Ese es el enganche por el que la actividad de cada línea (incluida la clínica) sube a la contabilidad y el cashflow global.

---

## 3. Qué es demasiado específico de Alsari (a adaptar o jubilar)

| Pieza | Por qué es de Alsari | Acción para Antifrágil |
|---|---|---|
| Detección de holdings "Pavier"/"Armia" **por nombre** (`financiero/App.tsx`, `Overview.tsx`, `CorporateMap.tsx`) | Asume 2 holdings cabecera fijos | Parametrizar; con 1–2 sociedades, simplificar o eliminar el look-through dual |
| IDs de socios `javier_alarcon` / `ivan_alarcon`, columnas `pct_pavier` / `pct_armia` | Personas físicas y % de tenencia concretos | Renombrar a genérico o no usar; Antifrágil opera por sociedad, no por patrimonio personal |
| `PersonaView`, `PatrimonioView` personal, `CorporateMap` familiar | Patrimonio personal de la familia Alarcón | Probablemente **fuera de alcance**; ocultar/jubilar |
| **Análisis de inversión** (`presupuestos/.../analisisFinanciero.ts`): compra-venta, renta, cap-rate de salida, valor terminal, horizonte 10 años, `fecha_prevista_salida` | Diseñado para comprar/reformar/vender inmuebles | **No usar sobre la clínica.** Para líneas operativas usar lectura de explotación (ingresos–costes–EBITDA–margen), no appraisal de salida |
| Roles `guille/javi/alicia` y umbral de aprobación, categorías de movimiento inmobiliarias | Operativa contable de Alsari | Adaptar a roles/categorías de Antifrágil (matriz rol→acción flexible) |
| Naming de paquetes `@alsari/*` | Marca antigua | **No rebrandear ahora** (decisión de Guille); estrategia futura aparte |

---

## 4. Cómo separar las cinco capas (contabilidad / finanzas / tesorería / facturación / rentabilidad)

Esta es la separación conceptual que pide Guille, mapeada sobre lo que ya existe:

| Capa | Pregunta que responde | Dónde vive hoy | Acción |
|---|---|---|---|
| **1. Contabilidad global** (fiscal/documental) | Qué facturamos/recibimos, qué IVA/exención, qué evidencia documental, qué está pagado | módulo **contabilidad** | Conservar recibidas; **ampliar emitidas**; adaptar roles/categorías |
| **2. Finanzas globales** (visión ejecutiva) | Caja, ingresos, gastos, margen, evolución, salud financiera, comparación entre proyectos | módulo **financiero** (Overview + PGC) | Quitar carcasa holding; añadir **comparativa por proyecto/línea** |
| **3. Tesorería / cashflow** (caja real/prevista) | Cuánto entra/sale y cuándo; pendiente de cobro/pago; caja a 7/15/30/60/90 días | `cashflow_consolidado` + Cashflow/Vencimientos | Maduro. Añadir **4ª fuente = cobros de la clínica** (Fase 3) |
| **4. Facturación** (documento fiscal) | Factura: emisión, cliente, base, IVA/exención, PDF, fecha emisión ≠ cobro ≠ servicio | `facturas_emitidas` (inmaduro) | **Diseñar y construir** emisión + exención IVA sanitaria + asiento de venta |
| **5. Rentabilidad analítica por proyecto** (margen) | Qué factura cada proyecto/servicio/profesional, qué costes directos, qué margen | parte en presupuestos; **lectura operativa no existe** | Crear **capa analítica operativa** (devengo + costes directos), separada de la fiscal |

**Principio innegociable (regla de Guille):** estas capas **no se mezclan**. La misma operación se ve distinta en cada una. Ejemplo del bono de fisio de 225 €:
- **Cashflow:** entran 225 € el día que se cobra (una sola vez).
- **Rentabilidad:** se imputan ~45 €/sesión a medida que se consumen las 5 sesiones (devengo), menos coste del profesional/sala.
- **Facturación:** una factura de 225 € con su fecha de emisión, su tratamiento fiscal (posible exención sanitaria) y su estado de cobro.

**No doble contar:** el bono entra una vez en caja, se reconoce sesión a sesión en rentabilidad, y se documenta una vez en factura. Son tres lecturas del mismo hecho, no tres ingresos.

---

## 5. Empresa global vs proyectos — y cómo representar la Clínica

**Jerarquía objetivo de Antifrágil:**

```
Antifrágil (empresa global)
├── Finanzas globales · Contabilidad global · Facturación global · Tesorería global
└── Proyectos / líneas de negocio
    ├── Clínica Antifrágil Playamar   ← primer proyecto operativo fuerte
    ├── Lido Pro
    ├── Eventos / 9AM
    ├── Antifrágil OG
    └── (futuros)
```

**La tabla `proyectos` ya sirve** para esto: tiene `id_ref`, `nombre`, `sociedad_tenedora` (FK a `sociedades`), `estado`, fechas, `tipo_activo`, `ubicacion`. La Clínica se representa como **un proyecto operativo** que cuelga de **una sociedad existente** (decisión ya tomada por Guille: proyecto dentro de sociedad, comparte CIF — falta confirmar **bajo qué sociedad**).

**Lo único que chirría no es la entidad "proyecto", es la lente de análisis:** no hay que correr TIR/VAN/valor de salida sobre la clínica. La clínica se lee por **explotación**: facturación mensual, caja cobrada, pendiente de cobro, margen bruto/neto, ingresos por servicio y por profesional, ticket medio, bonos vendidos/consumidos, ocupación.

**Tagging dimensional deseado:** cada movimiento/factura/pago/cobro debería poder vincularse (opcionalmente) a: sociedad · proyecto · servicio · profesional · cliente · producto/tarifa · centro/sede · categoría contable · categoría analítica. Hoy el modelo soporta **sociedad + proyecto**; las dimensiones clínicas (servicio, profesional, cliente, producto) vivirán en el futuro schema `clinica` y **agregarán hacia arriba por `proyecto_id_ref`**.

---

## 6. Cómo conectar (en el futuro) reservas / citas / bonos con las finanzas

**Principio:** la **cita/bono es la verdad operativa**. De ahí se derivan las demás capas; pero reservas **no** debe convertirse en un monstruo financiero. El puente natural es una capa fina de cobros (`clinica.pagos_cita`, ya esbozada en `docs/reservas/02-addendum...`) que lleva `proyecto_id_ref` + dimensiones clínicas.

```
Reserva / cita / bono  (schema clinica — otra línea de trabajo)
        │
        ├─►  CASHFLOW            cobro entra en caja en su fecha (bono = entero al cobrar)
        │                        → 4ª fuente de `cashflow_consolidado`, por proyecto→sociedad
        │
        ├─►  FACTURACIÓN         factura emitida opcional; exención IVA sanitaria; fecha emisión ≠ cobro
        │
        ├─►  RENTABILIDAD        ingreso imputado a sesiones consumidas − costes directos
        │                        (profesional, sala) → margen por servicio/profesional/línea
        │
        └─►  DASHBOARD           KPIs de la clínica como proyecto + agregado a Antifrágil global
```

**Orden de implementación (cuando Clínica esté lista, Fase 3+):** primero **cashflow** (lo más simple y de mayor valor: ver la caja real), luego **factura emitida**, luego **rentabilidad analítica**, luego **dashboard**. Nunca al revés.

---

## 7. Riesgos técnicos

1. **Drift migraciones ↔ BD real (riesgo nº1, ya documentado en lecciones 06-11).** Las migraciones se aplican **a mano por el Dashboard de Supabase**; el repo no garantiza paridad con producción. **Antes de Fase 3 hay que auditar la paridad real** del schema, no asumir que una tabla existe porque hay un `.sql` en el repo.
2. **No existe schema `clinica`** ni acceso a datos del módulo reservas (es mock). `supabase-client` solo expone `public`; exponer `clinica` requerirá RLS estricto.
3. **Hardcoding de Alsari** (nombres de holding, IDs de socios, roles `guille/javi/alicia`): refactor para genericidad antes de que se multiplique.
4. **Divergencia tipo ↔ BD ya conocida** (del `SESSION.md` previo): `PagoEstado` y `FuenteFlujo` en `@alsari/types` no incluyen valores que la BD ya tiene (`estimado/confirmado/facturado/sin_fecha`, `vencimiento`). Deuda a saldar.
5. **Design system mínimo** (6 componentes): faltan tablas, inputs, selects, tabs, toasts, date pickers. Bloquea construir pantallas nuevas con calidad sin reinventar cada vez.
6. **Naming `@alsari/*`:** no rebrandear ahora (decisión de Guille); pero es deuda futura: cambiarlo más tarde es costoso porque todos los módulos lo referencian.
7. **Tailwind del host debe escanear `apps/modules/*/src`** (lección 05-17): cualquier módulo nuevo de UI necesita estar en el `content` o su CSS no se genera.
8. **Auth bridge en módulos Vite:** usar siempre `getJwt()` / `window.alsariToken`, nunca `localStorage` directo (lección 05-22).

---

## 8. Riesgos contables / fiscales

1. **Facturación emitida inmadura (35 %):** no hay emisión oficial con número inmutable, ni asiento de venta (700/430), ni PDF oficial, ni auditoría de cambios. **Emitir facturas mal es riesgo fiscal directo.** Es el trabajo más delicado de cara a la clínica.
2. **Exención de IVA sanitaria (art. 20 LIVA):** el modelo ya soporta `tipo_operacion = 'exenta'`, pero **no todo servicio sanitario está exento** (depende de finalidad terapéutica vs estética/bienestar). Exentar de más o de menos es riesgo fiscal. Debe decidirse **por servicio/producto**, no globalmente.
3. **Caja en efectivo / datáfono / bizum:** la clínica cobra en efectivo y por datáfono; **no hay control de caja diaria** modelado. Riesgo de descuadre y de cumplimiento (límites de efectivo, conciliación).
4. **Separación de fechas:** fecha de servicio ≠ fecha de factura ≠ fecha de cobro. Mezclarlas corrompe las tres capas.
5. **Bonos = ingreso anticipado:** al cobrar un bono, fiscal/analíticamente hay servicios aún no prestados (un pasivo por devengar). El tratamiento caja vs devengo debe definirse explícitamente para no inflar rentabilidad.
6. **No mezclar rentabilidad analítica con contabilidad fiscal:** la rentabilidad por proyecto es una **capa de gestión**, no una segunda contabilidad oficial.

---

## 9. Propuesta de fases

| Fase | Objetivo | Entregable | Toca código productivo |
|---|---|---|---|
| **0 — Auditoría** *(este documento)* | Entender lo existente y cómo adaptarlo | Este informe | No |
| **1 — Modelo conceptual Antifrágil** | Definir empresa global, proyectos, categorías analíticas, centros de coste, separación de las 5 capas | Documento de modelo + ADR | No (diseño) |
| **2 — Adaptación mínima de UI** | Renombrar lo visible a Antifrágil **sin** romper arquitectura ni paquetes `@alsari/*`; simplificar la carcasa de holding | PR pequeño de UI | Sí (mínimo) |
| **3 — Conexión con Clínica** | Cuando Clínica esté lista: cobros/citas/bonos → cashflow y rentabilidad por proyecto | Capa `clinica.pagos_cita` → cashflow | Sí |
| **4 — Facturación emitida** | Emisión oficial desde actividad clínica: número, fecha, IVA/exención, asiento, PDF | Flujo de factura emitida | Sí |
| **5 — Dashboards** | Dashboard global de Antifrágil + dashboard por proyecto (Clínica, Lido Pro, Eventos/9AM, ...) | Vistas de dashboard | Sí |

**Regla de proceso:** ninguna fase con código se abre sin que la anterior de diseño esté validada por Guille. **No se hace PR funcional hasta cerrar Fase 0/1.**

---

## 10. Decisiones que necesito de Guille

1. **¿Bajo qué sociedad existente cuelga la Clínica?** (ya decidido: proyecto dentro de sociedad; falta saber **cuál** — o si se crea una sociedad nueva para Antifrágil).
2. **¿Cuántas sociedades reales tendrá Antifrágil?** Si son 1–2, **eliminamos** la maquinaria de consolidación multi-holding (look-through de %); si serán varias con participaciones cruzadas, la conservamos adaptada.
3. **¿Confirmamos la lista de proyectos** (Clínica Playamar, Lido Pro, Eventos/9AM, Antifrágil OG) y cuáles son operativos vs de inversión? Define qué proyectos usan lectura de explotación y cuáles (si hay alguno inmobiliario) sí justifican el análisis de inversión existente.
4. **¿Las vistas de patrimonio personal y mapa societario familiar** (PersonaView, PatrimonioView, CorporateMap) se jubilan o se mantienen ocultas por si acaso?

---

## Anexo — Índice de referencias de código (para fases siguientes)

- **PGC / balance:** `apps/modules/financiero/src/lib/pgcEngine.ts`, `.../views/BalanceView.tsx`, `.../views/BssSaldosSection.tsx`
- **Consolidación / holdings (a simplificar):** `apps/modules/financiero/src/App.tsx`, `.../views/Overview.tsx`, `.../views/CorporateMap.tsx`
- **Cashflow / vencimientos:** `.../views/CashflowView.tsx`, `.../views/VencimientosView.tsx`, `.../lib/cashflowHoldingApi.ts`; vistas SQL `services/supabase/migrations/20260605000002_cashflow_consolidado.sql`, `..._000003_flujos_presupuesto_sociedad.sql`
- **Facturas recibidas (patrón a imitar):** `apps/modules/contabilidad/src/components/FacturaReviewPanel.tsx`, `services/supabase/migrations/202606191100_factura_aprobaciones.sql`, `..._192100_factura_pagos.sql`
- **Facturas emitidas (a ampliar):** `apps/modules/contabilidad/src/components/views/FacturasEmitidas.tsx`, `.../FacturaEmitidaEditor.tsx`, `services/supabase/migrations/20260521090100_facturas.sql`
- **Proyectos / presupuestos / análisis:** `apps/modules/presupuestos/src/components/DetalleProyecto.tsx`, `.../lib/proyectosApi.ts`, `.../lib/presupuestosApi.ts`, `.../lib/analisisFinanciero.ts`
- **Proyecto ↔ sociedad:** `services/supabase/migrations/20260525120000_proyectos_module.sql`, `..._20260529000000_proyecto_sociedades.sql`, `..._202606121000_estructura_societaria_real.sql`
- **Tipos / utils / ui / cliente:** `packages/types/src/{contabilidad,financial,presupuestos}.ts`, `packages/utils/src/{format,finance}`, `packages/ui/src/components/*`, `packages/supabase-client/src/index.ts`
- **Diseño clínica (otra línea):** `docs/reservas/00..04`, esp. `02-addendum-roles-pagos-disponibilidad.md` y `03-catalogo-tarifas-productos.md`

---

*Documento de auditoría. No modifica código productivo. Sujeto a validación de Guille antes de abrir Fase 1.*
