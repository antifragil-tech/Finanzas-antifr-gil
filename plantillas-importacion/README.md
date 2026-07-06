# Plantillas de importación — Antifrágil OS

Cuatro plantillas CSV **demo** para volcar los Excel reales de la clínica al
dominio financiero del OS. Compatibles con los importadores de
`@antifragil/operativa` (verificado por test de round-trip).

## Cómo usarlas

1. **Exporta** cada hoja de tu Excel (o de Salonized) a CSV: en Excel,
   `Guardar como → CSV`. En Salonized, usa su exportación de citas/ventas.
2. **No hace falta renombrar columnas**: el importador mapea por sinónimos y
   tolera tildes ("Método de pago", "Trabajador", "Customer", "Treatment",
   "Total"… se reconocen solos). Una columna que no reconozca **no rompe**:
   se reporta para revisarla.
3. Fechas en `dd/mm/aaaa` e importes con coma (`1.234,56`) se normalizan solos.
4. Guarda los CSV **reales** SIEMPRE en `datos-locales/` (carpeta gitignorada)
   o fuera del repo. `*.real.csv` y `*.real.xlsx` también están gitignorados:
   **ningún dato real puede entrar en git**.
5. Cero datos clínicos: nada de diagnósticos, lesiones ni historia clínica.
   Cliente = nombre administrativo o seudónimo.

## Reglas que aplica el importador

- Un **concepto/categoría desconocido** entra como `pendiente_confirmacion`
  (no rompe, marca el margen como provisional hasta que se confirme).
- Un **gasto con `documento_recibido = no`** queda **bloqueado para pago**
  hasta que llegue su nómina/factura (regla R2).
- **Factura emitida no implica cobro** y **factura recibida no implica pago**:
  los estados se respetan tal cual.

## Las 4 plantillas

| Archivo                  | Para qué                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `ingresos.csv`           | Sesiones, bonos, programas, planes y partners (Vivofácil, AFDH…)         |
| `gastos.csv`             | Todo gasto: profesional variable, nóminas/SS/IRPF, clínica, amortizables |
| `facturas_recibidas.csv` | Facturas de proveedores y de autónomos (soporte de liquidaciones)        |
| `facturas_emitidas.csv`  | Facturas operativas internas (no fiscales)                               |

Valores admitidos donde hay catálogo:

- `tipo_ingreso`: `suelta` · `bono` · `programa` · `plan` · `partner`
- `categoria` (gastos): `coste_por_sesion`, `coste_por_cliente_plan`,
  `formacion_profesional`, `nomina_fija`, `seguridad_social`,
  `irpf_retenciones`, `coste_coordinacion`, `coste_compartido`, `alquiler`,
  `suministros`, `software`, `gestoria`, `material`, `tpv_comisiones`,
  `marketing`, `mantenimiento`, `gasto_extra`, `equipamiento`, `reformas`,
  `herramientas` — cualquier otra cosa → `pendiente_confirmacion`.
- `capa_imputacion`: `directo` · `fijo` · `compartido` · `general` · `amortizable`
- `estado` (recibidas): `pendiente_recibir` · `recibida` · `validada` ·
  `pendiente_pago` · `pagada` · `bloqueada`
- `estado` (emitidas): `borrador` · `emitida_operativa` · `cobrada` ·
  `pendiente_documento_oficial` · `vinculada_factura_externa`
