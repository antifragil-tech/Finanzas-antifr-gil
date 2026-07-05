# Alsari Capital OS

> Sistema Operativo corporativo unificado del holding Alsari Capital.
> Panel de control modular para gestión financiera, proyectos, facturas y
> herramientas operativas del grupo.

---

## 🎯 Qué es esto

Alsari Capital OS es un **ecosistema digital propio** construido como monorepo,
con un **Host OS** central que carga **módulos independientes** (micro-frontends).
Cada módulo es una herramienta de negocio aislada que puede fallar sin tirar abajo
el resto del sistema.

**Filosofía:** Quiet Luxury ejecutivo. Dark Mode. Tolerancia a fallos. Decisiones
estratégicas apoyadas en información estructurada.

---

## 🏗️ Arquitectura en 30 segundos

```
┌─────────────────────────────────────────────────────────┐
│                  apps/host  (Next.js)                   │
│  Autenticación · Navegación · Routing · Error Boundary  │
└────────┬────────────┬────────────┬────────────┬─────────┘
         │            │            │            │
    ┌────▼───┐   ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
    │Financ. │   │Facturas│   │Proyec. │   │Futuros │
    │ Vite+R │   │ Vite+R │   │ Vite+R │   │   ...  │
    └────────┘   └────────┘   └────────┘   └────────┘
                          │
                  ┌───────▼────────┐
                  │   Supabase     │
                  │  (Postgres +   │
                  │   Auth + RLS)  │
                  └────────────────┘
```

---

## 📂 Estructura del repositorio

```
Alsari Capital OS/
├── CLAUDE.md                      # Puntero corto → .claude/
├── .claude/                       # ⭐ Todo lo del agente Claude
│   ├── CLAUDE.md                  #   Constitución completa
│   ├── settings.json              #   Config (hooks, permisos, MCPs)
│   ├── skills/                    #   Conocimiento on-demand
│   ├── agents/                    #   Subagents especializados
│   ├── hooks/                     #   Scripts shell (guardrails)
│   ├── commands/                  #   Slash commands (/nueva-leccion, ...)
│   └── docs/ways-of-working/      #   Reglas para Claude
│
├── apps/                          # Aplicaciones ejecutables
│   ├── host/                      #   Host OS (Next.js) — el tronco
│   └── modules/                   #   Filiales digitales (Vite + React)
│       ├── _template/             #     Plantilla para crear módulos
│       ├── financiero/            #     (a crear) Módulo Financiero
│       ├── facturas/              #     (a crear) Gestión de Facturas
│       └── proyectos/             #     (a crear) Proyectos en Desarrollo
│
├── packages/                      # Código compartido entre apps
│   ├── ui/                        #   Design System (Quiet Luxury)
│   ├── config/                    #   Configs compartidas
│   ├── types/                     #   Tipos TypeScript canónicos
│   ├── utils/                     #   Utilidades puras
│   └── supabase-client/           #   Cliente Supabase
│
├── services/                      # Backend
│   └── supabase/
│       ├── migrations/            #   SQL versionado
│       └── functions/             #   Edge Functions
│
├── docs/                          # Documentación para HUMANOS
│   ├── ARQUITECTURA.md            #   Estado técnico vivo
│   ├── ROADMAP.md                 #   Próximas fases
│   ├── CHANGELOG.md               #   Historial Keep a Changelog
│   ├── GETTING-STARTED.md         #   Cómo arrancar
│   └── decisiones/                #   ADRs
│
└── scripts/                       # Automatización (setup, validación)
```

**Distinción importante:**

- **`.claude/docs/`** → para Claude (ways-of-working).
- **`docs/`** raíz → para personas (tú, socios, devs futuros).

---

## 🚀 Arranque rápido

### Prerrequisitos

- **Node.js** ≥ 20 (`nvm install 20`)
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Git**
- **Cuenta de Supabase** (para backend)
- **Antigravity** con extensión **Claude Code**

### Setup inicial

```powershell
# 1. Clonar el repo (cuando esté en GitHub)
git clone https://github.com/[tu-usuario]/alsari-capital-os.git
cd alsari-capital-os

# 2. Instalar dependencias
pnpm install

# 3. Copiar variables de entorno
copy .env.example .env

# 4. Levantar el Host OS
pnpm dev
```

Detalle paso a paso en `docs/GETTING-STARTED.md`.

---

## 🤖 ¿Qué hace especial este proyecto?

Tres capas que se construyen una encima de otra:

### 1️⃣ Sistema de aprendizaje vivo (`.claude/skills/lessons-learned/`)

Cada corrección de Guille se registra como lección. En 6 meses tienes un corpus
que evita repetir errores. Detalle en
`.claude/docs/ways-of-working/09-protocolo-aprendizaje.md`.

### 2️⃣ Hooks deterministas (`.claude/hooks/`)

Scripts shell que se ejecutan ANTES y DESPUÉS de cada acción de Claude. Bloquean
comandos peligrosos (`rm -rf`, `git push --force`), formatean código tras editar,
imprimen contexto del repo al arrancar sesión. Detalle en
`.claude/hooks/README.md`.

### 3️⃣ Subagents y slash commands (`.claude/agents/`, `.claude/commands/`)

Subagents especializados (code-reviewer, test-runner, migration-checker) con
contexto aislado. Slash commands para flujos frecuentes (`/nueva-leccion`,
`/nuevo-modulo`, `/reporte-semana`).

---

## 👥 Roles

- **Guille (Director General):** decisión estratégica, dirección de negocio,
  validación final de cada merge.
- **Claude (Arquitecto técnico):** decisión técnica plena, escritura de código,
  mantenimiento de la salud arquitectónica.

Detalle en `.claude/docs/ways-of-working/00-rol-y-autoridad.md`.

---

## 🛡️ Seguridad

Los datos del holding son sensibles (CIFs, IBANs, importes, contactos). Reglas:

- **Repositorio privado siempre.**
- **Nada de secrets en código.** Variables sensibles en `.env` (gitignored).
- **Supabase con Row Level Security activado** en todas las tablas.
- **Comunicación con APIs externas siempre por HTTPS.**

Detalle en `.claude/docs/ways-of-working/05-seguridad.md`.

---

## 📖 Lecturas obligatorias antes de contribuir

1. `CLAUDE.md` (raíz) → puntero corto.
2. `.claude/CLAUDE.md` → constitución completa.
3. `.claude/docs/ways-of-working/00-rol-y-autoridad.md`.
4. `.claude/docs/ways-of-working/01-arquitectura.md`.
5. `.claude/docs/ways-of-working/03-git-workflow.md`.
6. `docs/ARQUITECTURA.md`.

---

## 📜 Licencia

Propietaria — Alsari Capital. Uso interno del holding.
