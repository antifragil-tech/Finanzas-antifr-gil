---
description: Registrar una nueva lección aprendida en lessons-learned/log.md siguiendo el formato estándar.
argument-hint: "[titulo-corto-de-la-leccion]"
---

# Tarea: Registrar nueva lección aprendida

El usuario quiere registrar una lección. Sigue este flujo:

1. **Lee el archivo actual** `.claude/skills/lessons-learned/log.md` para conocer
   el formato y el estado actual del log.

2. **Pregunta al usuario** (si no han dado contexto suficiente):
   - Contexto: ¿qué estabas haciendo cuando ocurrió?
   - Error: ¿qué hiciste mal?
   - Corrección: ¿qué te dijo Guille o cómo se corrigió?
   - Causa raíz: ¿por qué pasó en realidad?
   - Lección generalizable: ¿qué regla evita esto en el futuro?
   - Acciones: ¿qué cambia hoy (código, doc, test)?
   - Tags: 2-4 tags relevantes.

3. **Genera la entrada** siguiendo EXACTAMENTE este formato:

```markdown
---

## YYYY-MM-DD HH:MM — [Título corto: $ARGUMENTS]

**Contexto:** [...]

**Error:** [...]

**Corrección de Guille:** [...]

**Causa raíz:** [...]

**Lección:** [...]

**Acciones tomadas:**
- [ ] ...
- [ ] ...

**Tags:** #tag1 #tag2
```

4. **Añade la entrada** al final de `log.md` (antes de cualquier comentario HTML
   de cierre, pero después de todas las entradas existentes).

5. **Actualiza el contador** "Total de lecciones" al inicio del archivo.

6. **Si la lección genera código** (utility, test, regla):
   - Pregunta al usuario si quieres crear los archivos derivados ahora.
   - Si dice sí, créalos y márcalos como completados en "Acciones tomadas".

7. **Confirma al usuario** que la entrada fue añadida, mostrándole solo el bloque
   recién creado.
