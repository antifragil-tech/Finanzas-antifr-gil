// @alsari/supabase-client — punto único de acceso a Supabase para los módulos.
//
// Centraliza la URL del proyecto, la anon key y la resolución del JWT de sesión
// (auth bridge `window.alsariToken` inyectado por el host Next.js — ver
// lessons-learned 2026-05-22). Los módulos NUNCA deben declarar estas
// constantes en local: importar siempre de este paquete.

// La anon key es pública por diseño — la protección real es el RLS en Supabase.
const FALLBACK_URL = 'https://swtyxysvnfcfxziclteq.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3dHl4eXN2bmZjZnh6aWNsdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA4NzMsImV4cCI6MjA5MjAwNjg3M30.aSHBdsXyT-TAdA7rv79qZFbLyMjVd25kX1E0GwBZTQ8';

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
