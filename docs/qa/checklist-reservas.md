# Checklist QA · Reservas (módulo Clínica/Agenda)

> Rellenar a mano. Versión canónica del módulo: `feat/reservas-agenda-hoy` (Chat 1).
> Probar en standalone (`pnpm --filter @alsari/reservas dev`) o embebido en el demo (`/reservas`).

**Rama probada:** ____________  **Commit:** ____________  **Fecha:** ____________  **Revisor:** ____________

## Agenda · Hoy (vista núcleo de recepción)

- [ ] **Agenda Hoy** carga por defecto
- [ ] **Columnas por profesional** (una columna por cada profesional)
- [ ] **Filas por hora** (rejilla horaria legible)
- [ ] **KPIs** visibles (ej. nº citas, ocupación, huecos) y con valores mock coherentes
- [ ] **Huecos visibles** (slots libres distinguibles de los ocupados)
- [ ] **Cita rápida** — crear una cita mock desde un hueco abre el flujo correcto
- [ ] **Panel lateral** de cita se abre al seleccionar una cita
- [ ] **Badges** de estado correctos: pago, origen (partner), programa/servicio
- [ ] Citas solapadas se reparten en **carriles** sin pisarse (regresion conocida de DayPilot)

## Sub-navegación de Agenda

- [ ] **Semana** — vista semanal sin solapes
- [ ] **Mes** — vista mensual con resumen
- [ ] **Pendientes** — placeholder "próximamente" (o vista real cuando exista)
- [ ] **Cobros** — cuando exista: lista/estado de cobros mock
- [ ] **Vivofácil** — cuando exista: origen partner como filtro/etiqueta mock

## Datos y origen

- [ ] **Sin datos reales**: nombres de pacientes/clientes son claramente mock
- [ ] Partners mock (Vivofácil / Lidomare) aparecen **solo como origen de cita**, no como integración real
- [ ] Sin llamadas a Supabase real (es mock)

## Robustez

- [ ] Embebido en el host monta con `ssr:false` sin error de `window`
- [ ] Altura flexible: el calendario encaja en el shell sin desbordar
- [ ] Sin errores rojos en consola

## Resultado

- [ ] **PASS global**
- Notas de FAIL: ___________________________________________
