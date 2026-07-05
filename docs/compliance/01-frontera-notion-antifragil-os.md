# Compliance 01 — Frontera Notion ↔ Antifrágil OS

> Cómo conviven el sistema clínico externo (hoy Notion) y Antifrágil OS sin que el contenido
> clínico cruce nunca la frontera. Complementa a
> [00-alcance-administrativo-operativo.md](00-alcance-administrativo-operativo.md).
> **Pendiente:** validación por asesor legal / DPO. Este documento fija la frontera técnica;
> no sustituye asesoría legal.

---

## 1. El reparto

| Sistema                                                          | Guarda                                                                                                                                 | No guarda                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Notion** (hoy; mañana quizá Salonized u otro software clínico) | Historia clínica y datos clínicos relevantes: valoraciones, diagnóstico, evolución, tratamiento, informes, pruebas, multimedia clínico | Operativa administrativa (agenda, cobros, facturación) |
| **Antifrágil OS**                                                | Todo lo administrativo-operativo (ver compliance 00 §2) + **una referencia externa** a la ficha clínica                                | Cualquier contenido clínico (compliance 00 §3)         |

## 2. La referencia externa (lo ÚNICO que cruza)

- El OS guarda por cliente, como máximo, un campo `referencia_externa` (URL o ID de la ficha
  en Notion/sistema clínico).
- Es un puntero **opaco**: el enlace no contiene ni revela contenido clínico (ni en el texto
  visible, ni en el título del enlace, ni en parámetros de la URL).
- Visible solo para **roles autorizados** (dirección; profesional si procede). Recepción no
  necesita abrir la ficha clínica para gestionar agenda y cobros.
- Al hacer clic se abre el sistema externo **en su propia pestaña, con su propio login y sus
  propios permisos**. El OS nunca embebe (iframe/preview) contenido clínico dentro de su UI.

## 3. Prohibiciones de integración (explícitas)

- **No sincronizar diagnósticos** (ni ningún dato clínico) de Notion hacia el OS. En ninguna
  dirección, de hecho: tampoco el OS escribe en la ficha clínica.
- **No sincronizar evolución** ni notas de sesión.
- **No importar informes** ni documentos sanitarios (tampoco "temporalmente", tampoco al Storage).
- **No copiar/pegar** contenido de la ficha en campos del OS (regla operativa para el equipo:
  lo clínico se escribe y se lee en el sistema clínico, punto).
- **No construir APIs/automatizaciones** entre ambos sistemas que muevan contenido clínico
  (Zapier/Make/scripts incluidos). La única integración permitida es el enlace.

## 4. Notion como sistema con datos clínicos — revisión legal pendiente

Notion está actuando de facto como **sistema que aloja datos de salud** (categoría especial,
art. 9 RGPD). Eso obliga a revisarlo como proveedor/encargado de tratamiento. Puntos a validar
con el asesor legal / DPO (checklist de trabajo, no exhaustiva):

- [ ] **DPA** (acuerdo de encargo, art. 28 RGPD) de Notion: existencia, alcance y si el plan
      contratado lo cubre para datos de salud.
- [ ] **Transferencias internacionales:** Notion es proveedor estadounidense — verificar
      mecanismo vigente (Data Privacy Framework / SCCs) y residencia de datos disponible.
- [ ] **Idoneidad**: pronunciamiento del asesor sobre si Notion es aceptable como soporte de
      historia clínica (y la normativa de historia clínica aplicable en España/Andalucía),
      o si acelera la migración a un software clínico específico (p.ej. Salonized).
- [ ] **Accesos y permisos:** quién accede a qué páginas; mínimo privilegio por rol; revisar
      invitados externos; 2FA obligatorio en todas las cuentas.
- [ ] **Enlaces públicos:** PROHIBIDO "share to web" en páginas clínicas; auditar que no exista
      ninguno activo.
- [ ] **Backups / exportaciones:** política de copias (quién exporta, dónde se guardan las
      exportaciones, cifrado); las exportaciones sueltas en portátiles son una brecha esperando.
- [ ] **Política de privacidad** de la clínica: refleja que la HC vive en Notion (o el sistema
      que sea) y el OS solo gestiona lo administrativo.
- [ ] **Retención:** plazos legales de conservación de historia clínica y cómo se aplican en Notion.
- [ ] **Registro de actividades de tratamiento** actualizado con ambos sistemas.

## 5. Si mañana se migra de Notion a un software clínico

La frontera **no cambia**: se actualiza el destino de `referencia_externa` y la revisión legal
del nuevo proveedor (mismo checklist §4). El OS no se toca — esa es precisamente la ventaja
del diseño de referencia opaca.

---

_Regla final: si alguien duda de en qué sistema va un dato, la respuesta corta es —
¿es sobre la salud de la persona? → sistema clínico. ¿Es sobre la gestión del negocio? → OS.
Si sigue habiendo duda, se pregunta a Guille ANTES de escribirlo en el OS._
