# Ways of Working — Globales

> Reglas supremas de Alsari Capital OS.
> Aplican a todo el proyecto, en todos los módulos.
> Cualquier excepción debe estar documentada en un ADR.

---

## 📚 Índice de lectura recomendado

| Nº | Archivo | Cuándo leerlo |
|----|---------|---------------|
| 00 | [Rol y Autoridad](./00-rol-y-autoridad.md) | **SIEMPRE primero.** Define la división Claude/Guille. |
| 01 | [Arquitectura](./01-arquitectura.md) | Antes de tocar estructura, módulos o packages. |
| 02 | [Código](./02-codigo.md) | Antes de escribir código. |
| 03 | [Git Workflow](./03-git-workflow.md) | Antes de hacer commits o PRs. |
| 04 | [UI/UX](./04-ui-ux.md) | Antes de cualquier trabajo visual. |
| 05 | [Seguridad](./05-seguridad.md) | Antes de tocar auth, BD, secrets o datos sensibles. |
| 06 | [Testing](./06-testing.md) | Antes de añadir o modificar tests. |
| 07 | [Documentación](./07-documentacion.md) | Antes de tocar docs, README o changelogs. |
| 08 | [Glosario](./08-glosario.md) | Cuando aparezca un término nuevo. |
| 09 | [Protocolo de Aprendizaje](./09-protocolo-aprendizaje.md) | Cuando se cometa un error y haya corrección. |

---

## 🔄 Mantenimiento

Estas reglas evolucionan. Cuando cambien:

1. PR con cambio etiquetado `docs(wow): ...`.
2. Aprobación de Guille.
3. Entry en `docs/CHANGELOG.md` bajo categoría `Changed` o `Added`.

---

## 🧭 Reglas que aplican en cascada

Cuando trabajas dentro de un módulo, el orden de precedencia es:

1. **Ways of Working Globales** (este directorio) — base.
2. **Ways of Working Locales** (`apps/modules/[nombre]/ways-of-working-local/`) — pueden
   especializar pero NO contradecir las globales.

Si una regla local contradice una global → la global gana **y** se abre un PR para
clarificar la situación.
