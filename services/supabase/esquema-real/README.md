# Esquema real de Antifrágil OS — reflejo versionado

> **Qué es esto:** la foto fiel, generada por reflexión, del esquema `public` que
> **ya está aplicado** en el proyecto Supabase `antifragil-os` (2026-07-16).
> **No es una migración para aplicar sobre esa base** (allí ya existe todo);
> es la fuente de verdad versionada del esquema vivo y permite reconstruir la
> base desde cero si hiciera falta.

## Por qué existe

El vertical operativo (gastos, ingresos, cobros, CxC, facturas OPS, liquidaciones,
bonos, clínica) se aplicó sobre la base real **sin quedar versionado en el repo**
(deuda registrada en `docs/SESSION.md` §7 y `docs/finanzas/15`). Los paquetes
draft de los PRs #4 (baseline) y #12 (catálogos clínica) quedaron por detrás de
la realidad. Este directorio cierra ese drift.

## Cómo se generó

Lectura de catálogos (`information_schema` + `pg_catalog`) vía Management API
(`POST /v1/projects/{ref}/database/query`, **solo SELECT**), y ensamblado
determinista del DDL con `scripts/db/reflejar-esquema.py` (mismo repo). Nada se
escribió en la base. Para regenerar: ver la cabecera del script.

## Contenido de la base (2026-07-16)

**58 tablas · 21 enums · 12 funciones propias · 12 vistas · 36 triggers ·
74 políticas RLS · 2 buckets privados.** Grupos funcionales:

| Grupo | Tablas (muestra) | Estado de datos |
| --- | --- | --- |
| Núcleo financiero (ex-baseline #4) | `sociedades`, `proyectos`, `facturas_recibidas`, `movimientos_bancarios`, `plan_cuentas`, `presupuestos*`, `asientos_*` | `facturas_recibidas` 99 filas; `movimientos_bancarios` **0** (falta export banco) |
| Tesorería A1 | `cuenta_tesoreria`, `movimiento_caja`, `arqueo_caja` | 2 cuentas; ledgers a 0 |
| Operativa MVP | `gastos_operativos` (514), `ingresos_devengados` (158), `cobros` (37), `cuentas_por_cobrar` (11), `facturas_emitidas_operativas` (21) | **Datos reales cargados** |
| Liquidaciones | `liquidaciones_mensuales` (71), `lineas_liquidacion` (72), `reglas_liquidacion_profesional`, `evidencias/ajustes/pagos_liquidacion` | Histórico nov-2024→dic-2025 |
| Bonos (ledger) | `ventas_bono`, `consumos_bono`, `caducidades_bono`, `devoluciones_bono` | Estructura lista, sin datos |
| Clínica | `clinica_*` (13: catálogos A2 + `clinica_citas` + `clinica_usuarios`) | `clinica_profesionales` 10; `clinica_citas` **0** (Reservas aún no conectado) |
| Roles operativos | `perfiles_operativos`, `canales`, `configuracion_contabilidad` | Modelo de rol en BD ya construido |

Detalle curioso y valioso: `clinica_citas` ya trae **constraint de exclusión
anti-solapes** por profesional (`gist` sobre `tstzrange(inicio, fin)`).

## Auditoría RLS (resumen)

- **Las 58 tablas tienen RLS activado** y al menos una política. Regla suprema
  del repo cumplida.
- 41/74 políticas son la base permisiva (`authenticated` + `using (true)`) —
  pendiente de endurecer donde toque, como ya preveía `docs/finanzas/15` §85.
- **Existe una capa de roles fina ya operativa** vía `rol_operativo_actual()`,
  `es_direccion()`, `profesional_actual()` y el enum `rol_operativo`
  (direccion/coordinacion/recepcion/profesional): profesionales solo ven sus
  liquidaciones; coordinación no ve gastos de categoría nóminas; escrituras de
  agenda restringidas a dirección/coordinación/recepción.
- Buckets `facturas` y `documentos-operativos`: **privados** los dos.
- Matiz importante: el host accede con `service_role` (bypassa RLS), así que
  estas políticas protegen los accesos que NO pasan por el host (p. ej. futuros
  clientes anon/authenticated). No sustituyen a los guards de la app.

## Gaps conocidos detectados al reflejar

1. `gastos_operativos` **no tiene** la columna `cuenta_tesoreria` que la UI de
   Tesorería (PR #46) lee de forma tolerante (`select=*`): el desglose
   Caja/Banco del héroe mostrará caja solo con entradas de efectivo hasta que
   se añada la columna (candidata a paquete A1b) o se derive de `medio_pago`.
2. `movimientos_bancarios` vacío: bloqueado por el export real del banco (Lidia).
3. `clinica_citas` lista (con anti-solapes y RLS por rol) pero el módulo
   Reservas sigue en mock: conectar Reservas ↔ esta tabla es el Bloque B.
4. Los PRs #4 y #12 (draft NO APPLY) han quedado **superados por la realidad**:
   su contenido está aplicado y extendido. Propuesta: cerrarlos enlazando a este
   reflejo, que pasa a ser la referencia del esquema.

## Ficheros

- `2026-07-16_reflejo_esquema_antifragil_os.sql` — DDL completo ordenado
  (enums → funciones → tablas → constraints → índices → vistas → triggers →
  RLS → comentarios).
- `post_reflejo_checks.sql` — verificación de paridad repo ↔ base viva
  (conteos por tipo de objeto y por tabla clave).

## Reglas de uso

- La base viva **no se toca** desde este directorio. Cualquier cambio de esquema
  futuro = nuevo paquete/migración con su PR, y regenerar este reflejo después.
- El plan free **pausa el proyecto tras ~1 semana sin uso** (pasó entre el 8 y
  el 16 de julio: DNS del proyecto desaparece y la web no puede leer). Decidir
  upgrade de plan o asumir reactivaciones manuales.
