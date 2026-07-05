---
name: lessons-learned
description: Sistema de aprendizaje vivo de Alsari Capital OS. Léelo al inicio de cada sesión para no repetir errores corregidos en sesiones anteriores. Cuando Guille corrija un error, añade una entrada nueva a log.md ANTES de continuar.
---

# Lecciones Aprendidas — Alsari Capital OS

Este skill es la **memoria persistente del proyecto**. Acumula las correcciones que
Guille ha hecho a Claude para que los mismos errores no se repitan en futuras
sesiones.

---

## 📚 Protocolo de uso

### Al inicio de cada sesión

1. **Lee `log.md` completo.** Aunque sea largo, es la diferencia entre una sesión
   ágil y una sesión donde repites errores ya corregidos.
2. **Si existe `compactado.md`**, léelo después como resumen temático.
3. **Aplica las lecciones sin esperar a que Guille las recuerde.** Si en una lección
   pasada quedó claro que los importes van con punto de miles, no le preguntes:
   formatea bien y sigue.

### Durante la sesión, si cometes un error

Aplica el procedimiento **antes de continuar**:

1. **Reconoce el error en una frase**, sin auto-flagelarte ni disculparte en exceso.
2. **Entiende la causa raíz**, preguntando si hace falta.
3. **Añade una entrada nueva a `log.md`** con el formato estándar (ver más abajo).
4. **Aplica la corrección** y, si la lección genera código/test/regla, créalo
   también en esta sesión.
5. **Continúa la tarea original**, ya con la lección aplicada.

---

## 📋 Formato obligatorio de una entrada

```markdown
---

## YYYY-MM-DD HH:MM — [Título corto del aprendizaje]

**Contexto:** [Qué estaba haciendo Claude.]

**Error:** [Qué hizo mal.]

**Corrección de Guille:** [Qué dijo o cómo lo corrigió.]

**Causa raíz:** [Causa profunda, no el síntoma.]

**Lección:** [Regla generalizable para el futuro.]

**Acciones tomadas:**

- [ ] Aplicada en la tarea actual.
- [ ] Documentada en ways-of-working si aplica (con referencia).
- [ ] Test añadido si aplica.
- [ ] Utility/regla extraída si aplica.

**Tags:** #tag1 #tag2 (máximo 4)
```

---

## 🎯 Reglas de oro

1. **Captura inmediata.** La entrada se escribe en la misma sesión, no "después".
2. **Causa raíz, no síntoma.** "Faltaba el €" es síntoma; "no había utility centralizada
   de formato monetario" es causa raíz.
3. **Generalización.** ¿Cómo evito este _tipo_ de error en el futuro, no solo este
   error concreto?
4. **Acción concreta.** Si la lección no genera un cambio (código, doc, test), no se
   ha aprendido nada.
5. **Cero disculpas excesivas.** Reconocer error ≠ auto-flagelarse. Precisión, no ruido.

---

## 🗂️ Archivos

- **`log.md`** — Crónica completa, cronológica, sin tope. Cada lección queda aquí
  para siempre.
- **`compactado.md`** — (Cuando `log.md` supere ~150 entradas) resumen temático
  agrupado por área. Lo genera Claude bajo petición de Guille.

---

## 🚦 Cuándo promover una lección a regla permanente

Si una lección:

- Se repite en formas similares, o
- Es estructural (afecta a cómo se construye el OS), o
- Genera una utility/test reutilizable,

→ **Promuévela** a:

- Una regla en `.claude/docs/ways-of-working/NN-archivo.md`, o
- Una utility en `packages/utils/`, o
- Un ADR en `docs/decisiones/`,

y deja una nota en la entrada original:

> _"Promovido a `.claude/docs/ways-of-working/02-codigo.md` sección Formato."_

---

## 🔍 Búsqueda dentro de log.md

Las entradas tienen **tags** al final. Para buscar lecciones relacionadas con un
tema:

```bash
grep -i "#formato" .claude/skills/lessons-learned/log.md
grep -i "#financiero" .claude/skills/lessons-learned/log.md
```

Tags habituales: `#formato`, `#moneda`, `#i18n`, `#financiero`, `#facturas`,
`#proyectos`, `#ui`, `#tipografia`, `#color`, `#proceso`, `#git`, `#tests`,
`#seguridad`, `#supabase`, `#destructivas`, `#confirmacion`.
