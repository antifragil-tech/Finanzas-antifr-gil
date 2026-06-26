// Modo demo local de Antifrágil OS.
// SOLO para enseñar el OS en local sin backend ni pantallas legacy de Alsari.
// La variable es NO pública (sin NEXT_PUBLIC_): solo se evalúa en servidor
// (middleware y server components). Doble guarda: jamás se activa en producción.
export function isDemoMode(): boolean {
  return (
    process.env['ANTIFRAGIL_DEMO_MODE'] === 'true' &&
    process.env['NODE_ENV'] !== 'production'
  );
}
