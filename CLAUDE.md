# CLAUDE.md

> **Puntero corto.** El contexto completo de Claude vive en `.claude/`.

---

## 📚 Lectura obligatoria al inicio de cada sesión

1. **`.claude/CLAUDE.md`** — identidad, roles, reglas supremas.
2. **`.claude/skills/lessons-learned/log.md`** — lecciones de sesiones anteriores.
3. **`.claude/docs/ways-of-working/`** — reglas detalladas (10 archivos).
4. **`docs/ARQUITECTURA.md`** — estado técnico actual del sistema.

Las skills definidas en `.claude/skills/` se cargan automáticamente bajo demanda
según su descripción frontmatter. Los hooks en `.claude/hooks/` se ejecutan en
eventos del agente (PreToolUse, PostToolUse, SessionStart, Stop).

---

## 🗺️ Mapa rápido del repositorio

```
.claude/          → Todo el conocimiento operativo de Claude
  ├── CLAUDE.md   →   Constitución completa del agente
  ├── settings.json →  Configuración (hooks, permisos, MCPs)
  ├── skills/     →   Conocimiento on-demand (corporate, finance, git, ui, lessons)
  ├── agents/     →   Subagents especializados (code-reviewer, test-runner, ...)
  ├── hooks/      →   Scripts shell deterministas (guardrails)
  ├── commands/   →   Slash commands custom (/nueva-leccion, /nuevo-modulo, ...)
  └── docs/       →   Ways of working — reglas para Claude

apps/             → Aplicaciones ejecutables
  ├── host/       →   Host OS (Next.js): cascarón, auth, navegación, error boundaries
  └── modules/    →   Filiales digitales (Vite + React) que cuelgan del host
       ├── financiero/   (a crear)
       ├── facturas/     (a crear)
       ├── proyectos/    (a crear)
       └── _template/    (plantilla para nuevos módulos)

packages/         → Librerías internas compartidas (no dependen de apps/)
  ├── ui/         →   Design System Quiet Luxury
  ├── utils/      →   Utilidades puras (formatCurrency, finance, cn, ...)
  ├── types/      →   Schemas Zod canónicos
  ├── config/     →   Configs compartidas (TS base, ESLint, Tailwind preset)
  └── supabase-client/ → Cliente Supabase tipado

services/         → Backend operativo
  └── supabase/
       ├── migrations/   →   SQL versionado (YYYYMMDDHHmm_descripcion.sql)
       └── functions/    →   Edge Functions (TypeScript/Deno)

docs/             → Documentación para HUMANOS (no para Claude)
  ├── ARQUITECTURA.md   →   Estado técnico vivo
  ├── ROADMAP.md        →   Próximas fases
  ├── CHANGELOG.md      →   Historial Keep a Changelog
  ├── GETTING-STARTED.md →  Cómo arrancar
  └── decisiones/       →   ADRs

scripts/          → Automatización (setup, validación, generadores)
```

**Distinción clave:**

- **`.claude/docs/`** son instrucciones para Claude.
- **`docs/`** (raíz) son documentos para personas (tú, socios, futuros devs).

---

## 🛑 Reglas innegociables (resumen de 1 línea)

1. **Nunca tocar `main` directamente.** Toda nueva tarea = rama nueva + PR.
2. **Pushback antes de ejecutar peticiones técnicamente subóptimas.**
3. **Registrar lecciones aprendidas inmediatamente** tras cada corrección.
4. **Nunca commitear secrets.** Si entra por error → rotar credencial.
5. **RLS obligatorio** en todas las tablas de Supabase.

Detalle completo en `.claude/CLAUDE.md` y `.claude/docs/ways-of-working/`.

---

## 🚀 Comandos rápidos

```bash
pnpm install                          # Instalar todo el monorepo
pnpm dev                              # Levantar Host OS
pnpm --filter @alsari/financiero dev  # Levantar un módulo específico
pnpm test                             # Tests
pnpm lint                             # Lint
pnpm type-check                       # TS check
```
