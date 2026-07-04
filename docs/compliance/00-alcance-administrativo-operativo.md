# Compliance 00 — Alcance administrativo-operativo de Antifrágil OS v1

> **Documento clave.** Define la frontera de datos del sistema. Todo diseño de modelo de datos,
> todo campo de UI y todo PR se contrastan contra este documento.
> **Estado:** vigente para v1 · **Pendiente:** validación por asesor legal / DPO antes de
> cualquier despliegue con datos reales. Este documento fija la frontera técnica y funcional;
> **no sustituye asesoría legal**.

---

## 1. La decisión

**Antifrágil OS v1 es un sistema administrativo-operativo. NO es historia clínica.**

La historia clínica y los datos clínicos relevantes permanecen **fuera** del sistema
(hoy en Notion; en el futuro, quizá Salonized u otro software clínico). Antifrágil OS
solo puede guardar una **referencia externa controlada** (ID/enlace), nunca contenido clínico.

### Por qué (razón de diseño, en lenguaje claro)

Los datos de salud son **categoría especial** de datos personales (art. 9 RGPD): exigen base de
legitimación reforzada, medidas de seguridad reforzadas, posible evaluación de impacto (EIPD) y
elevan el riesgo sancionador y reputacional de TODO el sistema que los contiene. Manteniendo el
OS fuera de esa categoría:

- el OS se desarrolla y evoluciona **rápido** sin arrastrar requisitos sanitarios;
- una brecha del OS **no expone salud** de nadie;
- la superficie regulada queda **concentrada** en un único sistema externo (Notion/software
  clínico), que es donde se blinda.

**Regla mental: un solo dato clínico dentro del OS contamina el sistema completo.**
Un dato clínico en el OS no es un feature: **es un bug de compliance** y se trata como tal
(se elimina, se revisa cómo entró, y se registra la lección).

---

## 2. Datos permitidos

| Categoría | Ejemplos de campos |
|---|---|
| **Agenda** | citas, fecha/hora, duración, profesional asignado, sala, servicio del catálogo, estado de cita (reservada/confirmada/asistida/no-show/cancelada), asistencia/no asistencia |
| **Clientes administrativos** | nombre, datos de contacto, datos de facturación, origen (cómo nos conoció), derivador (quién lo deriva), partner (Vivofácil, Oasis, Lidomare), fecha de alta, preferencias administrativas (horario, idioma) |
| **Servicios generales** | catálogo comercial de servicios, tarifas, bonos (saldo de sesiones), programas (sesiones consumidas/restantes) |
| **Económico** | cobros, método de pago, facturación/cierres, caja, banco, tesorería |
| **Gestión** | profesionales (datos laborales/administrativos), rentabilidad, KPIs, proyectos, finanzas |
| **Enlace externo** | `referencia_externa` (ID/URL a Notion/Salonized/sistema clínico), sin contenido |

## 3. Datos prohibidos

| Categoría | Nunca en el OS |
|---|---|
| Historia clínica | ficha clínica, cualquier réplica parcial de ella |
| Diagnóstico | diagnósticos, sospechas diagnósticas, códigos CIE |
| Lesión / patología | lesiones, condiciones, "motivo clínico concreto" de la visita |
| Evolución | notas de evolución, progreso terapéutico, escalas clínicas |
| Antecedentes | historial médico, cirugías, alergias |
| Medicación | fármacos, pautas, dosis |
| Tratamiento | plan de tratamiento, técnicas aplicadas, ejercicios prescritos |
| Documentación | informes, pruebas (analíticas, imagen), documentos sanitarios |
| Multimedia | audios clínicos, imágenes clínicas, vídeos de valoración |

## 4. Ejemplos concretos (la línea en la práctica)

| ✅ Permitido | ❌ Prohibido (versión clínica de lo mismo) |
|---|---|
| Cita: "Fisioterapia — sesión 55'" con estado "asistida" | Cita: "rehab post-quirúrgica LCA rodilla dcha, 3ª semana" |
| Cliente: origen = "derivado por Dr. X (traumatología)" | Cliente: "derivado por Dr. X por rotura fibrilar isquios" |
| Bono: "Programa 5 sesiones — quedan 2" | Bono: "5 sesiones para tendinopatía rotuliana — evoluciona bien" |
| Observación admin: "prefiere tardes; avisar por WhatsApp" | Observación: "dolor lumbar irradiado, evitar carga axial" |
| No-show: "no asistió, se recupera la sesión el jueves" | No-show: "no vino por brote de ciática" |
| Enlace: `notion.so/<id-ficha>` (solo referencia) | Pegar el contenido de la ficha de Notion en el OS |
| Factura: concepto "Nutrición — consulta seguimiento" | Factura: concepto "dieta para diabetes tipo II" |

