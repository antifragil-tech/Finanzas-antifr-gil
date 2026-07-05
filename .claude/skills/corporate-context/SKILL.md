---
name: corporate-context
description: Contexto corporativo de Alsari Capital. Entidades del holding, proyectos inmobiliarios, contactos clave y operativa del grupo. Cárgalo cuando trabajes en cualquier feature que toque datos del negocio.
---

# Contexto Corporativo — Alsari Capital

> Conocimiento estructurado sobre el holding Alsari Capital, sus entidades, proyectos
> y operativa. Esto te permite tomar decisiones técnicas alineadas con el negocio
> sin tener que preguntar a Guille cosas básicas.

---

## 🏢 Estructura del holding

### Sociedad matriz

- **Alsari Capital** — Holding operativo central. Aglutina las líneas de negocio.

### Sociedades de socios

- **Pavier Legacy Group S.L.** — Propiedad de Javier Alarcón Rivera. Vehículo de
  gestión patrimonial.
- **Armia Group S.L.** — Propiedad de Iván Alarcón Rivera. Vehículo de gestión
  patrimonial.

### Otras sociedades operativas

- **Alsari Inversiones** — Sociedad de inversiones.
- **Rialsa Obras S.L.** — Empresa vinculada (tenant confirmado del activo de Campanillas).

### Proyectos independientes (con otros socios)

- **CENS** — Proyecto sector salud. Otros socios de capital fuera del holding.
- **Antifrágil** — Proyecto independiente. Otros socios.

---

## 🏗️ Activos y proyectos inmobiliarios

| Proyecto / Activo                | Ubicación       | Estado           | Notas                             |
| -------------------------------- | --------------- | ---------------- | --------------------------------- |
| **Las Mesas / Le Toit Grand 10** | Estepona        | Activo           | Promoción residencial             |
| **Laguna Park / Perisur**        | (Por confirmar) | Activo           | Proyecto en curso                 |
| **Alborán Living / Capellanía**  | (Por confirmar) | Activo           | Vinculado a Proinco               |
| **Campanillas**                  | Málaga          | Activo logístico | ~398K€ plot, tenant: Rialsa Obras |
| **King's Haven**                 | (Por confirmar) | Villa de lujo    | Activo del holding                |
| **Veracruz**                     | —               | Embarcación      | Gestionada por el grupo           |

---

## 👥 Contactos clave

### Internos (toma de decisiones)

| Persona                   | Rol                                                            |
| ------------------------- | -------------------------------------------------------------- |
| **Guille**                | Director General / Delegado Ejecutivo (interlocutor de Claude) |
| **Javier Alarcón Rivera** | Socio principal (vía Pavier Legacy Group)                      |
| **Iván Alarcón Rivera**   | Socio principal (vía Armia Group)                              |

### Externos (proveedores de servicios)

| Persona / Entidad                     | Función                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| **FMC Legal / Mariano de la Huerga**  | Asesoría legal                                            |
| **CaixaBank / Víctor Manuel Navarro** | Banca CaixaBank                                           |
| **Banco Sabadell**                    | Banca alternativa                                         |
| **Santander**                         | Banca (fondos pignorados liberándose 2025-2029)           |
| **Asesoría MM / Ramón**               | Contabilidad externa                                      |
| **Proinco**                           | Contratista (Alborán Living)                              |
| **Evariste S.A.S.**                   | Empresa con earn-out pendiente (tied to Rialsa 2025 EBIT) |

---

## 💼 Particularidades financieras vivas

1. **Earn-out pendiente de Evariste S.A.S.** — Pago condicionado al EBIT 2025 de
   Rialsa. Estar atento al cierre contable de Rialsa.
2. **Fondos pignorados en Santander** — Liberándose progresivamente entre 2025 y 2029.
3. **Préstamos intragrupo** — Existen varios entre las sociedades del holding.
   Requieren tracking específico para no descuadrar la consolidación.

---

## 🌍 Idioma y locale

- **Idioma de la UI y comunicación:** Español (es-ES).
- **Locale numérico:** `es-ES`.
  - Miles: punto (`1.234.567`).
  - Decimales: coma (`1.234,56`).
  - Moneda: `1.234,56 €` (€ al final con espacio).
- **Formato de fechas:** `DD/MM/YYYY` en UI; `YYYY-MM-DD` en BD y código.
- **Zona horaria:** Europe/Madrid (CET/CEST).

---

## 🔐 Sensibilidad de datos

| Tipo de dato                    | Sensibilidad | Reglas                                      |
| ------------------------------- | ------------ | ------------------------------------------- |
| CIFs, IBANs, importes           | Alta         | RLS obligatorio, sin logs                   |
| Contactos personales            | Media        | RLS, no exposición pública                  |
| Nombres de proyectos            | Baja-Media   | Públicos internamente, no en repos públicos |
| Estructura societaria           | Media        | Solo admins                                 |
| Earn-outs, préstamos intragrupo | Muy alta     | Solo socios y Guille                        |

---

## 📊 Tipos de reportes recurrentes

### Reporte de Semana

Documento ejecutivo semanal que Guille produce para los socios. Cubre:

- Hitos cerrados.
- Activos en seguimiento.
- Banca y tesorería.
- Asuntos legales pendientes.
- Próximos pasos.

Cualquier feature de "reportes" en el módulo financiero debe contemplar este formato
como ciudadano de primera clase.

---

## 🧭 Cómo usar este contexto

Cuando construyas:

- **Módulo financiero:** considera todas las entidades del holding como contexto
  multientidad. Las queries deben filtrar por `entity_id`.
- **Módulo de facturas:** entidades emisoras/receptoras son las del holding + externas.
- **Módulo de proyectos:** los proyectos inmobiliarios listados arriba son los datos
  iniciales del seed.
- **Cualquier reporte:** asume que se enviará a los socios. Datos sensibles deben
  estar protegidos.

---

## 🔄 Mantenimiento de este skill

Cuando aparezcan nuevas entidades, proyectos o contactos clave:

1. Añadir aquí.
2. Commit: `docs(claude-skill): añadir [entidad/proyecto/contacto] a corporate-context`.

Mantén este archivo conciso. Si crece mucho (> 500 líneas), divide en sub-archivos
dentro de la misma carpeta.
