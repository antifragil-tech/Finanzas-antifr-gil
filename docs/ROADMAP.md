# Roadmap — Alsari Capital OS

> Declaración priorizada de intenciones.
> **No es un compromiso de fechas.** Es el orden actual en el que queremos avanzar.
> Guille marca prioridades; Claude propone detalles técnicos.
> Documento **ejecutivo**: el detalle técnico vive en `ARQUITECTURA.md` y `CHANGELOG.md`.

**Última revisión:** 2026-06-19 · OS con 3 módulos productivos sobre Supabase (Financiero, Contabilidad, Proyectos/Presupuestos).

---

## 🎯 Visión a 12 meses

Un **OS funcional con 3 módulos productivos** — **Financiero**, **Contabilidad** y **Proyectos/Presupuestos** — que cubran la operativa diaria del holding sobre Supabase, con un **flujo de facturas completo** (recepción → validación → pago → archivo → gestoría), sistema de aprendizaje maduro y deuda técnica mínima.

> El plan original hablaba de "financiero, facturas, proyectos". La realidad evolucionó: **Facturas vive ahora dentro de Contabilidad** (el módulo `@alsari/facturas` está archivado) y el tab **"Proyectos" carga el módulo Presupuestos**.

---

## 🧭 Estado actual (de un vistazo)

| Tab del OS   | Paquete técnico        | Capa de datos | Estado                                                               |
| ------------ | ---------------------- | ------------- | -------------------------------------------------------------------- |
| Financiero   | `@alsari/financiero`   | Supabase      | ✅ Productivo                                                        |
| Contabilidad | `@alsari/contabilidad` | Supabase      | ✅ Productivo · flujo de facturas en ampliación                      |
| Proyectos    | `@alsari/presupuestos` | Supabase      | ⚡ Base financiera lista · Proyectos inmobiliario dedicado pendiente |
| (Facturas)   | `@alsari/facturas`     | —             | 🗄️ Archivado · `/facturas → /contabilidad`                           |

**Supabase ya es la capa de datos** de los módulos vivos. El stack legacy (CF Worker + Google Sheets + IMAP/Drive) **no está conectado al flujo vivo** y queda para decommission.

---

## 🛣️ Fases

### Fase 0 — Cimientos ✅ COMPLETADA

Monorepo, Ways of Working, skills de Claude, CI/CD básico, sistema de aprendizaje vivo, documentación maestra inicial.

### Fase 1 — Migración del código al monorepo ✅ COMPLETADA (2026-05-16)

La app actual de Guille se movió al monorepo con la arquitectura correcta: `packages/utils`, `packages/types`, `packages/ui`, Host OS (Next.js) y los módulos integrados vía `transpilePackages`. Plan: `docs/decisiones/0002-plan-migracion-fase1.md`.

### Fase 2 — Autenticación + Host OS ✅ COMPLETADA (2026-05-17)

Supabase Auth + middleware + route group, login Quiet Luxury, home launcher, sidebar, governance docs por módulo y limpieza estructural.

> El plan preveía aplazar **todos** los datos a Supabase hasta el final. En la práctica la capa de datos Supabase llegó antes, módulo a módulo (ver Fases 3-5). Por eso la antigua "Fase N — primera migración" se reescribe abajo como **consolidación**, no como migración inicial.

### Fase 3 — Módulo Financiero ✅ COMPLETADA

Dashboard financiero vivo sobre Supabase: KPIs consolidados del holding, vista por entidad, mapa corporativo, patrimonio (sociedades/personas), préstamos intragrupo y workspace semanal.

### Fase 4 — Módulo Contabilidad ✅ COMPLETADA y EN AMPLIACIÓN

> Reemplaza y supera el antiguo plan de "Módulo Facturas". `@alsari/contabilidad` absorbió las facturas.

**Base (2026-05-21):** facturas recibidas con OCR (Claude Vision vía Edge Function), workflow de aprobación multi-paso, conciliación bancaria, importación de extractos CSV, categorización automática con aprendizaje, asientos PGC y diario borrador. Datos en Supabase (RLS + Edge Functions).

**Refuerzos del flujo de facturas (2026-06):**

- ✅ **PR A** — saneamiento de estados (estados técnicos canónicos, labels en fuente única, `notifications_enabled`).
- ✅ **PR B** — trazabilidad/auditoría inmutable (`factura_aprobaciones`) con RPC atómica y autorización rol→acción.
- ✅ **PR A2** — Storage privado de facturas (`storage_path` + bucket privado + signed URLs).
- ✅ Módulo antiguo `@alsari/facturas` **archivado**; `/facturas → /contabilidad`.

**Próximos pasos del flujo → ver "Flujo de facturas" más abajo.**

**Pendiente (no ligado al flujo de facturas):** UI de facturas emitidas, importación de asientos oficiales (A3/Sage/CSV), matching factura ↔ movimiento bancario, export para gestoría.

### Fase 5 — Proyectos / Presupuestos ⚡ PARCIAL

