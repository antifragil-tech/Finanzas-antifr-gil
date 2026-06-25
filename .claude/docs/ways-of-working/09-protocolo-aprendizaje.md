# 09 · Protocolo de Aprendizaje

> Cómo el sistema **aprende de cada sesión** para mejorar continuamente.
> Esto es lo que diferencia Alsari Capital OS de un setup técnico convencional.

---

## 🎯 Por qué este protocolo existe

Cada sesión con Claude empieza casi de cero. Sin memoria persistente, los mismos
errores se repetirían eternamente: "Guille prefiere los importes con punto de miles",
"En España los CIFs empiezan con letra", "Las migraciones SQL llevan timestamp ISO",
"El logo va con `h-24` en boot screens"…

La solución: **convertir las correcciones en conocimiento estructurado** que Claude
lee al inicio de cada sesión.

---

## 🧠 Arquitectura del sistema de aprendizaje

### Dos niveles

#### Nivel global (`.claude/skills/lessons-learned/`)
Aplica a todo el OS. Aquí van las lecciones transversales:
- Preferencias de formato (números, fechas, idioma).
- Convenciones de naming aprendidas.
- Patrones técnicos que Guille pidió específicamente.
- Errores de proceso (ej. "siempre confirmar antes de borrar archivos").

#### Nivel local (`apps/modules/[nombre]/.claude/skills/lessons-learned/`)
Específico de cada módulo:
- Reglas de cálculo financiero particulares de Alsari.
- Estructuras de datos del módulo que Claude malinterpretó.
- Flujos de UI que Guille corrigió.

### Tres archivos por nivel

```
lessons-learned/
├── SKILL.md          # Skill que Claude Code carga (cabecera + instrucciones)
├── log.md            # Crónica cronológica de lecciones (crece sin tope)
└── compactado.md     # (Opcional) Resumen periódico cuando log.md crece mucho
```

---

## 📋 Formato de una entrada en `log.md`

Cada vez que Guille corrige a Claude, se añade una entrada **inmediatamente, antes
de continuar con la tarea**:

```markdown
---

## YYYY-MM-DD HH:MM — [Título corto del aprendizaje]

**Contexto:** [Qué estaba haciendo Claude cuando ocurrió el error.]

**Error:** [Qué hizo mal, descrito sin auto-flagelación pero con claridad.]

**Corrección de Guille:** [Qué dijo Guille o cómo lo corrigió.]

**Causa raíz:** [Por qué ocurrió. No el síntoma, la causa profunda.]

**Lección:** [Regla generalizable para el futuro. Esta es la parte más importante.]

**Acciones tomadas:**
- [ ] Aplicada la corrección en la tarea actual.
- [ ] Documentada en ways-of-working si aplica (referenciar archivo).
- [ ] Añadido test si el error podría volver (link al test).

**Tags:** #formato #financiero #ui ...
```

---

## ✨ Ejemplos reales (plantilla viva)

```markdown
---

## 2026-05-14 16:30 — Formato de números en español

**Contexto:** Generando un KPI Card para el dashboard financiero con el ingreso del Q4.

**Error:** Renderizado del importe como "1247500" sin separador de miles ni símbolo €.

**Corrección de Guille:** "En España los miles van con punto y los decimales con coma,
y siempre con € al final. Sería 1.247.500,00 €."

**Causa raíz:** No existía una utilidad centralizada de formato; cada componente
formateaba a su manera.

**Lección:** Todo importe monetario debe pasar por `formatCurrency()` con locale
`es-ES` por defecto. Crear utility en `packages/utils/currency.ts` y usarla
siempre. NUNCA `${value}€` ni `value.toLocaleString()` suelto.

**Acciones tomadas:**
- [x] Creada `formatCurrency(value, options?)` en `packages/utils/`.
- [x] Aplicada en KPICard.
- [x] Añadido test con casos: enteros, decimales, negativos.
- [x] Documentado en `.claude/docs/ways-of-working/02-codigo.md`.

**Tags:** #formato #moneda #i18n #españa

---

## 2026-05-15 09:42 — Confirmación antes de operaciones destructivas

**Contexto:** Tarea de limpieza de migraciones SQL obsoletas en `services/supabase/migrations/`.

**Error:** Borré 3 archivos de migración sin confirmar con Guille, asumiendo que
eran obsoletos porque las tablas correspondientes ya no existían.

**Corrección de Guille:** "Las migraciones son el historial inmutable de la BD.
Aunque la tabla ya no exista, otros entornos (staging, backups) las necesitan para
reconstruir. Nunca las borres sin preguntar."

**Causa raíz:** Falta de regla explícita sobre archivos "históricos" que parecen
obsoletos pero son críticos para reproducibilidad.

**Lección:** Categorizar tipos de archivos:
1. **Inmutables históricos:** migraciones SQL, ADRs, CHANGELOG. NUNCA borrar sin
   permiso explícito.
2. **Generados:** `node_modules`, `dist`, builds. Borrar libremente si hay backup.
3. **Working files:** todo lo demás. Pedir confirmación si hay duda.

**Acciones tomadas:**
- [x] Restaurados archivos desde git.
- [x] Añadida regla a `.claude/docs/ways-of-working/05-seguridad.md` sección
      "Cosas que NUNCA hacemos".
- [x] Esta lección queda como caso de referencia.

**Tags:** #proceso #migraciones #destructivas #confirmacion
```

