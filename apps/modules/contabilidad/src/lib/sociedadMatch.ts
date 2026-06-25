// Lógica PURA de matching NIF/CIF → sociedad (espejo de la Edge Function
// procesar-factura). Normaliza ambos lados (mayúsculas + solo A-Z0-9) y exige
// match ÚNICO. PR D.1: evita el fallback silencioso a la primera sociedad.

export function normalizeNif(nif: string | null | undefined): string {
  return (nif ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export type SociedadLite = { id_ref: string; cif: string | null };

// Devuelve la sociedad cuyo cif normalizado coincide con el nif normalizado SOLO
// si hay match ÚNICO. 0 o >1 coincidencias → null (sociedad pendiente de validar).
export function matchSociedadPorNif(
  nif: string | null | undefined,
  sociedades: SociedadLite[],
): SociedadLite | null {
  const n = normalizeNif(nif);
  if (!n) return null;
  const matches = sociedades.filter(s => {
    const c = normalizeNif(s.cif);
    return c !== '' && c === n;
  });
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
