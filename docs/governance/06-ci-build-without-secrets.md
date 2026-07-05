# 06 — Build reproducible sin secrets reales

> Decisión técnica: `pnpm build` debe pasar en CI y en local sin credenciales
> de Supabase. Complementa a `05-branch-protection-main.md` (PR #18).

---

## 1. Problema detectado

`next build` en `apps/host` fallaba durante el prerender estático:

```
Error occurred prerendering page "/login"
Error: @supabase/ssr: Your project's URL and API key are required
```

Causa raíz: `LoginForm` y `AppShell` (componentes `'use client'`) creaban el
cliente de Supabase **en el cuerpo del render**. El prerender de `next build`
ejecuta ese render en servidor, y sin `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` la librería lanza error. Afectaba a `/login`
y, vía el layout `(app)` que monta `AppShell`, a todas las rutas del host
(`/`, `/contabilidad`, `/facturas`, `/financiero`, `/presupuestos`).

## 2. Por qué el CI no debe depender de secrets para compilar

- Un build que exige credenciales acopla la validación de código al entorno
  real: cualquier fork, worktree o runner sin secrets queda rojo.
- Las variables `NEXT_PUBLIC_*` no son secretas en sentido estricto (van al
  bundle), pero tratarlas como requisito de compilación invita a copiarlas a
  sitios donde no deben estar (workflows, logs, repos).
- El gate de CI debe medir la salud del código, no la disponibilidad de un
  proyecto de Supabase.

## 3. Patrón aplicado

1. **Guard de entorno** en `apps/host/src/lib/env/supabaseEnv.ts`:
   `getSupabaseEnv()` devuelve las env públicas o `null`, sin lanzar nunca
   durante build. `isSupabaseConfigured()` expone el booleano.
2. **Creación perezosa del cliente**: `LoginForm` crea el cliente dentro del
   submit y `AppShell` dentro de su `useEffect` (los efectos no corren en
   prerender). Nada instancia Supabase durante el render estático.
3. **Estado operativo, no error técnico**: si faltan las env, el login
   muestra "Módulo pendiente de configuración de entorno. No hay datos
   cargados."
4. **Middleware fail-closed**: sin entorno configurado no puede existir
   sesión, así que toda ruta distinta de `/login` redirige a `/login`. La
   ausencia de configuración **nunca** abre la aplicación sin auth.

## 4. Rutas afectadas y verificadas

`/login`, `/`, `/contabilidad`, `/facturas` (redirect), `/financiero`,
`/presupuestos` — las 9 páginas del host prerenderizan en verde sin env.

## 5. Pendiente para entorno real

- Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
  el entorno de despliegue (Vercel u equivalente). Con ellas presentes, el
  comportamiento es idéntico al anterior.
- Nota: las `NEXT_PUBLIC_*` se inyectan en el bundle **en build**. Un
  artefacto compilado sin ellas no se conecta a Supabase en runtime; el build
  de despliegue debe hacerse con las variables presentes. El build de CI solo
  valida código.

## 6. Qué NO se ha hecho

- No se han metido secrets, anon keys ni URLs reales.
- No se ha tocado Supabase real, SQL, `.env` ni `packages/supabase-client`.
- No hay bypass de auth ni demo-mode: sin configuración, la app está cerrada.
- No se ha desactivado el paso de build ni ningún check del CI.

---

**Última actualización:** 2026-07-05 (rama `ci/host-build-without-secrets`).
