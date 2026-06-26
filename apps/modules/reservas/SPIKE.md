# Spike técnico — Calendario (DayPilot Lite) · Módulo Clínica/Reservas

> Objetivo: validar **DayPilot Lite** como base del calendario antes de construir el
> módulo. Aislado: NO toca Supabase, NI el host, NI hace rebrand. Datos 100% mock.
>
> Cómo verlo: `pnpm --filter @alsari/reservas dev` → http://localhost:5180/
> Estado: ✅ Build OK (`tsc --noEmit` estricto + `vite build`), React 19, sin parches.

---

## Qué demuestra el spike (v2)

- **Vista principal "Todas las sesiones"** con **Mes / Semana / Día** (semana por
  defecto) + navegación ‹ Hoy ›.
- **"Por profesional" y "Por sala" con pestaña** (eliges uno; no todos amontonados) y
  **solo vista Día** (sin semana/mes, que ahí no aportan).
- **Eventos con info operativa**: hora · cliente · servicio · profesional · estado de
  pago (con punto de color), no solo "servicio + profesional".
- **Filtro por servicio** (Fisio / Fisio dep. / Entreno / Nutrición) + botón **"Nueva
  cita"** + **alerta de citas sin abonar** (completadas/no-show con pago pendiente).
- **Drag & drop = reprogramar** y **resize = ajustar duración**: actualizan la cita y
  **dejan registro en el histórico**. Nada se borra.
- **Clic en cita → nuestro `Modal` de `@alsari/ui`** (NO el modal nativo de DayPilot).
- **Acciones sin borrado físico**: confirmar / completar / no-show / cancelar = cambios
  de estado. La cita cancelada permanece visible (tachada y atenuada).
- **Estados sutiles, semántica del OS** (amber pendiente · blue confirmada · emerald
  completada · rose no-show/cancelada · violet reprogramada) vía `onBeforeEventRender`.
- **Datos realistas** 8:00–21:00: 3 fisio + 1 nutri + 1 entreno, 2 consultas, pagos
  pagados/pendientes/incluidos en bono y no-show.
- **Tema oscuro premium**: cabeceras y rejilla en zinc (sin blanco), bordes muy suaves,
  glass + acento crema. Celda compacta (vista Día menos alargada).

---

## Veredicto

DayPilot Lite **cumple las 3 condiciones** pedidas:

1. ✅ Vistas por profesional y por sala, con D&D y reprogramación fluida.
2. ✅ Re-vestible a Quiet Luxury: no obliga a sus modales ni a sus estilos. Usamos
   nuestro `Modal` y controlamos el render de eventos.
3. ✅ No compromete la arquitectura: React 19, integrable en el módulo, eventos
   gobernados por nuestra lógica. La validación real de solapes irá en Supabase/RPC.

**Licencia:** Apache 2.0 — uso comercial permitido, **sin atribución obligatoria**.
Las columnas por recurso son gratis (en FullCalendar y Schedule-X son de pago).

---

## Limitaciones detectadas (a tener en cuenta al integrar)

1. **Semana + columnas por profesional a la vez NO existe en Lite.** "Resources"
   (columnas por recurso) es de **un día**. Para la clínica el patrón natural es
   *día · por profesional*; la semana es vista complementaria (por profesional único o
   todas las citas juntas). Una rejilla semana×profesional simultánea requeriría
   DayPilot Pro o una composición propia.
2. **El wrapper React tipa un subconjunto de props.** Ej.: `showNonBusiness` no está
   tipado (se usa `heightSpec="BusinessHours"` para limitar a 8–21). Para props
   avanzadas del API JS habrá que revisar tipos o castear puntualmente.
3. **Theming por CSS sobre clases del tema por defecto** (`.calendar_default_*`), no por
   design tokens. Funciona y queda integrado, pero hay que mantener ese CSS si DayPilot
   cambia nombres de clase entre versiones. Scopeado bajo `.dp-quiet`.
4. **Ids `string | number`.** DayPilot usa `EventId`/`ResourceId` = `string | number`;
   normalizamos a `string` con `String()` al leerlos.
5. **Bundle:** ~619 kB (170 kB gzip) por DayPilot + React. Aceptable; al integrar en el
   host se puede *code-split* el módulo.
6. **El spike NO valida solapes.** Permite mover libremente. La prevención real
   (profesional/sala, horario, bloqueos) vivirá en Supabase (constraints `EXCLUDE` +
   RPC), no en la UI.

---

## Archivos del spike

```
apps/modules/reservas/
├── package.json (@alsari/reservas)  vite/tsconfig/tailwind/postcss
├── SPIKE.md (este archivo)
└── src/
    ├── main.tsx  App.tsx  index.ts  index.css (tema DayPilot)
    └── spike/
        ├── mockData.ts        # profesionales, salas, servicios, citas mock
        ├── estados.ts         # estados → color/tono Quiet Luxury
        ├── CitaModal.tsx      # modal propio (@alsari/ui)
        └── CalendarioSpike.tsx# calendario + handlers (D&D, click, crear)
```

> Si se aprueba, este spike evoluciona a la estructura real del módulo
> (`src/api`, `src/domain`, `src/components/...`) descrita en
> `docs/reservas/01-propuesta-clinica-v2.md`.
