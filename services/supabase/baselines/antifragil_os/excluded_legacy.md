# Exclusiones explícitas — qué NO entra en el baseline `Antifrágil OS`

Este Supabase nuevo se construye **limpio**. Nada de la base anterior (proyecto heredado) entra. Lista explícita de lo excluido y por qué.

## Identidad / marca

| Excluido | Motivo |
|---|---|
| **Alsari**, **Rialsa** | Holding/empresa del repo reciclado. Identidad ajena a Antifrágil. |
| **Pavier**, **Armia** | Sociedades tenedoras del doble holding heredado. |
| Dominio **`alsari.net`** | NO se usa como dominio autorizado. Identidad = Antifrágil. Los emails de operadores quedan **placeholder** (`pendiente@antifragil.invalid`) hasta aportar los reales. |

## Estructura legacy (tablas / columnas / módulos)

| Excluido | Qué era |
|---|---|
| Columnas `sociedades.pct_pavier`, `pct_armia`, `holding_principal` | Reparto del doble holding. La `sociedades` curada no las lleva. |
| Tabla `proyecto_sociedades` | Reparto proyecto↔sociedad por porcentaje (multi-holding). |
| Tabla `vencimiento_sociedades` | Look-through de vencimientos por % de sociedad. Las vistas se reescriben en modelo **sociedad única**. |
| `patrimonio` y patrimonio personal de socios | Patrimonio personal — jubilado. |
| `activos`, `capex_activos` y campos de fondo/patrimonio | Activos de inversión. |
| `proyecto_analisis_financiero` (TIR/VAN), `proyecto_escenarios`, `renta_horizonte`, `cv_*`, `explotacion_valor_terminal`, `prestamo_valor_garantia`, `alternativo_riesgo_liquidez`, `presupuesto_maestro`, métricas de inversión | **Lente de inversión** — no es la lente de Antifrágil (operativa/margen). |
| `*_knowledge` (conocimiento de la base anterior) y su RLS | Datos/identidad heredados. |
| Tipos `vencimientos.tipo` = `pignorado` / `prestamo` | Categorías de inversión; el CHECK queda `seguro/deuda/contrato/impuesto/compromiso/otro`. |

## Fuentes de datos legacy

| Excluido | Qué era |
|---|---|
| **CF Worker** (`services/workers/cf-api`) | Worker que servía KPIs desde hoja de cálculo. No se conecta al backend nuevo. |
| **Google Sheets** / `finanzas_sociedades` | Origen externo de los KPIs del dashboard heredado. El nuevo "Banco operativo" saldrá de `movimientos_bancarios`. |

## Datos

| Excluido | Motivo |
|---|---|
| Seeds de datos reales heredados (estructura societaria real, balances iniciales, vencimientos reales, reglas de categorización con entidades concretas, deuda de socios) | Son datos reales de la base anterior. **Ningún `INSERT` de datos reales** entra. |
| CIF reales, IBAN reales, facturas reales, movimientos reales, balances reales, pacientes reales | Prohibidos en el seed. El seed solo crea `Antifrágil S.C.` + proyectos propios, sin CIF/IBAN. |

## Otras líneas / fases (no es "legacy", pero NO va en este baseline)

| Excluido | Dónde irá |
|---|---|
| **Clínica** (`clinica_*`) | Su propia línea/migración. |
| **Reservas / Agenda** | Su propia línea. |
| **A1 tesorería/caja** (`cuenta_tesoreria`, ledger de caja, `arqueo_caja`, vistas `tesoreria`/`saldo_tesoreria`) | Implementación A1, posterior. |
| **Workflows avanzados de facturación emitida / VeriFactu** | Línea de facturación emitida. |
| **Recableado de frontend** (quitar Pavier/Armia, CF Worker del módulo `financiero`) | Fase 2 de adaptación. |

## Verificación

`post_bootstrap_checks.sql` §8 comprueba en la base aplicada que **no existe** ninguna de las tablas/columnas legacy listadas arriba.
