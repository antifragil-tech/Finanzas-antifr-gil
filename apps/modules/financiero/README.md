# Módulo `financiero` — @alsari/financiero

> Dashboard financiero central del holding Alsari Capital.

---

## 🎯 Responsabilidades

- KPIs consolidados de todas las sociedades del holding.
- Mapa corporativo SVG interactivo (jerarquía de entidades).
- Vista de detalle por proyecto (Recharts: inversión vs valoración).
- Libro mayor de contabilidad (transacciones por sociedad).
- Workspace semanal de operaciones.
- Modo privado para ocultar importes reales.

---

## 🛠️ Stack

- Vite 5 + React 19 + TypeScript estricto
- Tailwind CSS + `@alsari/ui`
- `@alsari/types` + `@alsari/utils`
- Recharts (gráficos)
- CF Worker como backend de datos (Google Sheets como fuente de verdad)

---

## 🚀 Desarrollo

```bash
# Desde la raíz del monorepo
pnpm install
pnpm --filter @alsari/financiero dev      # Levanta en :5174
```

---

## 📂 Estructura

```
src/
├── components/     # DashboardLayout, FinancialSidebar, Overview,
│                   # CorporateMap, ProjectView, Contabilidad, WorkspaceView
├── App.tsx         # Entry point con fetch y router de vistas
├── main.tsx
├── index.ts        # export { FinancieroDashboard }
└── styles.css
```

---

## 📚 Documentación

- `CLAUDE.md` — Contexto para Claude Code.
- `ARQUITECTURA.md` — Decisiones técnicas de este módulo.
- `CHANGELOG.md` — Historial.
- `ways-of-working-local/` — Reglas específicas del módulo.
