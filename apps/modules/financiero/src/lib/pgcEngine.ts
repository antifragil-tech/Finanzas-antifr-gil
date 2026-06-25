// PGC classification engine — incorporates gestoría corrections (2026-05-18)
//
// Rules ordered: most specific ranges first.
// Sign: 'deudor' = net > 0 (debe > haber), 'acreedor' = net < 0, 'both' = any
//
// Each account maps to exactly one internal category.
// Computed KPIs are derived from category totals.

type InternalCat =
  | 'caja'
  | 'activo_corriente'
  | 'activo_no_corriente'
  | 'deuda_bancaria_cp'
  | 'deuda_bancaria_lp'
  | 'deuda_partes_vinc_cp'
  | 'deuda_partes_vinc_lp'
  | 'pasivo_corriente'
  | 'pasivo_no_corriente'
  | 'patrimonio_neto'
  | 'resultado_ejercicio'   // grupos 6 y 7 — PyG aún no cerrada al 129
  | 'sin_clasificar'

interface Rule {
  from: number
  to: number
  sign: 'deudor' | 'acreedor' | 'both'
  cat: InternalCat
}

// Most specific rules first to avoid early-match on broader ranges.
// gestoría corrections annotated with [G].
const RULES: Rule[] = [
  // --- CAJA (tesorería) ---
  { from: 5700, to: 5799, sign: 'both',     cat: 'caja' },

  // --- DEUDA BANCARIA CP ---
  { from: 5200, to: 5209, sign: 'acreedor', cat: 'deuda_bancaria_cp' }, // préstamos CP entidades crédito
  { from: 5270, to: 5279, sign: 'acreedor', cat: 'deuda_bancaria_cp' }, // intereses CP

  // --- DEUDA PARTES VINCULADAS CP [G: grupo 51, 550-552] ---
  { from: 5100, to: 5199, sign: 'acreedor', cat: 'deuda_partes_vinc_cp' },
  { from: 5500, to: 5529, sign: 'acreedor', cat: 'deuda_partes_vinc_cp' },

  // --- DEUDA PARTES VINCULADAS LP [G: grupo 16, 171x] ---
  { from: 1600, to: 1699, sign: 'acreedor', cat: 'deuda_partes_vinc_lp' },
  { from: 1710, to: 1719, sign: 'acreedor', cat: 'deuda_partes_vinc_lp' },

  // --- DEUDA BANCARIA LP (entidades crédito + leasing) ---
  { from: 1700, to: 1709, sign: 'acreedor', cat: 'deuda_bancaria_lp' },
  { from: 1740, to: 1749, sign: 'acreedor', cat: 'deuda_bancaria_lp' },

  // --- PATRIMONIO NETO (capital, reservas, resultado, ajustes PN) ---
  { from: 1000, to: 1399, sign: 'both',     cat: 'patrimonio_neto' },

  // --- PASIVO NO CORRIENTE (remaining LP liabilities) ---
  { from: 1400, to: 1499, sign: 'acreedor', cat: 'pasivo_no_corriente' }, // provisiones LP
  { from: 1500, to: 1599, sign: 'acreedor', cat: 'pasivo_no_corriente' },
  { from: 1720, to: 1739, sign: 'acreedor', cat: 'pasivo_no_corriente' },
  { from: 1750, to: 1799, sign: 'acreedor', cat: 'pasivo_no_corriente' },
  { from: 1800, to: 1899, sign: 'acreedor', cat: 'pasivo_no_corriente' }, // fianzas recibidas LP
  { from: 4790, to: 4799, sign: 'acreedor', cat: 'pasivo_no_corriente' }, // 479 [G]

  // --- ACTIVO NO CORRIENTE (2xxx; contra-accounts 28xx/29xx have net < 0 → subtract naturally) ---
  { from: 2000, to: 2999, sign: 'both',     cat: 'activo_no_corriente' },

  // --- 460x: anticipos a trabajadores — always activo corriente [G] ---
  { from: 4600, to: 4609, sign: 'both',     cat: 'activo_corriente' },

  // --- 550-552 deudor: activo corriente [G] ---
  { from: 5500, to: 5529, sign: 'deudor',   cat: 'activo_corriente' },

  // --- ACTIVO CORRIENTE ---
  { from: 3000, to: 3999, sign: 'deudor',   cat: 'activo_corriente' }, // existencias
  { from: 4000, to: 4699, sign: 'deudor',   cat: 'activo_corriente' }, // clientes/deudores
  { from: 4700, to: 4789, sign: 'deudor',   cat: 'activo_corriente' }, // HP deudora
  { from: 4800, to: 4819, sign: 'deudor',   cat: 'activo_corriente' }, // periodificaciones activo
  { from: 4900, to: 4999, sign: 'deudor',   cat: 'activo_corriente' }, // deterioro [G: grupo 49]
  { from: 5300, to: 5499, sign: 'deudor',   cat: 'activo_corriente' }, // inv. fin. CP
  { from: 5800, to: 5899, sign: 'deudor',   cat: 'activo_corriente' }, // grupo 58 deudor [G]
  { from: 5900, to: 5999, sign: 'deudor',   cat: 'activo_corriente' }, // grupo 59 [G]

  // --- 553-559: cuentas corrientes con grupo, socios, entidades vinculadas ---
  { from: 5530, to: 5599, sign: 'deudor',   cat: 'activo_corriente' },  // saldo deudor = activo (ej. UTE, asociadas)
  { from: 5530, to: 5599, sign: 'acreedor', cat: 'pasivo_corriente' },  // saldo acreedor = pasivo (ej. banco con saldo negativo pequeño)

  // --- 560-569: fianzas y depósitos CP ---
  { from: 5600, to: 5699, sign: 'deudor',   cat: 'activo_corriente' },  // depósito/fianza constituida (activo)

  // --- PASIVO CORRIENTE ---
  { from: 4000, to: 4699, sign: 'acreedor', cat: 'pasivo_corriente' }, // proveedores/acreedores
  { from: 4700, to: 4789, sign: 'acreedor', cat: 'pasivo_corriente' }, // HP acreedora + SS
  { from: 5000, to: 5099, sign: 'acreedor', cat: 'pasivo_corriente' }, // grupo 50 [G]
  { from: 5210, to: 5269, sign: 'acreedor', cat: 'pasivo_corriente' }, // otras deudas CP
  { from: 5280, to: 5299, sign: 'acreedor', cat: 'pasivo_corriente' }, // leasing CP
  { from: 5600, to: 5699, sign: 'acreedor', cat: 'pasivo_corriente' }, // fianzas recibidas CP
  { from: 5800, to: 5899, sign: 'acreedor', cat: 'pasivo_corriente' }, // grupo 58 acreedor [G]

  // --- RESULTADO DEL EJERCICIO (PyG no cerrada) ---
  // contribution = -net para ambos grupos (igual que PN):
  //   grupo 6 deudor (gastos): net > 0 → -net < 0 → reduce PN
  //   grupo 7 acreedor (ingresos): net < 0 → -net > 0 → aumenta PN
  { from: 6000, to: 6999, sign: 'both', cat: 'resultado_ejercicio' },
  { from: 7000, to: 7999, sign: 'both', cat: 'resultado_ejercicio' },
]

