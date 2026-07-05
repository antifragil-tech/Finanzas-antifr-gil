/**
 * Guard de entorno para las variables públicas de Supabase en el host.
 *
 * Durante `next build` sin credenciales (CI sin secrets) estas variables no
 * existen; nada debe lanzar error en prerender por su ausencia. Los puntos de
 * uso comprueban `isSupabaseConfigured()` antes de crear un cliente y muestran
 * un estado "pendiente de configuración" en su lugar.
 *
 * Solo cubre el host. No sustituye al cliente compartido del monorepo.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
