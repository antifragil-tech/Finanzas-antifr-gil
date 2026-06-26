import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // ⚠️ DEMO LOCAL ÚNICAMENTE — NUNCA EN PRODUCCIÓN.
  // Si ANTIFRAGIL_DEMO_MODE=true (y NO estamos en producción), saltamos el gate
  // de autenticación para poder enseñar el OS + Reservas en local sin backend.
  //   · NO elimina el flujo real de auth (sigue intacto justo debajo).
  //   · NO toca Supabase: retorna ANTES de crear el cliente.
  //   · Doble protección: se ignora si NODE_ENV === 'production'.
  //   · La variable es NO pública (sin NEXT_PUBLIC_): solo visible en servidor.
  if (
    process.env['ANTIFRAGIL_DEMO_MODE'] === 'true' &&
    process.env['NODE_ENV'] !== 'production'
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
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
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/financiero';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