---

## 🔄 Ciclo de vida de las lecciones

### 1. Captura inmediata
La entrada en `log.md` se añade en la **misma sesión** donde ocurre el error, no
"después". Si Claude comete un error a las 16:30, la entrada está escrita antes de
las 16:35.

### 2. Aplicación inmediata
Si la lección genera una utility, un test, una regla → se crean **en la misma sesión**.
No se deja para después.

### 3. Lectura en sesiones futuras
Al inicio de cada nueva sesión, Claude **lee `log.md` completo** como parte del
contexto. Si crece mucho (>200 entradas), se compacta (ver más abajo).

### 4. Promoción a regla permanente
Cuando una lección se repite o es estructural, **se promueve** a:
- Una regla en `ways-of-working-*.md`.
- Una utility en `packages/utils/`.
- Un test que la previene.

La entrada original en `log.md` se mantiene (es historia), pero se añade nota:
`> Promovido a .claude/docs/ways-of-working/02-codigo.md sección "Formato".`

### 5. Compactación periódica (cuando crezca)
Si `log.md` supera ~150-200 entradas, Claude genera un `compactado.md` que agrupa
las lecciones por tema y las resume. El `log.md` original se mantiene como historia.

---

## 🧪 Estructura del SKILL.md de lessons-learned

El archivo `SKILL.md` es lo que Claude Code lee al inicio. Debe ser conciso y
apuntar al `log.md` para detalle.

Plantilla (ya creada en `.claude/skills/lessons-learned/SKILL.md`):

```markdown
---
name: lessons-learned
description: Lecciones aprendidas en sesiones anteriores. Léelo al inicio.
---

# Lecciones Aprendidas — Alsari Capital OS

Este skill carga el conocimiento acumulado sesión a sesión.

## Cómo usarlo
1. Al inicio de cada sesión, lee `log.md` completo.
2. Si vas a hacer algo que tocó una lección previa, aplícala sin esperar
   a que Guille lo recuerde.
3. Si cometes un error y Guille corrige, añade entrada nueva ANTES de seguir.

## Archivos
- `log.md` — Crónica completa de lecciones.
- `compactado.md` — (Si existe) Resumen agrupado por tema.

## Reglas de oro
- Reconocer error en una frase, sin disculpas excesivas.
- Causa raíz, no síntoma.
- Generalización: ¿qué regla evita este tipo de error en el futuro?
- Acción concreta: ¿qué cambia hoy en el código/docs para que no vuelva?
```

---

## 📊 Métricas de salud del sistema de aprendizaje

Cada cierto tiempo (mensual), revisamos:

1. **Lecciones nuevas por semana** → si crece, hay áreas que aprender; si baja, el
   sistema madura.
2. **Lecciones repetidas** → bandera roja. Significa que no se está promoviendo a
   regla permanente.
3. **Lecciones promovidas a ways-of-working** → bandera verde. El conocimiento se
   institucionaliza.
4. **Lecciones por módulo** → identifica qué módulos requieren más cuidado.

---

## ⚠️ Anti-patrones del sistema de aprendizaje

1. ❌ **Disculparse en lugar de aprender.** "Lo siento mucho, no volverá a pasar"
   no es una lección. Es ruido emocional. Cero disculpas excesivas; máxima precisión
   en el aprendizaje.

2. ❌ **Lección sin acción.** Si la lección no genera un cambio concreto (código,
   doc o test), no se ha aprendido nada.

3. ❌ **Lección demasiado específica.** "No usar `text-3xl` en el dashboard
   financiero" es inútil. La lección general es "tamaños de texto deben venir
   de la escala documentada en `04-ui-ux.md`".

4. ❌ **Esperar al final de la sesión.** El contexto se pierde. Captura en caliente.

5. ❌ **Inflación de tags.** No más de 4 tags por entrada. Si no encajan en 4, la
   lección es demasiado amplia.

---

## ✅ Resumen ejecutivo

> *"Cada error es un activo si se convierte en regla. Cada regla aplicada es una
> sesión más rápida y precisa. El sistema mejora solo cuando los errores se
> registran inmediatamente, se generalizan correctamente, y se promueven a
> conocimiento permanente."*
