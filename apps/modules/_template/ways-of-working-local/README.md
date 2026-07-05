# Ways of Working — Locales del Módulo `[NOMBRE]`

> Reglas específicas de este módulo. **No pueden contradecir las globales.**
> Si necesitas contradecir una global, abre un PR para discutirlo y, si procede,
> modifica la global.

---

## 📚 Índice

| Nº  | Archivo     | Propósito                     |
| --- | ----------- | ----------------------------- |
| 01  | (Pendiente) | Modelo de datos del módulo    |
| 02  | (Pendiente) | Reglas de negocio específicas |

---

## ⚠️ Requisito crítico — Tailwind del host

Cuando se añade un módulo nuevo, **hay que añadir su ruta** al array `content` de
`apps/host/tailwind.config.ts`. El patrón ya está puesto como
`'../modules/*/src/**/*.{ts,tsx}'` — mientras se respete la convención de carpetas
(`apps/modules/<nombre>/src/`) no hay que hacer nada adicional.

Si se añade un host alternativo o un segundo nivel de módulos, repetir el patrón.
No usar `'../modules/**/*'` sin restringir a `src/` — escaneará `node_modules/`
de cada módulo y colgará el dev server.

---

## 🧭 Cuándo añadir reglas locales

✅ SÍ:

- Reglas de cálculo financiero particulares (ej. cómo se calcula el yield específico
  para Alsari).
- Convenciones de naming de entidades (ej. todas las tablas del módulo financiero
  llevan prefijo `fin_`).
- Particularidades de UI del módulo (ej. este módulo usa una visualización de gráficos
  específica con configuración estándar).

❌ NO:

- Reglas que aplican a todo el OS → van al global.
- Justificaciones de decisiones técnicas → van a un ADR.
