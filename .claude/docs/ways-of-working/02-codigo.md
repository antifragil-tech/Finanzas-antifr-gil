# 02 · Código

> Convenciones de estilo, naming y estructura para todo el código del OS.

---

## 🎯 Filosofía

> *"Legible primero, óptimo después. Si no es legible, no es óptimo."*

El código de Alsari OS lo leerá Claude muchas más veces de las que lo escribirá. Y
Guille, sin ser técnico, debe poder seguir el flujo general de un componente o función.

---

## 📐 TypeScript

### Configuración base
- `"strict": true` siempre.
- `"noUnusedLocals": true`, `"noUnusedParameters": true`.
- `"noUncheckedIndexedAccess": true` (evita errores con arrays/objetos).
- `"verbatimModuleSyntax": true`.

### Reglas
1. **Nunca `any`.** Si lo necesitas, usa `unknown` y haz type guards. Si realmente
   no hay alternativa, comenta `// any-justificado: <razón>`.
2. **Tipos explícitos en APIs públicas** (funciones exportadas, props de componentes).
   En internos, deja que TS infiera.
3. **Prefiere `type` sobre `interface`** salvo cuando necesites declaración merging.
4. **Zod para datos externos** (APIs, formularios, .env). El tipo se deriva del schema:

```typescript
const UserSchema = z.object({ id: z.string().uuid(), name: z.string() });
type User = z.infer<typeof UserSchema>;
```

5. **Discriminated unions** para estados:

```typescript
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: string };
```

---

## 🏷️ Naming

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Variables y funciones | `camelCase` | `getUserById`, `monthlyRevenue` |
| Componentes React | `PascalCase` | `FinancialDashboard`, `SidebarNav` |
| Tipos y enums | `PascalCase` | `type Revenue`, `enum Status` |
| Constantes globales | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_TIMEOUT_MS` |
| Archivos de componente | `PascalCase.tsx` | `FinancialDashboard.tsx` |
| Archivos utilitarios | `camelCase.ts` | `formatCurrency.ts` |
| Carpetas | `kebab-case` | `error-boundary/`, `module-loader/` |
| CSS classes (custom) | `kebab-case` | `.glass-panel`, `.boot-screen` |
| Variables Tailwind / tokens | `kebab-case` | `--color-accent`, `bg-zinc-950` |
| Archivos de test | `*.test.ts` o `*.spec.ts` | `formatCurrency.test.ts` |

### Naming de funciones

- **Verbos de acción:** `get`, `set`, `create`, `update`, `delete`, `fetch`, `parse`, `validate`, `format`, `calculate`.
- **Booleans:** `is`, `has`, `should`, `can` → `isLoading`, `hasPermission`, `shouldRender`.
- **Event handlers:** `handle` o `on` → `handleSubmit`, `onUserClick`.
- **Hooks:** empiezan por `use` → `useFinancialData`, `useModuleAuth`.

---

## 📁 Estructura de archivos

### Un componente por archivo (regla general)
Si un archivo tiene >300 líneas o >1 componente exportado, replantéate la separación.

### Co-ubicación
Mantén juntos los archivos que cambian juntos:

```
components/FinancialDashboard/
├── FinancialDashboard.tsx
├── FinancialDashboard.test.tsx
├── FinancialDashboard.module.css   # solo si necesitas CSS extra
├── KPICard.tsx                     # subcomponente solo usado aquí
└── index.ts                        # reexporta el componente principal
```

### Barrel exports (`index.ts`)
Usa `index.ts` para exponer la API pública de una carpeta. Internamente puedes tener
muchos archivos; desde fuera se importa así:

```typescript
import { FinancialDashboard } from '@/components/FinancialDashboard';
```

---

## ⚛️ Componentes React

### Estructura interna de un componente

```typescript
// 1. Imports (orden: React → librerías → internos → tipos)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@alsari/types';

// 2. Tipos y schemas
type Props = {
  userId: string;
  onUpdate?: (user: User) => void;
};

