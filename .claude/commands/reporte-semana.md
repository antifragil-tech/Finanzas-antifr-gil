---
description: Generar borrador del Reporte de Semana de Alsari Capital siguiendo el formato ejecutivo para los socios.
argument-hint: "[fecha-de-inicio-opcional YYYY-MM-DD]"
---

# Tarea: Generar Reporte de Semana de Alsari Capital

El Reporte de Semana es un documento ejecutivo que Guille produce para los socios
(Javier y Iván Alarcón Rivera). Sigue este flujo:

## 1. Determinar el periodo

- Si el usuario pasa fecha en `$ARGUMENTS`, úsala como inicio.
- Si no, usa la fecha del lunes de esta semana hasta hoy.

## 2. Recopilar contenido

Pregunta al usuario por cada sección. **NO inventes datos**. Si el usuario no
tiene info de una sección, márcala como "Sin novedades esta semana".

Secciones a cubrir:

### a) Hitos cerrados
Logros concretos de la semana (firmas, cierres, entregas, decisiones).

### b) Activos y proyectos en seguimiento
Estado actual de los activos inmobiliarios y proyectos clave:
- Las Mesas / Le Toit Grand 10
- Laguna Park / Perisur
- Alborán Living / Capellanía
- Campanillas
- King's Haven
- Veracruz
- (otros que aparezcan)

### c) Banca y tesorería
- Movimientos relevantes con CaixaBank, Sabadell, Santander.
- Estado de los fondos pignorados.
- Earn-out de Evariste (si hay novedades).
- Préstamos intragrupo.

### d) Asuntos legales y contables
- Avances con FMC Legal (Mariano de la Huerga).
- Avances con Asesoría MM (Ramón).
- Vencimientos próximos.

### e) Riesgos y alertas
Cosas a vigilar la próxima semana.

### f) Próximos pasos
3-5 acciones priorizadas para la semana siguiente.

## 3. Generar el documento

Crea un archivo en `docs/reportes-semana/YYYY-MM-DD_reporte-semana.md` con
este formato:

```markdown
# Reporte de Semana — Alsari Capital

**Periodo:** [fecha inicio] – [fecha fin]
**Para:** Javier Alarcón Rivera, Iván Alarcón Rivera
**De:** Guille (Director General)

---

## 1. Hitos cerrados esta semana
[...]

## 2. Activos y proyectos en seguimiento
[...]

## 3. Banca y tesorería
[...]

## 4. Asuntos legales y contables
[...]

## 5. Riesgos y alertas
[...]

## 6. Próximos pasos
[...]

---

*Reporte generado el [fecha] · Alsari Capital · Confidencial.*
```

## 4. Sensibilidad de datos

- **NO incluyas IBANs completos.** Últimos 4 dígitos si hace falta referenciar
  una cuenta.
- **NO incluyas DNIs.**
- **Sí puedes incluir** nombres de entidades del holding, importes globales,
  nombres de proveedores y contactos profesionales.

## 5. Confirmación

Muéstrale el borrador completo al usuario y pregunta:
1. ¿Falta algo?
2. ¿Algún dato sensible que retirar antes de enviar?
3. ¿Quieres que lo convierta a Word/PDF para enviar?

NO envíes nada automáticamente. El borrador queda en el repo para que Guille
lo revise y envíe manualmente.
