# Roadmap — Antifrágil OS

> Declaración priorizada de intenciones. **No es un compromiso de fechas.**
> Guille marca prioridades; Claude propone detalles técnicos.
> Documento **ejecutivo**: el detalle técnico vive en `ARQUITECTURA.md`,
> `CHANGELOG.md` y `SESSION.md`.

**Última revisión:** 2026-07-16 · MVP web operativo en producción sobre la base
Supabase real; plan por bloques A–G acordado ("haremos todas").

> El roadmap anterior (2026-06-19) describía **Alsari Capital OS** (holding:
> Financiero/Contabilidad/Presupuestos). Ese vertical quedó **fuera del runtime**
> (cirugía del 2026-07-05) y sus módulos solo se conservan como código heredado
> sin montar. Este roadmap es el del producto vivo: **Antifrágil OS (clínica)**.

---

## 🎯 Visión

Un OS interno que cubra la operativa diaria de la clínica: **agenda/reservas de
recepción conectada al dinero** (cobros, liquidaciones, rentabilidad), con
importación fiable de las fuentes reales (Salonized, banco, efectivo) y una capa
financiera precontable que alimente a gestoría. Administrativo-operativo:
**nunca historia clínica**.

## ✅ Conseguido hasta hoy (resumen)

- **MVP web con datos reales** (PRs #31–#46): Tesorería (entrada manual, factura
  OPS imprimible, importación CSV idempotente, conciliación banco↔factura),
  Rentabilidad (escalera M1→M3), Liquidaciones (histórico nov-2024→dic-2025) y
  **Panel de dirección con datos reales** y avisos accionables.
- **Base Supabase real poblada y versionada** (PR #47): 58 tablas con RLS,
  capa de roles operativos en BD, esquema reflejado en
  `services/supabase/esquema-real/`.
- Marca visible Antifrágil en toda la UI; legado Alsari desmontado del runtime.

## 🛣️ Bloques de trabajo (orden vigente)

### A — Cimientos de datos ✅ COMPLETADO (2026-07-16)

Esquema real versionado + auditoría RLS + PRs #4/#12 cerrados.
**Cola restante:** endurecer las 41 políticas permisivas · identidad real del
escritor en las escrituras del host · rotar token `sbp_` (Javi).

### B — Reservas con backend ⏭️ SIGUIENTE (prioridad nº1 de negocio)

Conectar el módulo Reservas (hoy maqueta UI completa) a la base real:

1. Catálogos reales (`clinica_profesionales`, `clinica_servicios`, horarios).
2. Citas persistentes sobre `clinica_citas` (la tabla ya existe, con
   anti-solapes y RLS por rol) — crear/mover/cancelar/completar con histórico.
3. Cobros de recepción conectados a `cobros`/CxC (el dinero del día).
4. Bonos sobre el ledger real (`ventas/consumos_bono`).
5. Flujo de reserva pública del cliente (fase posterior, `src/cliente`).

### C — Ingesta de fuentes reales (bloqueado por exports)

Validar plantillas contra los archivos reales: **Salonized** (desbloquea
rentabilidad por profesional/servicio/centro y liquidaciones del mes corriente)
y **extracto del banco** (Lidia; `movimientos_bancarios` sigue a 0).

### D — Configuración real

Usuarios/roles (sobre `perfiles_operativos` ya existente), centros, catálogo
de servicios/tarifas administrable.

### E — Finanzas operativas (serie FOP, docs 04–14)

Liquidaciones automáticas desde agenda · bonos/devengo · CxC/CxP completo ·
imputación de costes compartidos · presupuesto vs real y forecast.
Diseño documental hecho; parte del modelo ya existe como tablas en la base.
**Gateado por las decisiones del bloque F.**

### F — Decisiones de negocio (Guille / Fernando / gestoría)

Las que bloquean E y parte de B: costes generales (contribución vs prorrateo),
recepción compartida, acuerdos partners (Lidomare/Vivofácil/Oasis), devengo y
caducidad de bonos, regla de extras en liquidaciones, política de CxC, forecast,
UG/PM, plan de pago de Supabase. Lista viva en `SESSION.md` §6.

### G — Higiene continua

Docs reconciliados (este bloque, en curso) · tests de host y reservas · E2E en
CI · rebrand `@alsari/*` → `@antifragil/*` (fase dedicada) · decommission del
código heredado del holding cuando se decida.

---

## 🚧 Deuda técnica visible

| Deuda                                | Nota                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Políticas RLS permisivas (41/74)     | Endurecer por rol; la capa de roles ya existe en BD                    |
| Identidad del escritor               | `'entrada-manual-web'` en vez del usuario autenticado                  |
| Pausas del plan free de Supabase     | Sin uso ~1 semana → base pausada y web sin datos; decidir plan de pago |
| Tests                                | 0 en host y reservas; ~53 en `operativa`; E2E off                      |
| Rebrand `@alsari/*`                  | Solo la marca visible es Antifrágil; scopes internos en fase dedicada  |
| Docs históricos sin reconciliar      | `docs/integration/*`, `docs/governance/00` (pre-MVP)                   |
| Columna `cuenta_tesoreria` en gastos | La UI la lee tolerante; añadirla (A1b) o derivar de `medio_pago`       |

## 💡 Ideas a evaluar (sin priorizar)

- Notificaciones (recordatorios de cita por WhatsApp; avisos de cobro pendiente).
- MCP propio para consultar el OS desde Claude.
- PWA/offline para recepción.

## 🔄 Cómo se actualiza este roadmap

1. Guille revisa prioridades y mueve bloques.
2. Al completar un bloque, Claude lo mueve a `CHANGELOG.md` y actualiza esto.
3. Ideas nuevas entran al final hasta que se priorizan.
