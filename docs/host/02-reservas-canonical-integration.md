# Integración Reservas Canónica — PR #5 → Host OS

> **Estado:** Documental (split 5F-READY). Sin código, sin SQL, sin Supabase, sin datos reales ni clínicos.
> **Rama:** `docs/host-reservas-integration-ready`
> **Fecha:** 2026-07-05
> **Relación:** ejecuta la preparación de la pieza **5F** del plan `docs/host/01-demo-split-plan.md` (PR #17). El código de integración NO va aquí: irá en un PR futuro cuando el PR #5 esté mergeado.

---

## 1. Principio

- **Reservas solo viene del PR #5** (`feat/reservas-agenda-hoy`), la versión canónica (decisión D7).
- **Nada de Reservas sale del PR #3**: su copia de `apps/modules/reservas` es anterior y divergente (sin la capa clínica-administrativa: Agenda Hoy, Pendientes, Cobros, Vivofácil…). Se descarta entera.
- El **PR #3 se cierra sin merge** (pieza 5G) cuando 5C/5D/5E/5F estén integradas.
- El placeholder `/reservas` del shell (PR #16) es el punto de montaje reservado.

## 2. Qué aporta el PR #5 (verificado contra la rama, 32 archivos)

| Pieza                        | Archivos                                                                                                  | Qué es                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Agenda Hoy**               | `clinica/agenda/AgendaHoy.tsx`, `lanes.ts`, `AgendaNav.tsx`                                               | Vista operativa de recepción por franjas/lanes               |
| **Pendientes**               | `clinica/Pendientes.tsx`                                                                                  | Cola de validación de asistencia/cobro                       |
| **Cobros**                   | `clinica/Cobros.tsx`                                                                                      | Registro de cobros de sesión (mock)                          |
| **Vivofácil**                | `clinica/Vivofacil.tsx`                                                                                   | Cierre mensual de derivaciones B2B (estados abierto→cobrado) |
| **Clientes administrativos** | `clinica/Clientes.tsx`, `mock/clientes.ts`                                                                | Ficha administrativa, sin datos clínicos                     |
| **Bonos/Programas**          | `clinica/Bonos.tsx`, `mock/bonos.ts`                                                                      | Consumo de bonos por sesión                                  |
| **CitaPanel + store**        | `clinica/CitaPanel.tsx`, `clinica/CitasStore.tsx`, `Subvista.tsx`, `badges.tsx`                           | Panel de cita y provider de estado propio                    |
| **Spike calendario**         | `spike/CalendarioSpike.tsx` (+DayPilot en `index.css`)                                                    | Vista calendario; **revisar peso del bundle (R13)**          |
| **Infra del módulo**         | `package.json` (`@alsari/reservas`), `vite.config`, `tailwind.config`, `index.css`, `main.tsx`, `App.tsx` | Módulo Vite independiente + entrada `pnpm-lock.yaml`         |

## 3. Qué necesita el Host

1. **Punto de montaje `/reservas`**: sustituir el `ModulePlaceholder` del route group `(app)/(os)` por el módulo real.
2. **Navegación**: la entrada ya existe en `osNav.ts` (quitar el punto ámbar de placeholder).
3. **Layout compatible**: el módulo trae su propio nav interno (`AgendaNav`); decidir si vive bajo el topbar del shell o a pantalla completa dentro del área de contenido.
4. **Auth real intacta**: se monta DENTRO del gate existente de `(app)`. Sin demo-mode, sin bypass de middleware.
5. **Contexto global (5C)**: pasar centro/periodo/rol al módulo o, en v1, montarlo sin contexto y conectar después. El rol de recepción del contexto es vista, no permiso.
6. **CSS global**: el `index.css` del módulo (tema DayPilot `.dp-quiet`) debe importarse **una sola vez y de forma explícita** — no repetir el import cross-módulo por ruta relativa que hacía el PR #3 en el root layout; preferible exportarlo desde el paquete y que lo importe el layout del route `(os)/reservas`.
7. **Sin datos clínicos**: el módulo es administrativo (citas, cobros, bonos); cualquier evolución hacia contenido clínico queda fuera del OS v1 (frontera de compliance).

## 4. Dependencias técnicas

- Dependencia `@alsari/reservas: workspace:*` en `apps/host/package.json` + `transpilePackages` en `next.config.ts` + entrada de `pnpm-lock.yaml`: **entran solo en el PR de integración 5F**, justificadas en el body, apuntando a la versión canónica ya mergeada en main.
- **Cero copia de código**: el host importa del workspace, no duplica archivos.
- Compatibilidad de rutas: `/reservas` ya reservada; el módulo interno usa subvistas propias (no rutas Next), sin colisión.
- Validar `type-check`, `lint`, `build` del host con el módulo montado; el módulo es Vite+React 19 — verificar que la transpilación en Next 15 no rompe (mismo patrón que `@alsari/financiero`).
- **DayPilot (R13)**: medir peso del bundle; si es excesivo, cargar la vista calendario con `next/dynamic` (lazy) y dejar Agenda Hoy como vista por defecto.

## 5. Riesgos

| Riesgo                                    | Mitigación                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Copiar la versión vieja del PR #3         | Prohibido por plan (PR #17 §4.1); el PR de 5F parte de main con #5 ya mergeado                                     |
| Conflicto de lockfile                     | La entrada de `@alsari/reservas` se añade en un único PR, tras #5, con lockfile regenerado mínimo                  |
| CSS global cruzado                        | Import único y explícito del tema del módulo; nunca ruta relativa cross-módulo desde el root layout                |
| Doble provider / duplicar estado de citas | `CitasStore` es el único estado de citas; el contexto global 5C no duplica datos de citas, solo centro/periodo/rol |
| Romper auth                               | El montaje no toca `middleware.ts` ni `AppShell`; smoke test de login tras integrar                                |
| Datos clínicos                            | El módulo es administrativo; grep clínico en el PR de integración; frontera compliance vigente                     |
| Bundle grande (DayPilot)                  | `next/dynamic` para el calendario; medir con `next build`                                                          |
| Rutas duplicadas                          | `/reservas` es la única ruta; el placeholder se elimina en el mismo PR                                             |

## 6. Checklist de integración futura (copiable al PR 5F)

- [ ] PR #5 revisado y **mergeado en main**.
- [ ] PR #16 (shell) mergeado; placeholder `/reservas` presente.
- [ ] Splits 5C/5D/5E decididos (mergeados o descartados) para saber sobre qué shell se monta.
- [ ] Auth intacta: sin cambios en `middleware.ts`, sin demo-mode, sin env vars nuevas.
- [ ] Dependencia `@alsari/reservas` + `transpilePackages` + lockfile en este único PR, justificados.
- [ ] Import del CSS del módulo único y explícito.
- [ ] `pnpm --filter @alsari/host type-check && lint && build` (build al menos igual de sano que main).
- [ ] Grep clínico y de secrets limpio.
- [ ] Ruta `/reservas` funcional tras login real; placeholder eliminado.
- [ ] PR en Draft; no Ready; no merge sin autorización.

## 7. Plan del PR futuro

- **Título:** `feat(host): integrar Reservas canónico desde módulo PR #5`
- **Alcance:** conectar la ruta `/reservas` al módulo del workspace; importar el módulo canónico (sin copiar código); eliminar el placeholder; validar build/lint/type-check; **no tocar la lógica interna de Reservas** salvo adaptación mínima de montaje (export de entrada y CSS).
- **Fuera de alcance:** cambios funcionales en agenda/cobros/bonos, conexión a Supabase real, permisos reales por rol.
- **Prerequisitos duros:** #14 mergeado (auto-merge fuera), #5 mergeado, decisión sobre 5C/5D/5E.

---

_Documento 5F-READY. No modifica código. El PR de integración se abrirá solo con autorización del cockpit cuando los prerequisitos se cumplan._