// 3. Componente
export function UserCard({ userId, onUpdate }: Props) {
  // 3a. Hooks (estado primero, derivados después)
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useAuth();

  // 3b. Efectos
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  // 3c. Handlers
  const handleSave = () => { /* ... */ };

  // 3d. Early returns
  if (!user) return <Skeleton />;

  // 3e. Render
  return <div className="glass-panel">...</div>;
}
```

### Reglas

1. **Funciones, no clases.** `export function MyComponent()` siempre.
2. **Props tipadas explícitamente** (nunca infiere props desde uso).
3. **Default exports prohibidos** salvo para páginas de Next.js (que lo exigen).
4. **Hooks personalizados** para lógica reutilizable. Si un componente tiene >3
   `useEffect`, probablemente necesita un hook custom.
5. **Memo solo si lo mides.** No `React.memo` por defecto.

---

## 🎨 Estilos con Tailwind

### Reglas
1. **Tailwind first.** Solo CSS custom para cosas que Tailwind no permite limpiamente.
2. **Clases ordenadas** (Prettier plugin `prettier-plugin-tailwindcss` activado).
3. **Variantes de color desde tokens.** Nada de colores hex sueltos en el JSX:
   ✅ `bg-zinc-950`
   ❌ `bg-[#09090b]` (salvo casos excepcionales documentados)
4. **`cn()` para clases condicionales** (utility en `packages/utils`):

```typescript
<div className={cn(
  "rounded-lg p-4",
  isActive && "bg-zinc-900",
  isError && "border border-red-500/50"
)} />
```

5. **Componentes "glass" reutilizables** con clases custom en `index.css`:
   - `.glass-panel` → panel con backdrop blur
   - `.glass-header` → header con blur intenso
   Detalle en `04-ui-ux.md`.

---

## 🪝 Hooks personalizados

### Reglas
1. **Un hook = una responsabilidad.** Si un hook devuelve >5 cosas, sepáralo.
2. **Tipo de retorno explícito** en la firma del hook.
3. **Manejo de errores incluido.** Un hook que hace fetch debe devolver `{ data, loading, error }`.
4. **No mezclar UI con lógica de datos.** Los hooks de datos no deciden cómo se renderizan.

### Ejemplo

```typescript
type UseRevenueResult = {
  data: Revenue[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useMonthlyRevenue(year: number): UseRevenueResult {
  // implementación
}
```

---

## 📦 Imports

### Orden (Prettier lo formatea automáticamente)
1. React y librerías externas
2. Imports absolutos del proyecto (`@/components/...`, `@alsari/ui`)
3. Imports relativos
4. Tipos (`import type ...`)
5. Estilos (`import './styles.css'`)

### Alias
- `@/` → raíz de `src/` del módulo o `apps/host`.
- `@alsari/ui` → `packages/ui`.
- `@alsari/utils` → `packages/utils`.
- `@alsari/types` → `packages/types`.
- `@alsari/supabase-client` → `packages/supabase-client`.
- `@alsari/config` → `packages/config`.

---

## 🚨 Manejo de errores

### Reglas
1. **Errores tipados.** Lanza `Error` o subclases, nunca strings.
2. **Captura cerca del origen, propaga si no puedes manejar.**
3. **UI siempre tiene fallback.** Cada componente que hace fetch tiene estado de error.
4. **Logs estructurados** (no `console.log` en producción; usa logger central — a
   definir cuando montemos observabilidad).

```typescript
class FinancialDataError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'FinancialDataError';
  }
}
```

---

## 📏 Métricas de calidad (objetivos)

| Métrica | Objetivo |
|---------|----------|
| Líneas por archivo | < 300 (alarma a 500) |
| Funciones por archivo | < 5 (excluye sub-componentes) |
| Niveles de anidación | < 4 |
| Argumentos por función | < 4 (si más, usa objeto) |
| Cobertura tests (utilidades críticas) | > 80% |
| Cobertura tests (componentes) | > 50% |

---

## 🧪 Comentarios

### Cuándo comentar
- **Por qué**, no qué. El código ya dice qué hace.
- **Decisiones no obvias** ("usamos timestamp en lugar de ID porque...").
- **Workarounds temporales** con TODO y referencia a issue.
- **Fórmulas financieras complejas** con la fórmula matemática real arriba.

### Cuándo NO comentar
- Repetir lo que dice el código (`// incrementa i en 1` para `i++`).
- Documentación de funciones públicas → usa **JSDoc** (`/** ... */`) en su lugar.

```typescript
/**
 * Calcula la TIR (Tasa Interna de Retorno) usando el método de Newton-Raphson.
 *
 * Fórmula: 0 = Σ [CFt / (1+TIR)^t]
 *
 * @param cashFlows - Array de flujos de caja, posición 0 = inversión inicial (negativa).
 * @param guess - Estimación inicial (default 0.1).
 * @returns TIR como decimal (0.15 = 15%).
 * @throws Si no converge en 100 iteraciones.
 */
export function calculateIRR(cashFlows: number[], guess = 0.1): number {
  // ...
}
```
