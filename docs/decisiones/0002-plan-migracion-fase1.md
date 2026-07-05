# ADR 0002: Plan de migración Fase 1 — app actual → monorepo

- **Estado:** En curso
- **Fecha:** 2026-05-15
- **Decisores:** Guille (Director General), Claude (Arquitecto Técnico)

---

## Contexto

La app actual de Guille vive en `Financiero/alsari-finances-frontend/` como una
SPA monolítica (Vite + React). Tiene 4 rutas y un backend en Cloudflare Worker
corriendo en `:8787`:

| Archivo                               | Ruta          | Destino                                        |
| ------------------------------------- | ------------- | ---------------------------------------------- |
| `App.tsx`                             | —             | Boot screen + router → `apps/host`             |
| `LandingPage.tsx`                     | `/`           | → `apps/host`                                  |
| `FinancialDashboard.tsx`              | `/financiero` | → `apps/modules/financiero`                    |
| `WorkspacePage.tsx`                   | `/proyectos`  | → `apps/modules/proyectos`                     |
| `InvoicesPage.tsx`                    | `/facturas`   | → `apps/modules/facturas`                      |
| `Sidebar.tsx` + `DashboardLayout.tsx` | —             | → `apps/modules/financiero`                    |
| Vistas `views/*` + `CorporateMap`     | —             | → `apps/modules/financiero`                    |
| `InvoiceWorkflow.tsx`                 | —             | → `apps/modules/facturas`                      |
| `lib/utils.ts` (`cn`)                 | —             | → `packages/utils`                             |
| `lib/financialUtils.ts`               | —             | → `packages/utils` + `apps/modules/financiero` |
| `lib/types.ts`                        | —             | → `packages/types`                             |
| `index.css` (`.glass-panel`, etc.)    | —             | → `packages/ui`                                |

**Objetivo de Fase 1:** la app funciona exactamente igual para Guille, pero con
la estructura correcta del monorepo. **Cero cambios funcionales visibles.**

---

## Decisión arquitectónica clave: Opción A (módulos como paquetes React)

### Opción A — elegida ✅

Los módulos son componentes React que el Host importa como dependencias del
workspace. Cada módulo puede arrancarse en **standalone con Vite** (para desarrollo
aislado), pero en producción el Host (Next.js) los importa directamente y produce
un único build.

```
apps/host (Next.js)
  └── importa como dep de workspace:
       ├── @alsari/financiero  →  <FinancieroDashboard />
       ├── @alsari/proyectos   →  <ProyectosApp />
       └── @alsari/facturas    →  <FacturasApp />
```

**Ventajas:** simple, funciona desde el primer día, sin complejidad de
Module Federation.
**Limitación:** si un módulo falla en **build**, afecta al Host. El aislamiento
es a nivel de React (Error Boundaries), no a nivel de proceso/red.

### Opción B — descartada

Micro-frontends reales (Webpack Module Federation). Cada módulo es un despliegue
independiente cargado en runtime.

**Por qué se descartó:** complejidad de 2-3 semanas extra para Fase 1, sin
beneficio real con un único desarrollador. Aplazado a Fase 6 si el sistema
crece a más de 5 módulos en producción simultánea.

---

## Plan de ejecución — 8 pasos

### Paso 1 — `packages/utils` ✅ COMPLETADO (2026-05-15)

Extraídos de `lib/utils.ts` y `lib/financialUtils.ts`:

- `cn()`, `parseCurrency()`, `cleanNumber()`, `formatCurrency()`, `formatPercent()`
- Eliminados todos los `console.log` de debug del original
- `calculateConsolidatedData` queda en `apps/modules/financiero` (lógica de negocio)

### Paso 2 — `packages/types` ✅ COMPLETADO (2026-05-15)

Extraído de `lib/types.ts`, reorganizado por dominio:

- `financial.ts`: tipos del holding y dashboard
- `workspace.ts`: tipos del módulo proyectos
- `invoices.ts`: tipos del módulo facturas
- `interface` → `type` (convención del proyecto)
- `[key: string]: any` conservado con justificación hasta Fase 2 + Supabase schema

### Paso 3 — `packages/ui`: primitivos base

Extraer de `index.css`:

- `.glass-panel` y `.glass-header` como clases Tailwind o componente `<GlassPanel>`
- Scrollbar CSS, tokens de color
- `KPICard.tsx` entra en `packages/ui` si se comparte entre módulos;
  de lo contrario se queda en `financiero` y se promueve más adelante

### Paso 4 — `apps/host/`: shell Next.js

Crear el Host OS con:

- Boot screen (logo + "NEURAL FINANCE V3.0"), copiado de `App.tsx`
- Sidebar del OS: navegación entre módulos (Financiero / Proyectos / Facturas)
- Rutas: `/financiero`, `/proyectos`, `/facturas`
- Error Boundary por módulo
- Placeholders mientras llegan los módulos reales

### Paso 5 — `apps/modules/financiero/`

Migrar FinancialDashboard y todo su ecosistema:

- `FinancialDashboard.tsx` → `App.tsx` del módulo
- `DashboardLayout.tsx`, `Sidebar.tsx` (selector sociedad/holding), `views/*`, `CorporateMap.tsx`
- Imports actualizados: `lib/utils` → `@alsari/utils`, `lib/types` → `@alsari/types`
- Botón "Menú Principal" sustituido por navegación del Host OS

> **Nota:** el módulo financiero tiene su propio sidebar interior (selector de
> sociedad/holding). En Fase 1 coexiste con el sidebar del OS. Unificarlos es
> una tarea de diseño para después.

### Paso 6 — `apps/modules/proyectos/`

Migrar `views/Workspace.tsx` al módulo.
`WorkspacePage.tsx` desaparece (era solo un wrapper; el Host provee el layout).

### Paso 7 — `apps/modules/facturas/`

Migrar `InvoicesPage.tsx` + `InvoiceWorkflow.tsx`.
Las llamadas al CF Worker (`:8787`) se mantienen igual — backend intacto en Fase 1.

### Paso 8 — Verificación e integración final

- Comprobar las tres rutas del Host
- Verificar que el CF Worker responde correctamente
- Actualizar `docs/ARQUITECTURA.md` + `docs/CHANGELOG.md`
- Marcar ítems de Fase 1 como completados en `ROADMAP.md`

---

## Lo que NO se hace en Fase 1

- Backend intacto: CF Worker sigue en `:8787` (se migra a Supabase en Fase 2)
- No se refactoriza la lógica de negocio (`calculateConsolidatedData`, normalización de proyectos)
- No se añaden Zod schemas (los `[key: string]: any` se limpian en Fase 2)
- No se añade autenticación (Fase 2)
- No se cambia ninguna funcionalidad visible para Guille

---

## Consecuencias

### Positivas

- App actual funciona igual que antes, con arquitectura correcta
- Cada módulo arranca en standalone para desarrollo aislado
- Los packages (`@alsari/utils`, `@alsari/types`) son la única fuente de verdad
  para utilities y tipos del holding
- Error Boundaries garantizan que un fallo en un módulo no tumba los demás

### Negativas / Riesgos

- El módulo financiero tiene su propio sidebar interior que coexiste con el
  sidebar del OS. Puede resultar confuso visualmente hasta que se unifiquen.
- El CF Worker como backend es temporal. En Fase 2 habrá que reemplazar todas
  las llamadas `fetch('http://localhost:8787/...')` por queries a Supabase.

---

## Revisión

Este ADR se cierra cuando el Paso 8 esté completado y los ítems de Fase 1 en
`ROADMAP.md` estén todos marcados como ✅.
