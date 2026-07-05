# 07 · Documentación

> Cómo mantenemos la documentación viva del proyecto.

---

## 🎯 Filosofía

> _"La documentación es el sistema operativo del proyecto. Sin ella, el contexto
> muere con cada sesión."_

Estamos construyendo un sistema que durará años y por el que pasarán múltiples sesiones
de trabajo con Claude. Si la documentación no está al día, **el conocimiento se pierde**
y cada sesión se vuelve más lenta y propensa a errores.

**Regla de oro:** si tocas algo, documenta el porqué. El código dice qué hace; la
documentación dice por qué se hizo así.

---

## 📚 Tipos de documentación

### 1. Documentación viva (cambia con el código)

| Archivo              | Ubicación             | Propósito                 | Quién lo mantiene |
| -------------------- | --------------------- | ------------------------- | ----------------- |
| `CLAUDE.md`          | Raíz y cada módulo    | Contexto para Claude Code | Claude (auto)     |
| `README.md`          | Raíz y cada módulo    | Bienvenida y onboarding   | Claude + Guille   |
| `ARQUITECTURA.md`    | `docs/` y cada módulo | Mapa técnico actual       | Claude (auto)     |
| `CHANGELOG.md`       | `docs/` y cada módulo | Historial de cambios      | Claude (auto)     |
| `ROADMAP.md`         | `docs/`               | Próximos pasos            | Guille + Claude   |
| `ways-of-working-*/` | Raíz y cada módulo    | Reglas que aplican        | Guille + Claude   |

### 2. Documentación de decisiones (no cambia, se añade)

| Archivo                                | Ubicación          | Propósito                          |
| -------------------------------------- | ------------------ | ---------------------------------- |
| `docs/decisiones/NNNN-titulo.md`       | `docs/decisiones/` | ADR (Architecture Decision Record) |
| `docs/incidentes/YYYY-MM-DD-titulo.md` | `docs/incidentes/` | Postmortems de incidentes          |

### 3. Documentación contextual (skills de Claude)

| Archivo                                 | Ubicación          | Propósito                               |
| --------------------------------------- | ------------------ | --------------------------------------- |
| `.claude/skills/*/SKILL.md`             | Raíz y cada módulo | Skills que Claude carga automáticamente |
| `.claude/skills/lessons-learned/log.md` | Raíz y cada módulo | Aprendizajes vivos                      |

---

## 📝 Reglas por tipo

### `CLAUDE.md`

- **Siempre presente** en la raíz del proyecto y en cada módulo.
- **Función:** primer contexto que Claude lee. Si lo tiene claro, la sesión va bien.
- **Contenido:** quién eres, qué reglas aplican, dónde buscar más, qué NO hacer.
- **Mantenimiento:** Claude lo actualiza cuando cambian las reglas básicas; cada
  cambio se registra en `CHANGELOG.md` con `docs(claude-md): ...`.

### `README.md`

- **Función:** bienvenida humana. Para alguien que abre el proyecto por primera vez.
- **Contenido obligatorio:**
  - Qué es el proyecto/módulo
  - Arquitectura en 30 segundos (diagrama si ayuda)
  - Arranque rápido (comandos)
  - Estructura de carpetas
  - Lecturas obligatorias
- **No duplicar** con `CLAUDE.md`. Si algo aparece en ambos, debe ser solo una frase
  resumen en `README.md` que apunte al detalle en `CLAUDE.md` o `ways-of-working/`.

### `ARQUITECTURA.md`

- **Función:** retrato técnico del estado actual del sistema.
- **Estructura obligatoria:**
  1. **Stack** (qué se usa).
  2. **Estructura** (cómo está organizado).
  3. **Flujos clave** (ej. cómo se autentica un usuario, cómo carga un módulo).
  4. **Dependencias externas** (Supabase, APIs).
  5. **Estado actual** (qué módulos están vivos, cuáles son placeholder).
- **Mantenimiento:** Claude lo actualiza **inmediatamente** cuando un cambio afecta
  a la arquitectura. No esperar al final del sprint.

### `CHANGELOG.md`

- **Formato:** [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) + semver.
- **Categorías:** `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- **Cuándo se actualiza:** en cada PR antes de mergear. El propio PR añade la entrada.

```markdown
## [Unreleased]

### Added

