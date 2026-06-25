# CLAUDE.md — Módulo `financiero`

> Punto de entrada para Claude Code cuando trabaja **dentro de este módulo**.
> Las reglas globales de `../../../CLAUDE.md` y `../../../.claude/docs/ways-of-working/`
> aplican siempre y prevalecen. Aquí van solo las especificidades locales.

---

## 🎯 Qué hace este módulo

Dashboard financiero principal del holding Alsari Capital. Consolida KPIs de todas
las sociedades, muestra el mapa corporativo interactivo, permite navegar por proyectos
individuales con gráficos de inversión/valoración, consultar el libro mayor de
contabilidad y revisar el workspace semanal de operaciones.

Es el módulo central del OS: lo primero que ve Guille al autenticarse.

---

## 📚 Orden de lectura al trabajar en este módulo

1. `CLAUDE.md` raíz del proyecto.
2. `.claude/docs/ways-of-working/00-rol-y-autoridad.md`.
3. **Este archivo.**
4. `ARQUITECTURA.md` (de este módulo).
5. `../../.claude/skills/lessons-learned/log.md` (lecciones globales — CRÍTICO).

---

## 🏗️ Arquitectura local

```
src/
├── components/
│   ├── DashboardLayout.tsx    # Shell: sidebar + main content
│   ├── FinancialSidebar.tsx   # Navegación lateral (fixed left-16 top-0)
│   ├── Overview.tsx           # Vista KPIs + cartera de proyectos
│   ├── CorporateMap.tsx       # Mapa corporativo SVG interactivo
│   ├── ProjectView.tsx        # Detalle de proyecto con Recharts
│   ├── Contabilidad.tsx       # Libro mayor
│   └── WorkspaceView.tsx      # Workspace semanal
├── App.tsx                    # Entry point: fetch de datos + router de vistas
├── main.tsx
├── index.ts                   # export { FinancieroDashboard }
└── styles.css
```

Flujo de datos:
```
App.tsx → fetch /api/data (CF Worker)
  → { entities, projects, financialProjects, weeklyWorkspaces, ... }
  → DashboardLayout con estado en App.tsx
  → Vista activa recibe props
```

---

## 🔐 Datos y permisos

Datos: **100% Supabase** (PostgREST directo con auth bridge).
Auth bridge: `window.alsariToken` inyectado por el host. Si no existe, cae al `anon key`. La resolución del token, la URL y los headers viven centralizados en `@alsari/supabase-client` (`getJwt`, `sbUrl`, `sbHeaders`) — los módulos NO deben declarar estas constantes en local.

### Schema de `vencimientos` (tabla crítica)

```typescript
type TipoVencimiento = 'seguro' | 'deuda' | 'prestamo' | 'contrato' | 'impuesto' | 'compromiso' | 'otro' | 'pignorado';
type EstadoVencimiento = 'pendiente' | 'gestionado' | 'vencido';

type Vencimiento = {
  id: string;
  titulo: string;
  tipo: TipoVencimiento;
  fecha_vencimiento: string; // YYYY-MM-DD
  importe: number | null;
  sociedad_id: string | null;
  notas: string | null;
  estado: EstadoVencimiento;
  recurrencia: 'anual' | 'semestral' | 'trimestral' | 'mensual' | null;
  es_entrada: boolean;       // true = cobro (holding recibe), false = pago (holding paga)
  created_at: string;
};
```

**Regla de negocio `es_entrada`:** si el holding/Javier es el Prestamista/Acreedor en el Excel → `true` (entrada). Si paga (seguros, gastos) → `false`. Los préstamos a Perisur, Ivan, Ivaltia, Procourval, earn-out Evariste y precio aplazado Álvaro son **entradas**. Los seguros son **salidas**.

**Fondos pignorados Santander** — 3 filas en BD con `tipo='pignorado'`, `es_entrada=true`:
- Tramo 1: 2027-10-23 · 550.000€ (50%)
- Tramo 2: 2028-10-23 · 275.000€ (25%)
- Tramo 3: 2029-10-23 · 275.000€ (25%)
Aval bancario constituido para garantizar responsabilidades frente a Evariste por venta de Rialsa.

---

## 🚀 Comandos del módulo

```bash
# Desde la raíz del monorepo
pnpm --filter @alsari/financiero dev     # Puerto 5174 (Vite default)
pnpm --filter @alsari/financiero build
pnpm --filter @alsari/financiero type-check
```

---

## ⚠️ Particularidades técnicas

- `import.meta.env?.['VITE_API_URL']` — usar siempre optional chaining.
  Next.js no inyecta `import.meta.env` al transpilar módulos Vite.
- `FinancialSidebar` usa `fixed left-16 top-0 z-50` para posicionarse después
  del rail del OSSidebar (64px). Si cambia el ancho del OSSidebar, actualizar aquí.
- Modo privado (`isPrivateMode`): oculta importes reales con `****`. Toggle en
  el botón de ojo en el header.
