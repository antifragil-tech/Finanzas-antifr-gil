---
name: financial-formulas
description: Fórmulas financieras estándar y específicas de Alsari Capital. Cárgalo cuando trabajes en cálculos de EBITDA, TIR, VAN, ROI, márgenes o cualquier métrica financiera. Asegura precisión numérica y formato consistente.
---

# Fórmulas Financieras — Alsari Capital

> Definiciones, fórmulas y reglas de cálculo financiero canónicas para el OS.
> Todas las implementaciones de cálculo financiero deben respetar estas definiciones.

---

## 🎯 Reglas generales de cálculo

1. **Precisión numérica:** usa `number` para cálculos rápidos en UI, pero para
   acumulados, importes monetarios y cualquier valor que pase a BD usa **strings
   decimales** o la librería `decimal.js` para evitar errores de coma flotante.
   - Ejemplo del problema: `0.1 + 0.2 !== 0.3` en JavaScript.
2. **Redondeo:** redondeo bancario (round half to even) para evitar sesgos. Función
   centralizada en `packages/utils/math/round.ts`.
3. **Moneda:** todos los cálculos asumen **euros (EUR)** salvo que se especifique.
   Para multi-moneda, conversión a EUR al guardar.
4. **Periodicidad:** las fórmulas asumen periodos **anuales** salvo notación
   explícita. Para mensuales/trimestrales, ajustar la fórmula y documentarlo.

---

## 📐 Fórmulas de rentabilidad

### EBITDA
> *Earnings Before Interest, Taxes, Depreciation and Amortization.*

```
EBITDA = Ingresos − Costes operativos (excluyendo D&A)

equivalentemente:

EBITDA = Beneficio neto + Impuestos + Intereses + Depreciación + Amortización
```

**Uso en Alsari:** métrica principal de rentabilidad operativa por entidad y consolidada.

### EBIT
```
EBIT = EBITDA − Depreciación − Amortización

equivalentemente:

EBIT = Ingresos − Costes operativos (todos)
```

### Margen EBITDA
```
Margen EBITDA (%) = (EBITDA / Ingresos) × 100
```

### Margen EBIT
```
Margen EBIT (%) = (EBIT / Ingresos) × 100
```

---

## 📈 Fórmulas de inversión

### ROI (Return on Investment)
```
ROI (%) = ((Ganancia − Inversión inicial) / Inversión inicial) × 100
```

**Limitación:** ROI no considera el factor tiempo. Para inversiones a varios años,
TIR es preferible.

### ROCE (Return on Capital Employed)
```
ROCE (%) = (EBIT / Capital empleado) × 100

donde:
Capital empleado = Activos totales − Pasivos corrientes
                 = Patrimonio neto + Deuda a largo plazo
```

### TIR (Tasa Interna de Retorno) / IRR
> *Tasa de descuento que hace VAN = 0.*

```
0 = Σ [CFt / (1+TIR)^t]   para t = 0, 1, ..., n

donde:
CF0 = inversión inicial (negativa)
CFt = flujo de caja en el periodo t
```

**Implementación:** Newton-Raphson o método de bisección. No tiene fórmula cerrada.

```typescript
function calculateIRR(cashFlows: number[], guess = 0.1): number {
  const MAX_ITER = 100;
  const TOLERANCE = 1e-7;
  let rate = guess;

  for (let i = 0; i < MAX_ITER; i++) {
    const npv = cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
    const dnpv = cashFlows.reduce((acc, cf, t) => acc - t * cf / Math.pow(1 + rate, t + 1), 0);

    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < TOLERANCE) return newRate;
    rate = newRate;
  }

  throw new Error('IRR did not converge');
}
```

**Casos límite:**
- Si todos los flujos son del mismo signo → no hay TIR. Lanzar error.
- Múltiples cambios de signo → puede haber múltiples TIRs (rara vez relevante; usar
  TIR modificada o documentar).

### VAN / NPV (Valor Actual Neto)
```
VAN = Σ [CFt / (1+r)^t] − Inversión inicial

donde:
r = tasa de descuento (coste de capital)
```

**Regla:** VAN > 0 → inversión crea valor. VAN < 0 → destruye valor.

### TIR Modificada (MIRR)
> *Versión robusta de la TIR que asume reinversión a una tasa específica.*