- Módulo `financiero`: cálculo de TIR con tests (#23)
- KPI Card reutilizable en `packages/ui`

### Fixed

- Error boundary del Host OS no capturaba errores asíncronos (#31)

## [0.2.0] - 2026-06-15

### Added

- ...
```

### `ROADMAP.md`

- **Función:** qué viene después. Visión a 3-6 meses.
- **Mantenimiento:** Guille marca prioridades; Claude propone detalles técnicos y
  estimaciones de complejidad.
- **No es una promesa de fechas.** Es una declaración de intenciones priorizadas.

### `ways-of-working-*/`

- **Función:** reglas que vinculan a Claude y al equipo.
- **Cuándo cambiar:** cuando una regla se demuestra insuficiente o se identifica una
  nueva práctica que debe aplicarse de forma consistente.
- **Procedimiento de cambio:** PR específico (`docs(wow): ...`) con justificación,
  aprobado por Guille. Una vez mergeado, aplica retroactivamente al código nuevo.

---

## 📐 ADRs (Architecture Decision Records)

### Qué es un ADR

Un documento corto que captura una **decisión arquitectónica importante** con su
contexto, alternativas consideradas y consecuencias.

### Cuándo escribir uno

✅ SÍ:

- Elección de stack (lenguaje, framework, BD).
- Cambio de patrón fundamental (SSR↔CSR, REST↔GraphQL).
- Introducción de una librería de impacto transversal.
- Decisión de seguridad/permisos.

❌ NO:

- Refactor interno de un módulo.
- Renombrar variables.
- Añadir un componente nuevo.

### Plantilla (`docs/decisiones/NNNN-titulo.md`)

```markdown
# ADR NNNN: [Título corto en imperativo]

- **Estado:** Propuesto | Aceptado | Rechazado | Reemplazado por ADR-XXXX
- **Fecha:** YYYY-MM-DD
- **Decisores:** Guille, Claude

## Contexto

[Qué problema o necesidad llevó a tomar esta decisión.]

## Decisión

[Qué se decidió hacer.]

## Alternativas consideradas

1. **Alternativa A** — Por qué se descartó.
2. **Alternativa B** — Por qué se descartó.

## Consecuencias

**Positivas:**

- ...

**Negativas / Riesgos:**

- ...

**Acciones derivadas:**

- ...
```

---

## 🩺 Incidentes (postmortems)

Cuando algo se rompe en producción (o casi se rompe), documentamos en
`docs/incidentes/YYYY-MM-DD-descripcion.md`:

```markdown
# Incidente: [Descripción corta]

- **Fecha:** YYYY-MM-DD HH:MM (TZ)
- **Duración:** Xh Ym
- **Severidad:** Crítica | Alta | Media | Baja
- **Módulos afectados:** ...

## Resumen ejecutivo

[Una frase para Guille: qué pasó, qué impacto tuvo, ya está resuelto.]

## Cronología

- HH:MM — Se detecta...
- HH:MM — Se identifica causa...
- HH:MM — Se aplica fix...
- HH:MM — Confirmado resuelto.

## Causa raíz

[Por qué pasó realmente, no solo el síntoma.]

## Qué funcionó

- ...

## Qué no funcionó

- ...

## Acciones de mejora

- [ ] ...
- [ ] ...

## Lecciones aprendidas

[Registrar también en `lessons-learned/log.md`.]
```

---

## 🤖 Skills y lessons-learned (sistema vivo)

Detalle completo en `09-protocolo-aprendizaje.md`. Resumen aquí:

- **Skills (`.claude/skills/*/SKILL.md`):** conocimiento estructurado que Claude
  carga automáticamente.
- **Lessons learned (`log.md`):** crónica de errores corregidos. Crece sesión a
  sesión.

---

## ✅ Checklist de documentación antes de cada PR

- [ ] `CHANGELOG.md` actualizado con la entrada de este cambio.
- [ ] Si afecta a arquitectura: `ARQUITECTURA.md` actualizado.
- [ ] Si cambia una regla: `ways-of-working-*` actualizado.
- [ ] Si es decisión importante: ADR creado en `docs/decisiones/`.
- [ ] JSDoc en funciones públicas nuevas.
- [ ] Si hubo error durante la sesión: entrada en `lessons-learned/log.md`.
