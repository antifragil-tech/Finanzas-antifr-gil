# Getting Started — Antifrágil OS

> Cómo arrancar el proyecto en local (Windows). Sustituye a la guía v0.2 de la
> era "Alsari Capital OS" (bootstrap inicial del monorepo, ya completado —
> consérvala solo en el historial de git si hiciera falta).

---

## 1. Requisitos

- **Node.js ≥ 20** (`node --version`).
- **pnpm 9.12** — vía Corepack: `corepack enable` (si no hay permisos de
  administrador: `corepack enable --install-directory $HOME/bin` y añadir esa
  carpeta al PATH). Verifica con `pnpm --version`.
- **GitHub CLI** (`gh auth status` → cuenta `antifragil-tech`).
  - Si `git push` pide contraseña de otro usuario: la config global fija
    `credential.https://github.com.username`; empuja con
    `git -c "credential.https://github.com.username=antifragil-tech" push …`.

## 2. Instalar y levantar

```powershell
pnpm install                 # instala todo el monorepo
pnpm dev                     # levanta el Host OS (Next.js) en http://localhost:3000
```

**Contrato de datos del host:** sin variables de entorno → **modo demo**
(datos ficticios, nunca crashea; así el CI compila sin secrets). Con entorno →
**datos reales** de Supabase. Para datos reales crea `apps/host/.env.local`
(gitignorado) con:

```
NEXT_PUBLIC_SUPABASE_URL=…        # URL del proyecto antifragil-os
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…       # SOLO servidor; jamás llega al cliente
```

> ⚠️ El proyecto Supabase está en plan free: tras ~1 semana sin uso **se pausa**
> (su dominio deja de resolver y la web no lee datos). Se reactiva desde el
> Dashboard de Supabase o vía Management API.

Para navegar el OS sin login en desarrollo: añade `NEXT_PUBLIC_OS_PREVIEW=true`
al `.env.local` (solo funciona con `next dev`; en producción es código muerto).

## 3. Gates de calidad (los mismos que el CI)

```powershell
pnpm type-check    # tsc en todos los workspaces
pnpm lint          # ESLint --max-warnings 0
pnpm format:check  # Prettier (el juez es el CI en Linux: .md y código con LF)
pnpm test:run      # vitest (dominio @antifragil/operativa y legacy)
pnpm build         # next build + vite builds (verde sin secrets por diseño)
```

En Windows, `format:check` puede dar falsos positivos por CRLF; el veredicto
válido es el del CI.

## 4. Reglas de trabajo (resumen)

- **Nunca tocar `main`**: rama nueva + worktree aislado + PR (empieza en Draft).
- Merge solo con aprobación explícita de Guille; CI en verde antes.
- **Nunca commitear secrets** (si entra uno: rotar la credencial).
- Cambios de esquema en la base real: siempre con autorización expresa, y
  después **regenerar el reflejo** con `scripts/db/reflejar-esquema.py` y
  commitearlo en el mismo PR (fuente de verdad:
  `services/supabase/esquema-real/`).
- **Nada de datos clínicos** en el OS ni en el repo.

## 5. Mapa mínimo del repo

| Zona                              | Qué hay                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/host/src/app/(app)/(os)/`   | Páginas del OS: Panel, Tesorería (+importar, +factura), Rentabilidad, Liquidaciones, Reservas, Configuración |
| `apps/host/src/lib/datos/`        | Capa de datos real (PostgREST service_role server-only) + acciones                                           |
| `packages/operativa/`             | Dominio financiero puro + plantillas de importación CSV (con tests)                                          |
| `apps/modules/reservas/`          | Módulo Reservas (maqueta UI; conexión a BD = Bloque B del ROADMAP)                                           |
| `services/supabase/esquema-real/` | **Esquema real versionado** (58 tablas) + checks de paridad                                                  |
| `docs/`                           | SESSION (estado), ROADMAP (bloques A–G), CHANGELOG, ARQUITECTURA                                             |

Los módulos `financiero/facturas/contabilidad/presupuestos` son **legado del
holding Alsari**: compilan pero están desmontados del runtime (sus rutas sirven
un placeholder).