## 5. Reglas para campos libres (la vía de contaminación nº1)

Los campos de texto libre (`observaciones`, `notas`, `comentario`, `descripcion`) son la puerta
por donde entra el contenido clínico sin que nadie lo decida. Reglas:

1. **Naming no clínico:** los campos se llaman `notas_admin`, `observaciones_agenda` — nunca
   `notas` a secas ni nada que invite a escribir clínica.
2. **Microcopy de aviso:** todo campo libre lleva helper text visible:
   *"Solo información administrativa. No escribir información clínica (síntomas, diagnóstico,
   evolución…): eso va en la ficha externa."*
3. **Minimización:** antes de añadir un campo libre, justificar por qué no basta un
   select/estado/etiqueta cerrada. Cada campo libre nuevo se aprueba en revisión de PR.
4. **Revisión periódica:** auditoría muestral de campos libres antes de producción y después
   de forma recurrente; si aparece contenido clínico → se borra, se refuerza el microcopy/
   formación, y se registra.
5. **Sin adjuntos genéricos:** el OS no tiene "subir archivo" genérico en clientes/citas
   (evita que suban informes/pruebas). Los adjuntos permitidos son económicos (justificantes
   de pago, facturas) y viven en su módulo.

## 6. Implicaciones por módulo

### Agenda / Reservas
- La cita referencia un **servicio del catálogo comercial** (p.ej. "Fisioterapia — sesión"),
  jamás un motivo clínico. Si recepción necesita contexto, el enlace externo lleva a la ficha.
- Estados de cita = administrativos (reservada, confirmada, asistida, no-show, cancelada,
  recuperada). Nada de estados tipo "en tratamiento".
- El panel del paciente en agenda muestra: datos de contacto, bonos/saldo, historial de
  **citas** (fechas y servicios), origen/derivador, cobros. Nunca contenido clínico.

### Finanzas / Facturación
- Conceptos de factura/prefactura = **nombre comercial del servicio del catálogo**. La factura
  de una clínica no necesita (ni debe) describir la condición del paciente.
- La rentabilidad se mide por servicio/profesional/proyecto — métricas agregadas, sin datos
  de salud individuales.
- El tratamiento fiscal (exención sanitaria) se define **por producto del catálogo** (decisión
  D3), no requiere datos clínicos del paciente en el OS.

### Clientes administrativos
- La ficha de cliente es **administrativa**: identificación, contacto, facturación, origen,
  derivador, partner, bonos, historial de citas y cobros.
- `derivador` es un dato comercial (quién nos manda clientes) — se guarda la entidad/profesional
  que deriva, **no** el motivo médico de la derivación ni el informe de derivación.
- Partners (Vivofácil, Oasis, Lidomare): datos de liquidación/cierre — códigos de servicio,
  volúmenes, importes. Sin contenido clínico.

## 7. Checklist antes de producción (gate de despliegue)

- [ ] Auditoría de **todos los campos** del modelo de datos contra §2/§3 (ninguno capaz de
      almacenar clínica por diseño).
- [ ] Todos los campos libres con naming no clínico + microcopy de aviso (§5).
- [ ] `referencia_externa` implementada como ID/URL opaco, visible solo a roles autorizados.
- [ ] Sin "subir archivo" genérico en clientes/citas.
- [ ] Permisos por rol revisados (recepción/profesional/dirección ven lo mínimo necesario).
- [ ] Registro de actividades de tratamiento actualizado (el OS como tratamiento administrativo).
- [ ] Política de privacidad de la clínica refleja qué sistema guarda qué.
- [ ] Frontera Notion↔OS operativa y revisada ([01-frontera-notion-antifragil-os.md](01-frontera-notion-antifragil-os.md)).
- [ ] **Validación de asesor legal / DPO obtenida.**
- [ ] Formación breve al equipo: qué se escribe en el OS y qué se escribe en la ficha externa.

---

*Cualquier excepción a este documento requiere decisión explícita de Guille + validación legal,
y se registra como ADR en `docs/decisiones/`.*
