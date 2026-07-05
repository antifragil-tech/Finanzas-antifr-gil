# ADR 0001: Stack tecnológico inicial de Alsari Capital OS

- **Estado:** Aceptado
- **Fecha:** 2026-05-14
- **Decisores:** Guille (Director General), Claude (Arquitecto Técnico)

---

## Contexto

Alsari Capital necesita un ecosistema digital unificado que sustituya la dispersión
actual de hojas de cálculo, documentos sueltos en Drive y herramientas SaaS no
integradas. El sistema debe:

1. **Modularizar la operativa** del holding en herramientas dedicadas (financiero,
   facturas, proyectos, …) sin acoplarlas entre sí.
2. **Permitir crecimiento gradual:** añadir nuevos módulos sin reescribir nada.
3. **Tolerar fallos aislados:** un módulo roto no debe tirar el resto del OS.
4. **Aprovechar el stack ya conocido por Guille** (Supabase, React, Tailwind).
5. **Permitir desarrollo con Claude Code** (Antigravity como IDE).
6. **Mantener altos estándares de calidad técnica** sin sobre-ingeniería.

Guille tiene una app actual (Neural Finance V3.0) con 3 páginas (FinancialDashboard,
WorkspacePage, InvoicesPage) que constituye el embrión del Host OS. La identidad
visual "Quiet Luxury" (Dark Mode + crema + glassmorphism) ya está madura y se
mantiene.

---

## Decisión

Adoptamos el siguiente stack como base de Alsari Capital OS:

### Monorepo

- **pnpm workspaces** para gestión de paquetes.
- **Turborepo** como sistema de build con caché incremental.

### Host OS

- **Next.js 15** con App Router.
- **React 19** + **TypeScript estricto**.
- **Tailwind CSS 3** + **shadcn/ui** para componentes base.
- **Supabase Auth** para autenticación.
- **React Error Boundary** para aislar fallos de módulos.

### Módulos

- **Vite 5** como bundler.
- **React 19** + **TypeScript estricto**.
- **Tailwind CSS 3** + design system propio (`@alsari/ui`).
- **Zustand** para estado local del módulo.
- **Zod** para validación y tipos derivados.
- **React Router** para rutas internas del módulo.

### Backend

- **Supabase** (Postgres + Auth + Storage + Edge Functions).
- **Row Level Security** obligatorio en todas las tablas.
- **Migraciones SQL versionadas** en `services/supabase/migrations/`.

### Calidad

- **Vitest** + **Testing Library** para tests unit y de componente.
- **Playwright** para E2E.
- **ESLint** + **Prettier** + **prettier-plugin-tailwindcss**.
- **GitHub Actions** para CI (type-check, lint, format, test, build).

### Iconografía

- **Lucide React** como única librería de iconos.

### Desarrollo

- **Antigravity** como IDE.
- **Claude Code** como copiloto técnico con skills locales (`.claude/skills/*`).

---

## Alternativas consideradas

### 1. Nx en lugar de Turborepo

**Por qué se descartó:** Nx aporta más opinión y herramientas pero también más
complejidad inicial. Turborepo cubre nuestras necesidades (caché incremental,
pipelines paralelos) con configuración mínima. Si el proyecto crece y necesita
generators avanzados, podemos migrar; el coste de cambio es bajo.

### 2. Remix / TanStack Start en lugar de Next.js

**Por qué se descartó:** Next.js tiene el ecosistema más maduro y la documentación
más amplia, especialmente para autenticación con Supabase y deploy en Vercel. Remix
es excelente técnicamente pero el ecosistema de plantillas para nuestro caso de
uso es menor. TanStack Start está aún en fase muy temprana.

### 3. Una sola SPA monolítica (sin micro-frontends)

**Por qué se descartó:** Aunque sería más simple inicialmente, **no cumple el
requisito de tolerancia a fallos aislados**. Si la lógica del módulo de facturas
tiene un bug fatal, no queremos que se caiga el módulo financiero. La separación
en módulos independientes con Error Boundaries es el patrón que mejor protege
la disponibilidad operativa.

### 4. Convex / Firebase en lugar de Supabase

**Por qué se descartó:** Supabase ya es conocido por Guille (uso previo en
arquitecturas RAG vectorizadas con pgvector). Su SQL estándar facilita auditorías
y migraciones. Convex es prometedor pero introduce un modelo de datos propio
menos portable.

### 5. Tanstack Query / SWR para fetching

**Por qué se descartó (por ahora):** Para Fase 1 vamos con hooks simples. Si la
complejidad de cache aumenta (invalidaciones cruzadas, optimistic updates) lo
introduciremos en una ADR posterior. **YAGNI** mientras no haga falta.

### 6. Material UI / Mantine en lugar de Tailwind + shadcn/ui

**Por qué se descartó:** Las librerías con componentes fuertemente opinados
chocan con la estética "Quiet Luxury" que ya está definida. Tailwind + shadcn/ui
permite copiar/pegar componentes y adaptarlos sin lucha contra estilos heredados.

### 7. Redux Toolkit en lugar de Zustand

**Por qué se descartó:** Para el alcance actual (módulos pequeños y aislados),
Zustand es más liviano y ergonómico. Si un módulo crece a complejidad de estado
de tipo Redux, lo evaluamos en una ADR específica de ese módulo.

---

## Consecuencias

### Positivas

- **Onboarding rápido:** stack popular con buena documentación.
- **Velocidad de desarrollo:** Vite + HMR es instantáneo.
- **Modularidad real:** cada módulo es una app independiente.
- **Tolerancia a fallos:** Error Boundaries garantizan disponibilidad parcial.
- **Stack familiar:** Guille no parte de cero (Supabase, React, Tailwind ya conocidos).
- **TypeScript estricto** evita una clase entera de bugs.
- **CI/CD desde el primer día** mantiene calidad.

### Negativas / Riesgos

- **Curva inicial del monorepo:** pnpm workspaces + Turborepo requiere entender
  cómo se resuelven imports entre paquetes. Mitigado con `02-codigo.md` y plantilla
  de módulo.
- **Dos sistemas de routing distintos** (Next.js en Host + React Router en módulos).
  Aceptable: cada uno brilla en su contexto.
- **Acoplamiento al ecosistema Vercel/Supabase.** Aceptable: la portabilidad
  está limitada principalmente por Supabase (Postgres puro), no por Vercel.
- **Versiones muy recientes (React 19, Next 15):** posibles bugs tempranos.
  Mitigado fijando versiones exactas y haciendo upgrade controlado.

### Acciones derivadas

- [x] Crear `package.json` raíz con scripts orquestados.
- [x] Configurar `pnpm-workspace.yaml` y `turbo.json`.
- [x] Crear plantilla de módulo en `apps/modules/_template/`.
- [x] Configurar CI con type-check, lint, test, build.
- [ ] Migrar app actual de Guille a la nueva estructura (Fase 1 del ROADMAP).
- [ ] Configurar Supabase y schema inicial (Fase 2 del ROADMAP).

---

## Revisión

Este ADR se revisará si:

- Alguna versión mayor del stack (React 20, Next 16, Tailwind 4) introduce cambios
  incompatibles importantes.
- Aparece una alternativa significativamente mejor que el coste de migración
  justifique.
- El proyecto crece más allá de 10 módulos y la arquitectura actual no escala.