**Módulo actual** = `@alsari/presupuestos` (el tab del OS se llama **"Proyectos"**). Hoy es la **base financiera de los proyectos**:

- presupuesto; ingresos/gastos; cashflow; análisis financiero; escenarios; **Números**; export **PDF** (dossier de inversión); seguimiento económico; OKRs/tareas.

**Futuro — módulo "Proyectos" inmobiliario/operativo dedicado** (fase aparte, aún sin construir):

- hitos; stakeholders; documentación; licencias; contratos; unidades; cronograma; riesgos.

> Decisión: **dos módulos**. El financiero (Presupuestos) ya existe; el operativo inmobiliario (Proyectos) es futuro. No se renombra el tab ni se tocan rutas por ahora (ver Deuda técnica).

### Fase 6 — Ecosistema MCP y automatización (pendiente)

MCP propio para consultar el OS desde Claude.ai y reportes automáticos. **Gmail y Drive ya no viven aquí**: entran como parte del flujo de facturas (PR D y PR H).

### Fase 7 — Módulos futuros (backlog priorizable)

Tesorería en tiempo real, Contratos (repositorio + alertas), portal de Socios, CENS / Antifrágil si requieren herramienta dedicada.

### Fase N — Consolidación Supabase + decommission legacy (pendiente)

> **Ya no es "la primera migración"**: Financiero, Contabilidad y Presupuestos ya corren sobre Supabase. Lo que queda es endurecer y retirar lo viejo.

- Hardening de RLS + tests de políticas en todas las tablas.
- Historial de migraciones por CLI (`supabase db push`) en vez de aplicación manual vía Management API.
- Tipos TypeScript autogenerados desde Supabase.
- Decommission del CF Worker + Google Sheets + IMAP/Drive legacy no usados.
- MFA para admins.

---

## 🧾 Flujo de facturas — próximos pasos

**Base ya en producción:** recepción OCR → validación Guille → (revisión Javi si supera umbral) → pendiente de pago → pagada/rechazada, con trazabilidad inmutable y PDF en Storage privado.

| Orden | PR                        | Alcance                                                                                 |
| ----- | ------------------------- | --------------------------------------------------------------------------------------- |
| 1     | **PR C**                  | Pagos parciales + justificantes + comparación de importes + incidencias sobre/infrapago |
| 2     | **PR D**                  | Drive documental (archivo oficial)                                                      |
| 3     | **PR E**                  | Proveedores recurrentes / domiciliadas                                                  |
| 4     | **PR H**                  | Gmail `administracion@alsari.net` (entrada de facturas por email)                       |
| ∥     | **PR A2-bis**             | Privatizar el bucket `proyecto-documentos` (seguridad documental, en paralelo)          |
| Final | **Notificaciones reales** | Emails a Javi/Alicia: `notifications_enabled` + correos distintos por persona           |

> Principios: la app es el **motor de workflow**; **Drive** = archivo oficial; **Supabase** = metadatos/estados/enlaces; el OCR **propone**, no contabiliza en firme; **sin pagos bancarios reales**; las **notificaciones reales solo en la fase final**. (Letras F y G reservadas, sin asignar.)

---

## 🚧 Deuda técnica acumulada

| Deuda                                        | Nota                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prettier repo-wide (#37)**                 | El Quality Gate de CI falla solo en `format:check` (~211 archivos). Merges con admin override hasta saldarla.                                 |
| **`proyecto-documentos` público**            | Único bucket público real con datos sensibles → **PR A2-bis**.                                                                                |
| **Migraciones aplicadas a mano**             | Se aplican vía Management API; sin historial CLI / `supabase db push`.                                                                        |
| **Modo single-operator**                     | Los 3 correos (Guille/Javi/Alicia) coinciden → la matriz rol→acción queda bypaseada hasta poner emails reales distintos.                      |
| **Facturas antiguas sin PDF**                | 16 facturas previas sin documento persistido (solo drop manual).                                                                              |
| **Legacy CF Worker / Sheets / IMAP / Drive** | No conectado al flujo vivo; pendiente de decommission.                                                                                        |
| **Naming Proyectos/Presupuestos**            | El tab se llama _Proyectos_ pero el paquete técnico es `@alsari/presupuestos`; decidir más adelante si se renombra, se separa o se consolida. |

---

## 💡 Ideas a evaluar

- Notificaciones push para alertas críticas (vencimientos, alertas bancarias).
- Modo offline-first en el Host OS (PWA) para acceso desde móvil sin conexión.
- IA generativa para resumir hilos largos de email del holding.
- Conexión con la API de la AEAT para presentaciones automáticas (largo plazo).

---

## 🔄 Cómo se actualiza este roadmap

1. **Mensualmente** Guille revisa prioridades y mueve items entre fases.
2. **En cada fase completada**, Claude mueve los items a `CHANGELOG.md` y limpia esta lista.
3. **Nuevas ideas** van al final, sección "Ideas a evaluar", hasta que se priorizan.
