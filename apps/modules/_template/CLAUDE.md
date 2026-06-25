# CLAUDE.md — Módulo `[NOMBRE-DEL-MODULO]`

> Punto de entrada para Claude Code cuando trabaja **dentro de este módulo**.
> Las reglas globales de `../../../CLAUDE.md` y `../../../.claude/docs/ways-of-working/`
> aplican siempre y prevalecen. Aquí van solo las especificidades locales.

---

## 🎯 Qué hace este módulo

<!-- 1-2 párrafos sobre la responsabilidad de este módulo en el OS. -->

---

## 📚 Orden de lectura al trabajar en este módulo

1. `CLAUDE.md` raíz del proyecto.
2. `.claude/docs/ways-of-working/00-rol-y-autoridad.md`.
3. **Este archivo.**
4. **`.claude/skills/lessons-learned/log.md`** (lecciones específicas de este módulo).
5. `ARQUITECTURA.md` (de este módulo).
6. `ways-of-working-local/` (reglas específicas).
7. `../../.claude/skills/lessons-learned/log.md` (lecciones globales).

---

## 🏗️ Arquitectura local

<!-- Diagrama o descripción del flujo interno del módulo. -->

---

## 🔐 Datos y permisos

<!-- Qué tablas de Supabase usa, qué roles tienen acceso. -->

---

## 🧠 Lecciones aprendidas locales

Las correcciones de Guille específicas de este módulo se registran en
`.claude/skills/lessons-learned/log.md` siguiendo el mismo formato del nivel global.

---

## 🚀 Comandos del módulo

```powershell
# Desde la raíz del monorepo
pnpm --filter [nombre-modulo] dev
pnpm --filter [nombre-modulo] build
pnpm --filter [nombre-modulo] test
```

---

## ⚠️ Particularidades técnicas

<!-- Cosas no obvias que Claude debe recordar al trabajar aquí. -->
