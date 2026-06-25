# Módulo `[NOMBRE]`

> [Descripción de 1 línea de qué hace este módulo en el OS.]

---

## 🎯 Responsabilidades

- ...
- ...

---

## 🛠️ Stack

- Vite 5 + React 19 + TypeScript estricto
- Tailwind CSS + `@alsari/ui`
- Zustand (estado local)
- Zod (validación)
- Supabase (datos)

---

## 🚀 Desarrollo

```powershell
# Desde la raíz del monorepo
pnpm install
pnpm --filter [nombre-modulo] dev      # Levanta en :517X
```

---

## 📂 Estructura

```
src/
├── components/     # UI específica del módulo
├── hooks/          # Hooks custom
├── lib/            # Lógica pura (cálculos, helpers)
├── pages/          # Vistas / rutas
├── stores/         # Zustand stores
├── types/          # Tipos TS locales
├── api/            # Llamadas a Supabase
├── App.tsx
└── main.tsx
```

---

## 🧪 Tests

```powershell
pnpm --filter [nombre-modulo] test
```

---

## 📚 Documentación

- `CLAUDE.md` — Contexto para Claude Code.
- `ARQUITECTURA.md` — Decisiones técnicas de este módulo.
- `CHANGELOG.md` — Historial.
- `ways-of-working-local/` — Reglas específicas.
