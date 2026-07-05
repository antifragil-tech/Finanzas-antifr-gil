# Modules — Filiales Digitales del OS

> Aquí vive cada **módulo** del Alsari Capital OS: una mini-aplicación independiente
> que el Host OS (`apps/host`) carga bajo demanda.

---

## 📦 Módulos previstos

| Módulo       | Propósito                                         | Estado        |
| ------------ | ------------------------------------------------- | ------------- |
| `financiero` | Dashboard financiero consolidado, KPIs, cash flow | 🚧 Por migrar |
| `facturas`   | Gestión de facturas emitidas y recibidas          | 🚧 Por migrar |
| `proyectos`  | Tracking de proyectos inmobiliarios               | 🚧 Por migrar |
| `_template`  | Plantilla para crear módulos nuevos               | ✅ Disponible |

---

## ✨ Cómo crear un módulo nuevo

### Opción A: usar el slash command (recomendado)

En el chat de Claude Code:

```
/nuevo-modulo financiero
```

Claude clona la plantilla, renombra, registra en el monorepo y actualiza docs.

### Opción B: manualmente

1. **Copia** `_template/` a `apps/modules/[nombre]/`.
2. **Renombra:**
   - `package.json` → cambia `name` a `@alsari/[nombre]`.
   - `index.html` → cambia `<title>`.
   - `src/App.tsx` → cambia el `<h1>`.
3. **Personaliza:**
   - `CLAUDE.md` — describe qué hace el módulo.
   - `README.md` — bienvenida del módulo.
   - `ARQUITECTURA.md` — decisiones técnicas locales.
   - `ways-of-working-local/` — reglas específicas si las hay.
4. **Instala:** desde la raíz, `pnpm install` para que el monorepo lo registre.
5. **Levanta:** `pnpm --filter @alsari/[nombre] dev`.
6. **Regístralo en el Host OS** (cuando el Host esté migrado): añade entrada en
   `apps/host/lib/module-registry.ts`.

---

## 🚫 Reglas duras

- Un módulo NO importa de otro módulo. Si necesitas compartir algo, va a `packages/`.
- Un módulo NO importa del `apps/host`. La comunicación es vía props/eventos a través
  del registro de módulos.
- Cada módulo gestiona su propia conexión a Supabase con el cliente compartido.
- Cada módulo tiene sus propios tests, su propio CHANGELOG y su propio CLAUDE.md.
