# 06 · Testing

> Estrategia de testing para Alsari Capital OS.

---

## 🎯 Filosofía

> *"Testea lo que más duele si se rompe. Lo demás, cuando sea barato hacerlo."*

No buscamos el 100% de cobertura. Buscamos **confianza en lo crítico**:
- Cálculos financieros → cobertura alta (>90%).
- Lógica de negocio compleja → cobertura alta (>80%).
- Componentes de UI → cobertura media (>50%, foco en estados clave).
- Helpers triviales → opcional.

---

## 🧰 Stack

| Tipo de test | Herramienta | Cuándo se ejecuta |
|--------------|-------------|-------------------|
| Unit | **Vitest** | En cada commit (pre-commit hook) y en CI |
| Component | **Vitest + Testing Library** | En cada commit y CI |
| Integration | **Vitest** | En CI |
| E2E | **Playwright** | En CI + manual antes de releases |
| Visual regression | **Playwright screenshots** | Manual + CI en releases |
| Type checking | **tsc --noEmit** | En cada commit y CI |
| Lint | **ESLint** | En cada commit y CI |

---

## 📂 Convenciones

### Ubicación de tests

**Co-ubicados** con el código que testean:

```
src/
├── components/
│   ├── KPICard.tsx
│   └── KPICard.test.tsx        ← Test del componente, al lado
├── lib/
│   ├── calculateIRR.ts
│   └── calculateIRR.test.ts
```

**Excepción:** tests E2E van en `tests/e2e/` en la raíz del módulo o del Host.

### Naming

- `*.test.ts` para unit/integration.
- `*.test.tsx` para component tests.
- `*.spec.ts` para E2E (Playwright).

### Estructura de un test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('calculateIRR', () => {
  it('devuelve la TIR correcta para un flujo estándar', () => {
    const cashFlows = [-1000, 300, 400, 500];
    const irr = calculateIRR(cashFlows);
    expect(irr).toBeCloseTo(0.0871, 4);
  });

  it('lanza error si no converge', () => {
    const cashFlows = [-1000, -100, -100];
    expect(() => calculateIRR(cashFlows)).toThrow();
  });

  it('maneja flujos con solo dos valores', () => {
    // ...
  });
});
```

### Reglas

1. **Un `describe` por unidad** (función o componente).
2. **Un `it` por escenario.** Nunca un `it` que prueba 5 cosas.
3. **AAA pattern:** Arrange → Act → Assert. Visible en el código.
4. **Nombres descriptivos en presente indicativo** ("devuelve...", "lanza...", "renderiza...").
5. **Tests independientes:** un test no puede depender del orden de ejecución.
6. **Mocks mínimos:** solo lo justo. Tests con 20 mocks suelen testear el mock, no el código.

---

## 🧪 Qué se testea (por capa)

### Capa de utilidades (`packages/utils`, `src/lib/`)

**Cobertura objetivo: >90%.**

Funciones puras que reciben datos y devuelven datos. Son las más fáciles de testear
y las más críticas si fallan (un cálculo de EBITDA mal afecta a todos los reportes).

Casos a cubrir:
- Camino feliz (input típico).
- Bordes (input vacío, mínimo, máximo).
- Errores (input inválido).
- Precisión numérica (especialmente en financieras).

### Capa de hooks (`src/hooks/`)

Tests con `renderHook` de Testing Library:

```typescript
import { renderHook, waitFor } from '@testing-library/react';

it('useMonthlyRevenue carga datos al montar', async () => {
  const { result } = renderHook(() => useMonthlyRevenue(2026));

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toHaveLength(12);
  });
});
```

### Capa de componentes (`src/components/`)

Tests focalizados en **comportamiento, no implementación**.

```typescript
it('KPICard muestra trend positivo en verde', () => {
  render(<KPICard label="Ingresos" value={1000} trend={0.12} />);

  const trend = screen.getByText(/\+12/);
  expect(trend).toHaveClass('text-emerald-500');
});
```

**Reglas:**
- Consulta por roles (`getByRole`) y texto (`getByText`), no por clases o IDs.
- Simula interacciones reales con `userEvent`, no `fireEvent` (más realista).
- No testees implementaciones internas (`useState` específicos, etc.).

### Capa de API (`src/api/`)

- **Unit:** lógica de transformación de datos.
- **Integration:** llamadas reales a Supabase contra instancia de **test** (nunca prod).

### E2E (flujos críticos)

Pocos tests, pero los que importan:
- Login → llegar al dashboard.
- Crear factura → aparece en el listado.
- Cálculo de KPI principal en cada módulo.

---

## 🚦 Comandos

```bash
# Tests unitarios y de componente (Vitest)
pnpm test                    # Modo watch
pnpm test:run                # Una sola pasada (CI)
pnpm test:coverage           # Con reporte de cobertura

# Solo un módulo
pnpm --filter financiero test

# E2E
pnpm test:e2e                # Lanza Playwright

# Type-check
pnpm type-check

# Lint
pnpm lint
pnpm lint:fix
```

---

## 🔄 CI/CD

### Pipeline (GitHub Actions, `.github/workflows/ci.yml`)

En cada PR a `main`:
1. Install dependencies (con caché).
2. Type-check (`tsc --noEmit`).
3. Lint (`eslint`).
4. Tests unitarios + componente (`vitest run --coverage`).
5. Build de todos los módulos.
6. (Opcional) E2E en navegador headless.

**Si cualquier paso falla, el PR no se puede mergear.**

---

## 📊 Cobertura

Mínimos exigidos para mergear a `main`:

| Categoría | Cobertura mínima |
|-----------|------------------|
| `packages/utils/` (cálculos financieros) | 90% |
| `src/lib/` de módulos | 80% |
| `src/hooks/` | 70% |
| `src/components/` | 50% |
| `src/api/` | 60% |
| Global del módulo | 60% |

Los umbrales se configuran en `vitest.config.ts` y CI los aplica.

---

## 🎭 Mocking

### Cuándo mockear

- **APIs externas:** siempre en unit tests.
- **Tiempo (`Date.now()`)**: mockear con `vi.setSystemTime()` cuando el test depende
  de la fecha.
- **Supabase:** mockear en unit; usar instancia real en integration.
- **Hooks pesados:** mockear con `vi.mock()`.

### Cuándo NO mockear

- Funciones puras del propio módulo. Si una función es pura, llámala directamente.
- Componentes hijos triviales (un `<Spinner />` no necesita mock).

---

## ⚠️ Anti-patrones prohibidos

1. ❌ Tests que dependen del orden de ejecución.
2. ❌ Tests que tocan red real, BD real o filesystem real (excepto integration/E2E
   marcados explícitamente).
3. ❌ Tests con `setTimeout` para "esperar" — usa `waitFor` o `vi.useFakeTimers`.
4. ❌ Tests sin `expect` (test que pasa pero no prueba nada).
5. ❌ Comentar tests rotos para que pasen. Si está roto, se arregla o se borra con
   comentario justificando por qué.
6. ❌ `skip` permanente. Un test skipeado >1 semana se borra o se arregla.

---

## ✅ Checklist antes de mergear

- [ ] Tests nuevos para código nuevo (especialmente cálculos).
- [ ] Tests existentes pasan en local.
- [ ] Cobertura no baja respecto a `main`.
- [ ] No hay `console.log` ni `it.only` ni `describe.only`.
- [ ] CI en verde.
