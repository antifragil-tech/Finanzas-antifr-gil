# Checklist QA · Demo

> Rellenar a mano al revisar el demo. Marca `[x]` PASS, `[ ]` pendiente, y anota FAIL con nota.
> Requisito: demo levantado en local con `ANTIFRAGIL_DEMO_MODE=true` y `NODE_ENV≠production` (ver `runbook-smoke-tests.md`).

**Rama probada:** ****\_\_\_\_**** **Commit:** ****\_\_\_\_**** **Fecha:** ****\_\_\_\_**** **Revisor:** ****\_\_\_\_****

## Rutas (cargan y responden 200)

- [ ] `/` — home del OS carga sin error
- [ ] `/reservas` — módulo reservas monta (sin error de `window`/DayPilot)
- [ ] `/financiero` — pantalla mock carga
- [ ] `/rentabilidad` — pantalla mock carga
- [ ] `/contabilidad` — pantalla mock carga
- [ ] `/presupuestos` — pantalla mock carga
- [ ] `/configuracion` — pantalla mock carga
- [ ] `/facturas` — pantalla mock carga

## Señales de "modo demo" correcto

- [ ] **Banner/etiqueta de demo visible** (texto tipo "DATOS DE DEMOSTRACIÓN")
- [ ] **DemoShell visible**: sidebar y topbar del shell demo montan correctamente
- [ ] **Contexto global** (si existe): el selector/estado global del demo funciona
- [ ] **Sin datos reales**: ningún cliente, IBAN, CIF ni importe real reconocible
- [ ] **Sin datos clínicos**: ningún diagnóstico, lesión, tratamiento ni referencia médica en pantalla
- [ ] **Sin "Alsari" visible** en ninguna pantalla (logo, títulos, footer)
- [ ] **Sin Pavier / Armia / Rialsa** visibles
- [ ] **Sin Supabase visible**: no hay errores de red a `*.supabase.co`, ni mención del proyecto; el demo no llama a backend
- [ ] No hay pantallas legacy del holding (cashflow real, balances reales)

## Navegación e interacción

- [ ] **Enlaces principales** del sidebar/topbar navegan a la ruta correcta
- [ ] La ruta activa se resalta en el sidebar
- [ ] El Panel de Dirección (home) muestra los widgets mock sin romperse
- [ ] No hay enlaces rotos (404) en la navegación principal

## Robustez visual

- [ ] **Responsive básico**: a ~1280px y a ~768px no se rompe el layout (sidebar colapsa o se adapta)
- [ ] Sin errores en consola del navegador (warnings tolerables; errores rojos no)
- [ ] Sin "flash" de pantalla de login (el gate demo salta la auth)

## Seguridad del modo demo

- [ ] **Sin la flag** `ANTIFRAGIL_DEMO_MODE`, el host vuelve al comportamiento normal (redirige a `/login`)
- [ ] La flag se ignora si `NODE_ENV=production` (no se puede activar demo en prod)

## Resultado

- [ ] **PASS global** (todos los aplicables marcados)
- Notas de FAIL: ********************\_\_\_********************
