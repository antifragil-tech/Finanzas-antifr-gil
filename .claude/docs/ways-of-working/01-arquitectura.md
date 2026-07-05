# 01 · Arquitectura

> Reglas supremas de cómo se estructura el código de Alsari Capital OS.

---

## 🎯 Principios fundamentales

### 1. Tolerancia a fallos aislados

Si un módulo cae, el resto del OS sigue funcionando. Esto se consigue con:

- **Error Boundaries de React** envolviendo cada módulo en el Host OS.
- **Datos aislados:** cada módulo gestiona sus propias queries a Supabase.
- **Despliegues independientes:** un bug en `facturas` no requiere desplegar `financiero`.

### 2. Convención sobre configuración

Antes de inventar una estructura nueva, busca si ya hay un patrón documentado en este
proyecto o en la plantilla `apps/modules/_template`. La consistencia ahorra dolor.

### 3. Tipos primero

TypeScript estricto en todo. Si algo no se puede tipar, es síntoma de que la abstracción
está mal. Nunca `any` salvo justificación documentada en comentario.

### 4. Composición sobre herencia

Componentes pequeños y reutilizables. Hooks para lógica. Nada de clases ni jerarquías
complejas.

### 5. Boundaries claros

- **`apps/host`** no conoce la lógica interna de los módulos. Solo los carga.
- **`apps/modules/[x]`** no importan código de otros módulos. Si necesitan algo común,
  va a `packages/`.
- **`packages/`** no importan de `apps/`. Son hojas del grafo.

---

## 🏗️ Arquitectura de alto nivel

### Stack tecnológico

| Capa              | Tecnología                                        | Razón                                            |
| ----------------- | ------------------------------------------------- | ------------------------------------------------ |
| Monorepo          | pnpm workspaces + Turborepo                       | Caché incremental, builds rápidos, estándar 2026 |
| Host OS           | Next.js 15 (App Router)                           | SSR, routing maduro, ecosistema sólido           |
| Módulos           | Vite + React 19 + TypeScript                      | Builds rápidos, HMR instantáneo, simplicidad     |
| Estilos           | Tailwind CSS 3 + shadcn/ui                        | Design tokens, Dark Mode nativo, sin lock-in     |
| Estado local      | React state + Zustand                             | Ligero, sin Redux overhead                       |
| Validación        | Zod                                               | Tipos y validación en un solo sitio              |
| Backend           | Supabase (Postgres + Auth + RLS + Edge Functions) | Stack que ya conoces                             |
| Routing           | React Router (en módulos) + Next.js (en Host)     | Cada uno donde brilla                            |
| Tests             | Vitest + Testing Library + Playwright             | Stack moderno y rápido                           |
| Tipos compartidos | `@alsari/types`                                   | Una fuente de verdad                             |

### Diagrama de dependencias permitidas

```
apps/host          ──depende-de──> packages/*
apps/modules/*     ──depende-de──> packages/*
apps/modules/*     ──NO-depende-de──> otros apps/modules/*
apps/modules/*     ──NO-depende-de──> apps/host
packages/*         ──NO-depende-de──> apps/* (solo otras packages internas)
```

---

## 📂 Estructura de un módulo (obligatoria)

Todo módulo dentro de `apps/modules/` debe tener esta estructura mínima:

```
apps/modules/[nombre]/
├── CLAUDE.md                          # Contexto local para Claude
├── README.md                          # Qué hace este módulo
├── ARQUITECTURA.md                    # Decisiones técnicas locales
├── CHANGELOG.md                       # Historial de cambios del módulo
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .claude/skills/lessons-learned/
│   ├── SKILL.md
│   └── log.md                         # Lecciones específicas de este módulo
├── ways-of-working-local/             # Reglas específicas del módulo
│   ├── README.md
│   ├── 01-modelo-datos.md
│   └── 02-reglas-negocio.md
├── src/
│   ├── components/                    # Componentes React del módulo
│   ├── hooks/                         # Hooks custom
│   ├── lib/                           # Utilidades no-UI (cálculos, helpers)
│   ├── pages/                         # Páginas/vistas
│   ├── stores/                        # Zustand stores
│   ├── types/                         # Tipos TS específicos del módulo
│   ├── api/                           # Llamadas a Supabase/APIs
│   ├── App.tsx
│   └── main.tsx
├── tests/
└── public/
```

---

## 🧩 Cómo se conectan Host y Módulos

El Host OS expone un **registro de módulos** (`apps/host/lib/module-registry.ts`).
Cada entrada del registro define:

```typescript
type ModuleEntry = {
  slug: string; // "financiero", "facturas", etc.
  title: string; // Nombre visible en sidebar
  icon: LucideIcon; // Icono
  description: string; // Descripción corta
  loader: () => Promise<ReactComponent>; // Lazy load del módulo
  permissions?: string[]; // Opcional: roles que pueden acceder
};
```

El Host renderiza cada módulo dentro de un Error Boundary que:

1. Captura cualquier error de render.
2. Muestra un panel de fallback elegante.
3. Permite al usuario navegar a otro módulo sin perder sesión.

---

## 🔐 Capa de datos

### Reglas

1. **Cada módulo tiene su propio schema en Supabase** (`financiero`, `facturas`, etc.).
2. **Row Level Security (RLS) activado en todas las tablas.**
3. **Las queries van encapsuladas en `src/api/`** dentro de cada módulo. No queries
   sueltas en componentes.
4. **El cliente Supabase es compartido** desde `@alsari/supabase-client`.
5. **Migraciones SQL versionadas** en `services/supabase/migrations/` con formato
   `YYYYMMDDHHmm_descripcion.sql`.

### Patrón de query

```typescript
// apps/modules/financiero/src/api/getMonthlyRevenue.ts
import { supabase } from '@alsari/supabase-client';
import { z } from 'zod';

const RevenueSchema = z.object({
  month: z.string(),
  amount: z.number(),
  entity_id: z.string().uuid(),
});

export type Revenue = z.infer<typeof RevenueSchema>;

export async function getMonthlyRevenue(year: number): Promise<Revenue[]> {
  const { data, error } = await supabase
    .from('financiero.monthly_revenue')
    .select('*')
    .eq('year', year);

  if (error) throw new Error(`Failed to fetch revenue: ${error.message}`);
  return z.array(RevenueSchema).parse(data);
}
```

---

## 🚫 Anti-patrones prohibidos

- ❌ Lógica de negocio en componentes de UI.
- ❌ Imports cruzados entre módulos.
- ❌ Estado global compartido entre módulos (usa eventos o BD si necesitas comunicar).
- ❌ Cálculos financieros duplicados en varios sitios → todo a `@alsari/utils`.
- ❌ Hard-coded strings de configuración → variables de entorno.
- ❌ `any` sin justificación documentada.
- ❌ Componentes >300 líneas → es síntoma de necesitar separar.

---

## 📝 Cuándo escribir un ADR

Cualquier decisión que **no se puede cambiar fácilmente** o que **afecta a múltiples
módulos** debe documentarse como ADR (Architecture Decision Record) en
`docs/decisiones/NNNN-titulo.md`.

Ejemplos que SÍ requieren ADR:

- Cambiar de Supabase a otra BD.
- Añadir un nuevo lenguaje al stack.
- Establecer un patrón de autenticación.
- Decidir entre SSR y CSR para una vista crítica.

Ejemplos que NO requieren ADR:

- Renombrar una variable.
- Refactor interno de un módulo.
- Añadir una nueva ruta a un módulo existente.

Plantilla en `docs/decisiones/0001-stack-tecnico.md` (la primera, ya creada).