```
MIRR = (Valor terminal de flujos positivos / Valor presente de flujos negativos)^(1/n) − 1
```

---

## 🏦 Fórmulas de tesorería y deuda

### DSCR (Debt Service Coverage Ratio)
```
DSCR = EBITDA / Servicio de la deuda

donde:
Servicio de la deuda = Intereses + Amortización de capital del periodo
```

**Regla:** bancos suelen exigir DSCR ≥ 1.25. <1 = insuficiente.

### Loan-to-Value (LTV)
> *Usado en financiación inmobiliaria.*

```
LTV (%) = (Importe del préstamo / Valor del activo) × 100
```

**Regla:** financiación inmobiliaria estándar suele estar 60-75% LTV.

### Cash Conversion Cycle (CCC)
```
CCC = DSO + DIO − DPO

donde:
DSO = Days Sales Outstanding (días de cobro a clientes)
DIO = Days Inventory Outstanding (días de inventario)
DPO = Days Payable Outstanding (días de pago a proveedores)
```

---

## 🏠 Fórmulas específicas de real estate

### Yield bruto
```
Yield bruto (%) = (Renta anual / Precio de compra) × 100
```

### Yield neto
```
Yield neto (%) = ((Renta anual − Gastos anuales) / Precio de compra) × 100
```

### Cap Rate
```
Cap Rate = NOI (Net Operating Income) / Valor del activo

donde:
NOI = Ingresos − Gastos operativos (excluye financiación e impuestos)
```

---

## 🧮 Reglas de implementación en código

### Centralización
Todos estos cálculos viven en `packages/utils/finance/`:

```
packages/utils/finance/
├── ebitda.ts
├── irr.ts
├── npv.ts
├── roi.ts
├── roce.ts
├── dscr.ts
├── ltv.ts
├── yield.ts
└── index.ts
```

Cada uno con su test correspondiente en `packages/utils/finance/*.test.ts`.

### Firma estándar

Todas las funciones de cálculo deben:
1. Validar inputs con Zod (lanzar `FinancialCalculationError` si inválidos).
2. Devolver el tipo nativo (`number` para ratios, `string` decimal para importes
   grandes).
3. Estar puramente sin side effects (sin `console.log`, sin red, sin BD).
4. Tener JSDoc con la fórmula matemática.

```typescript
/**
 * Calcula el ROI sobre una inversión.
 *
 * Fórmula: ROI (%) = ((Ganancia − Inversión) / Inversión) × 100
 *
 * @param ganancia - Beneficio total obtenido.
 * @param inversion - Inversión inicial (debe ser > 0).
 * @returns ROI como porcentaje (decimal, ej. 0.15 = 15%).
 * @throws FinancialCalculationError si inversion <= 0.
 */
export function calculateROI(ganancia: number, inversion: number): number {
  if (inversion <= 0) {
    throw new FinancialCalculationError('La inversión debe ser mayor que cero');
  }
  return (ganancia - inversion) / inversion;
}
```

### Tests obligatorios

Por cada función, cubrir:
- Camino feliz con valor de referencia conocido.
- Inputs en los bordes (0, negativos, muy grandes).
- Inputs inválidos (lanza error correcto).
- Casos típicos del negocio Alsari (ej. TIR de un proyecto inmobiliario tipo).

---

## ⚠️ Errores frecuentes a evitar

1. ❌ Usar `parseFloat` para parsear inputs sin validar formato (`"abc"` → `NaN`).
2. ❌ Calcular TIR con un solo flujo (no tiene sentido).
3. ❌ Confundir EBITDA con beneficio neto (son cosas diferentes).
4. ❌ Aplicar margen EBITDA con cifras absolutas sin contexto (un EBITDA del 50% en
   inmobiliaria es excepcional; en servicios es bueno).
5. ❌ Confundir ROI con TIR. ROI no considera tiempo; TIR sí.
6. ❌ Tasa de descuento como porcentaje (`5%`) en vez de decimal (`0.05`).

---

## 📚 Referencias

- Damodaran Online (NYU): https://pages.stern.nyu.edu/~adamodar/
- Investopedia para definiciones rápidas (verificar siempre con fuente académica).
- Para casos complejos: consultar con Asesoría MM / Ramón.