export interface AccountBalance {
  subcuenta: string
  subcuentaNombre: string
  net: number // debe - haber
  cat: InternalCat
}

export interface BalanceKPIs {
  caja: number
  activoCorriente: number      // includes caja
  activoNoCorriente: number
  activoTotal: number
  pasivoCorriente: number      // includes deudaBancariaCp + deudaPartesVincCp
  pasivoNoCorriente: number    // includes deudaBancariaLp + deudaPartesVincLp
  pasivoTotal: number
  fondoManiobra: number
  patrimonioNetoBase: number   // capital + reservas (10xx-13xx)
  resultadoEjercicio: number   // resultado YTD de grupos 6 y 7
  patrimonioNeto: number       // base + resultado
  deudaBancariaCp: number
  deudaBancariaLp: number
  deudaBancaria: number
  deudaPartesVinculadas: number
  deudaFinancieraNeta: number
  balanceDiff: number          // should be ~0: activoTotal - (pasivoTotal + patrimonioNeto)
  sinClasificar: AccountBalance[]
}

export function computeBalance(
  entries: Array<{ subcuenta: string; subcuentaNombre: string; debe: number; haber: number }>
): BalanceKPIs {
  // Step 1: aggregate entries by subcuenta
  const map = new Map<string, { nombre: string; debe: number; haber: number }>()
  for (const e of entries) {
    const existing = map.get(e.subcuenta)
    if (existing) {
      existing.debe += e.debe
      existing.haber += e.haber
    } else {
      map.set(e.subcuenta, { nombre: e.subcuentaNombre, debe: e.debe, haber: e.haber })
    }
  }

  // Step 2: classify each account and accumulate category totals
  // Assets: use net (positive = deudor = asset; negative = contra-account = reduces asset)
  // Liabilities/PN: use -net (acreedor accounts have net < 0; -net > 0 = positive liability)
  const totals: Record<InternalCat, number> = {
    caja: 0,
    activo_corriente: 0,
    activo_no_corriente: 0,
    deuda_bancaria_cp: 0,
    deuda_bancaria_lp: 0,
    deuda_partes_vinc_cp: 0,
    deuda_partes_vinc_lp: 0,
    pasivo_corriente: 0,
    pasivo_no_corriente: 0,
    patrimonio_neto: 0,
    resultado_ejercicio: 0,
    sin_clasificar: 0,
  }

  const sinClasificar: AccountBalance[] = []

  for (const [subcuenta, { nombre, debe, haber }] of map.entries()) {
    const net = debe - haber
    if (Math.abs(net) < 0.005) continue // skip near-zero

    const cat = classify(subcuenta, net)
    const ab: AccountBalance = { subcuenta, subcuentaNombre: nombre, net, cat }

    if (cat === 'sin_clasificar') {
      sinClasificar.push(ab)
      continue
    }

    const isAsset = cat === 'caja' || cat === 'activo_corriente' || cat === 'activo_no_corriente'
    totals[cat] += isAsset ? net : -net  // liability/PN/resultado: -net (acreedor=positivo)
  }

  const caja = totals.caja
  const activoCorriente = caja + totals.activo_corriente
  const activoNoCorriente = totals.activo_no_corriente
  const activoTotal = activoCorriente + activoNoCorriente

  const deudaBancariaCp = totals.deuda_bancaria_cp
  const deudaBancariaLp = totals.deuda_bancaria_lp
  const deudaBancaria = deudaBancariaCp + deudaBancariaLp
  const deudaPartesVinculadas = totals.deuda_partes_vinc_cp + totals.deuda_partes_vinc_lp

  const pasivoCorriente = totals.pasivo_corriente + deudaBancariaCp + totals.deuda_partes_vinc_cp
  const pasivoNoCorriente = totals.pasivo_no_corriente + deudaBancariaLp + totals.deuda_partes_vinc_lp
  const pasivoTotal = pasivoCorriente + pasivoNoCorriente

  const patrimonioNetoBase = totals.patrimonio_neto
  const resultadoEjercicio = totals.resultado_ejercicio
  const patrimonioNeto = patrimonioNetoBase + resultadoEjercicio
  const fondoManiobra = activoCorriente - pasivoCorriente
  const deudaFinancieraNeta = deudaBancaria + deudaPartesVinculadas - caja
  const balanceDiff = activoTotal - (pasivoTotal + patrimonioNeto)

  return {
    caja,
    activoCorriente,
    activoNoCorriente,
    activoTotal,
    pasivoCorriente,
    pasivoNoCorriente,
    pasivoTotal,
    fondoManiobra,
    patrimonioNetoBase,
    resultadoEjercicio,
    patrimonioNeto,
    deudaBancariaCp,
    deudaBancariaLp,
    deudaBancaria,
    deudaPartesVinculadas,
    deudaFinancieraNeta,
    balanceDiff,
    sinClasificar,
  }
}

function classify(subcuenta: string, net: number): InternalCat {
  const code = parseInt(subcuenta.substring(0, 4).padEnd(4, '0'))
  const isDeudor = net > 0
  const isAcreedor = net < 0

  for (const r of RULES) {
    if (code < r.from || code > r.to) continue
    if (r.sign === 'both') return r.cat
    if (r.sign === 'deudor' && isDeudor) return r.cat
    if (r.sign === 'acreedor' && isAcreedor) return r.cat
  }

  return 'sin_clasificar'
}
