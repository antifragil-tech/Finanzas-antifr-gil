// @alsari/supabase-client — punto único de acceso a Supabase para los módulos.
//
// Centraliza la URL del proyecto, la anon key y la resolución del JWT de sesión
// (auth bridge `window.alsariToken` inyectado por el host Next.js — ver
// lessons-learned 2026-05-22). Los módulos NUNCA deben declarar estas
// constantes en local: importar siempre de este paquete.

// DESCONECTADO del proyecto legacy de Alsari (decisión del cockpit 2026-07-05:
// sus datos ya no deben aparecer en Antifrágil OS). Sin variables de entorno
// configuradas, el cliente apunta a un destino inexistente: toda petición
// falla de forma controlada y los módulos muestran sus estados vacíos/error.
// La conexión real del OS se configurará vía env cuando exista el Supabase
// nuevo de Antifrágil (Fase 7).
const FALLBACK_URL = 'https://desconectado.invalid';
const FALLBACK_ANON_KEY = 'desconectado';

// Next.js no inyecta `import.meta.env` al transpilar módulos Vite: leer siempre
// con optional chaining y sin asumir que el objeto existe.
function viteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

function nodeEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

export const SUPABASE_URL: string =
  viteEnv('VITE_SUPABASE_URL') ?? nodeEnv('NEXT_PUBLIC_SUPABASE_URL') ?? FALLBACK_URL;

export const SUPABASE_ANON_KEY: string =
  viteEnv('VITE_SUPABASE_ANON_KEY') ?? nodeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? FALLBACK_ANON_KEY;

/**
 * Devuelve el JWT con el que firmar las peticiones a Supabase, por prioridad:
 * 1. `window.alsariToken` — inyectado por AppShell (host) en cada onAuthStateChange.
 *    Es la única fuente fiable cuando el host usa @supabase/ssr (sesión en cookies).
 * 2. `localStorage` `sb-<ref>-auth-token` — fallback para el SDK clásico de Supabase.
 * 3. Anon key — peticiones sin sesión; el RLS decide qué se puede leer/escribir.
 */
export function getJwt(): string {
  const winToken =
    typeof window !== 'undefined' && (window as Window & { alsariToken?: string }).alsariToken;
  if (winToken) return winToken;
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0] ?? '';
    const stored = localStorage.getItem(`sb-${ref}-auth-token`);
    if (stored) {
      const parsed = JSON.parse(stored) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
  } catch {
    /* ignore */
  }
  return SUPABASE_ANON_KEY;
}

/** URL completa de la REST API de PostgREST para un path relativo. */
export function sbUrl(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

/** Headers estándar para PostgREST: apikey + Bearer con el JWT de sesión. */
export function sbHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${getJwt()}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}
