# Host OS — Alsari Capital

> 🚧 **Pendiente de migración (Fase 1 del ROADMAP).**
>
> Este directorio contendrá la aplicación Next.js que actúa como cascarón del OS:
> autenticación, navegación entre módulos, error boundaries y theming global.
>
> Lo que vive en tu app actual (`Neural Finance V3.0` con sus 3 páginas:
> `FinancialDashboard.tsx`, `WorkspacePage.tsx`, `InvoicesPage.tsx`) se va a
> migrar aquí en la Fase 1.

---

## Estructura prevista

```
apps/host/
├── app/                    # App Router de Next.js
│   ├── layout.tsx          # Layout global (sidebar + boot screen)
│   ├── page.tsx            # Home (redirección al módulo por defecto)
│   ├── financiero/         # Punto de montaje del módulo financiero
│   ├── facturas/           # Punto de montaje del módulo facturas
│   ├── proyectos/          # Punto de montaje del módulo proyectos
│   └── login/              # Auth
├── components/
│   ├── Sidebar.tsx
│   ├── BootScreen.tsx
│   ├── ModuleErrorBoundary.tsx
│   └── ...
├── lib/
│   ├── module-registry.ts  # Registro de módulos disponibles
│   ├── auth.ts             # Wrapper de Supabase Auth
│   └── ...
├── public/
│   ├── logo.png
│   └── favicon.png
├── package.json
├── next.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

Cuando empiece la Fase 1, Claude migrará progresivamente los archivos actuales
respetando la arquitectura.
