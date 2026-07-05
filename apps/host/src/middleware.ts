import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/env/supabaseEnv';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Modo preview de desarrollo (decisión del cockpit 2026-07-05): navegar el
  // OS sin login mientras no existan las cuentas definitivas por rol.
  // Triple candado: (1) solo con `next dev` (NODE_ENV=development — en un
  // build de producción esta rama es código muerto), (2) flag explícita en
  // .env.local (gitignorado), (3) el fail-closed de abajo queda intacto para
  // cualquier otro entorno.
  const previewSinLogin =
    process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_OS_PREVIEW === 'true';
  if (previewSinLogin) return supabaseResponse;

  // Fail-closed: sin entorno Supabase no puede existir sesión, así que todo
  // lo que no sea /login se redirige a /login (nunca se sirve la app sin auth)
  const env = getSupabaseEnv();
  if (!env) {
    if (request.nextUrl.pathname.startsWith('/login')) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
