---
description: Crear un nuevo módulo en apps/modules/ clonando _template y personalizándolo.
argument-hint: '<nombre-del-modulo>'
---

# Tarea: Crear nuevo módulo `$1`

El usuario quiere crear un módulo nuevo llamado `$1`. Sigue este flujo:

## 1. Validación previa

- Verifica que `$1` está definido y es kebab-case válido (`^[a-z][a-z0-9-]*$`).
- Verifica que `apps/modules/$1/` NO existe ya.
- Verifica que `apps/modules/_template/` SÍ existe.

Si algo falla, **detente y pide aclaración**.

## 2. Clonado

Ejecuta:

```bash
cp -r apps/modules/_template apps/modules/$1
```

## 3. Personalización de archivos

En `apps/modules/$1/`:

### `package.json`

- Cambiar `"name": "@alsari/template"` → `"name": "@alsari/$1"`.
- Cambiar el `description` por algo coherente con el módulo.

### `index.html`

- Cambiar `<title>Alsari Capital | [Nombre del módulo]</title>`
  → `<title>Alsari Capital | $1</title>` (con primera letra mayúscula).

### `src/App.tsx`

- Cambiar `[Nombre del Módulo]` por una versión legible de `$1`
  (ej. `financiero` → "Financiero", `gestion-clientes` → "Gestión de Clientes").

### `CLAUDE.md`, `README.md`, `ARQUITECTURA.md`

- Sustituir todos los `[NOMBRE]` y `[NOMBRE-DEL-MODULO]` por `$1`.
- Sustituir referencias a `template-modulo` por `$1`.

### `CHANGELOG.md`

- Reemplazar la fecha placeholder por la fecha de hoy en formato ISO.
- Mantener `Added: Scaffolding inicial del módulo desde la plantilla`.

### `vite.config.ts`

- Asignar puerto único basado en el nombre del módulo:
  - `financiero` → 5174
  - `facturas` → 5175
  - `proyectos` → 5176
  - Otros → calcula uno libre.

## 4. Registro en el monorepo

- Verifica que `pnpm-workspace.yaml` ya incluye `apps/modules/*` (debería).
- Si no, añádelo.

## 5. Documentación

Actualiza:

- `docs/ARQUITECTURA.md` → tabla "Estado actual de implementación" con el módulo nuevo en estado 🚧.
- `docs/CHANGELOG.md` → entrada en `[Unreleased]` → `Added` con
  `Módulo $1 creado desde plantilla.`

## 6. Confirmación

Devuelve al usuario:

```markdown
✅ Módulo `$1` creado en `apps/modules/$1/`.

**Próximos pasos:**

1. Cambiar el contenido placeholder en `src/App.tsx` por la implementación real.
2. Definir el modelo de datos en `ARQUITECTURA.md` del módulo.
3. Ejecutar `pnpm install` desde la raíz para registrar el workspace.
4. Levantar el módulo: `pnpm --filter @alsari/$1 dev`.
5. Cuando el Host OS esté migrado, registra el módulo en `apps/host/lib/module-registry.ts`.
```

## 🚫 NO HAGAS

- NO hagas commit automático. El usuario debe revisar y decidir.
- NO instales dependencias automáticamente (puede tardar y bloquear la sesión).
- NO renombres el `_template` original. Se mantiene como referencia.
