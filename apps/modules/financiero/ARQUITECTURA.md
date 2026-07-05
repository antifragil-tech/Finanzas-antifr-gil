# Arquitectura — Módulo `financiero`

> Documento vivo. Estado técnico actual del módulo.

**Última actualización:** 2026-05-17
**Versión del módulo:** 0.1.0

---

## 🗺️ Visión general

El módulo financiero es el dashboard central del holding. Consume un único endpoint
`GET /api/data` del CF Worker (que lee Google Sheets via JWT de service account) y
distribuye los datos entre sus 5 vistas internas. No tiene router propio: el estado
de vista activa vive en `App.tsx` como enum local.

---

## 🧱 Estructura interna

```
src/
├── components/
│   ├── DashboardLayout.tsx    # flex h-screen: sidebar fijo + main scrollable
│   ├── FinancialSidebar.tsx   # fixed left-16 top-0 z-50 w-72 (offset OSSidebar)
│   ├── Overview.tsx           # KPIs por sociedad + tabla de cartera
│   ├── CorporateMap.tsx       # SVG interactivo del mapa corporativo
│   ├── ProjectView.tsx        # Detalle de proyecto con Recharts BarChart
│   ├── Contabilidad.tsx       # Libro mayor — tabla de transacciones
│   └── WorkspaceView.tsx      # Workspace semanal: tareas y notas
├── App.tsx
├── index.ts
├── main.tsx
└── styles.css
```

---

## 🔄 Flujos clave

### Carga inicial

```
App.tsx monta
  → fetchData() → GET http://127.0.0.1:8787/api/data
  → { entities, projects, financialProjects, weeklyWorkspaces, ... }
  → Estado en App.tsx propagado a DashboardLayout → vista activa
```

### Navegación entre vistas

```
Click en FinancialSidebar
  → setActiveView('overview' | 'map' | 'project' | 'contabilidad' | 'workspace')
  → App.tsx renderiza el componente correspondiente como prop a DashboardLayout
```

### Workspace semanal

```
WorkspaceView monta
  → fetchWorkspace(year, week) → GET /api/workspace/:year/:week
  → Muestra tareas e items de la semana seleccionada
```

---

## 📊 Fuente de datos

| Endpoint                         | Propósito                                                        |
| -------------------------------- | ---------------------------------------------------------------- |
| `GET /api/data`                  | Estado completo del holding (entidades, proyectos, contabilidad) |
| `GET /api/workspace/:year/:week` | Workspace de una semana concreta                                 |

Fuente real: Google Sheets del holding, leída via JWT del service account GCP.
No usa Supabase para datos (trabajo de Fase futura).

---

## 🔐 Permisos

Solo accesible tras autenticación en el Host OS (Supabase Auth + middleware).
No implementa RLS propio: confía en que el Host ya filtró el acceso.

---

## 🎯 Decisiones técnicas locales

- **Sin router interno:** el estado de vista activa es un enum en `App.tsx`.
  Suficiente para 5 vistas fijas; si crece a 10+, considerar `react-router`.
- **FinancialSidebar offset:** `left-16` hardcodeado al ancho del OSSidebar (64px).
  Si el OSSidebar cambia de tamaño, actualizar aquí.
- **Modo privado:** `isPrivateMode` boolean en estado de App.tsx; se propaga
  como prop. No persiste entre sesiones (diseño intencional).

---

## 🚧 Deuda técnica

- Tipos de la respuesta del CF Worker duplicados localmente en `App.tsx`. Mover
  a `@alsari/types` cuando se estabilice el schema de datos.
