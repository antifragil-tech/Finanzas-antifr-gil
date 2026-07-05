# Packages — Código compartido

> Librerías internas reutilizadas por el Host OS y por los módulos.
> Son hojas del grafo de dependencias: **no importan de `apps/host/` ni de
> `apps/modules/`**.

---

## 📦 Packages disponibles

| Package                   | Propósito                                      | Estado       |
| ------------------------- | ---------------------------------------------- | ------------ |
| `@alsari/ui`              | Design System: componentes Quiet Luxury        | 🚧 Pendiente |
| `@alsari/utils`           | Utilidades puras (formatCurrency, cn, helpers) | 🚧 Pendiente |
| `@alsari/types`           | Tipos y schemas Zod canónicos                  | 🚧 Pendiente |
| `@alsari/config`          | Configs compartidas (TS, ESLint, Tailwind)     | 🚧 Pendiente |
| `@alsari/supabase-client` | Cliente Supabase tipado                        | 🚧 Pendiente |

---

## 🛠️ Cómo crear un nuevo package

Reglas:

1. El nombre va siempre con scope `@alsari/...`.
2. `package.json` con `"private": true` y `"type": "module"`.
3. `tsconfig.json` que extiende del raíz.
4. Exportaciones limpias desde `src/index.ts` (barrel export).
5. Documentación mínima en `README.md`.
6. Tests en el propio package (`*.test.ts` co-ubicados).

---

## 🚫 Reglas duras

- Un package NO importa de otro package, salvo dependencias explícitas declaradas
  en `package.json`.
- Un package NO sabe nada de Next.js, Vite, ni de módulos concretos. Es agnóstico.
- Si una utilidad solo se usa en un módulo, **vive en ese módulo**, no aquí.
- Si una utilidad se usa en 2+ módulos, **debe** vivir aquí.
