# Panel de Dirección — Demo v0.2

Pantalla de demostración del OS de Antifrágil. **Todo lo que se ve aquí es mock.**

## Qué es esto
El Panel de Dirección que se muestra en `/` **cuando `ANTIFRAGIL_DEMO_MODE=true`** (modo demo local, nunca producción). Sirve para enseñar el OS sin backend ni datos reales. Fuera de demo mode, `/` muestra la landing legacy intacta.

## Qué datos son mock
- **Todas las cifras** salen de [`panelMock.ts`](./panelMock.ts), una **fuente única** parametrizada por **proyecto** y **periodo**. No hay números sueltos duplicados.
- Selector de **proyecto** (Todos / Clínica Antifrágil Playamar / 9 A.M. / Lido Pro / Eventos): cambia el conjunto de datos mock de forma coherente.
- Selector de **rol** (Dirección / Responsable Clínica / Recepción / Profesional): **simula** qué bloques ve cada rol. Es una simulación visual: **NO aplica permisos reales** (aviso visible en la UI).
- **Filtros de periodo** (Hoy / Esta semana / Este mes): escalan las cifras de periodo (sesiones, cobros, pagos, pendientes). Los **saldos** (banco, caja) NO se escalan, porque son foto puntual.
- Etiquetas `mock` · `estimado` · `demo` · `sin backend` · `no real` marcan que ningún número es real (especialmente en Tesorería y Rentabilidad).

## Qué NO conecta
- **Sin Supabase, sin `createClient`, sin `fetch`, sin auth real.** Componente cliente con `useState`; nada de red.
- No toca `/reservas` ni `@alsari/reservas`: los enlaces "Agenda" / "Abrir Agenda" son solo navegación a la agenda existente.
- No toca finanzas reales, SQL, migraciones ni `packages/supabase-client`.

## Archivos
- `panelMock.ts` — datos mock + opciones (proyectos, roles, filtros) + `getPanel(proyecto, periodo)`.
- `PanelKit.tsx` — primitivos presentacionales (`Bloque`, `Kpi`, `Fila`, `Tag`, `eur`).
- `PanelDireccion.tsx` — panel interactivo (client component): selectores, filtros y bloques por rol.

## Qué queda para fases futuras
- Conectar a datos reales (cuando exista el backend nuevo de Antifrágil) sustituyendo `getPanel()` por una fuente real, **sin cambiar la UI**.
- Permisos reales por rol (hoy es solo visual).
- Sincronizar el contexto (proyecto/rol) con la topbar del shell si se decide subir el estado.
- Bloques con detalle/drill-down y más métricas operativas.
