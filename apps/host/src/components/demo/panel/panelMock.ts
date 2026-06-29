// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE DEMOSTRACIÓN del Panel de Dirección (Demo v0.2 · Fase 2).
//
// TODO es MOCK estático: NO hay Supabase, NO hay fetch, NO hay datos reales.
// Fuente ÚNICA para que las cifras sean coherentes entre bloques (p. ej. los
// "cobros pendientes" salen del mismo número en Tesorería y en Pendientes, y
// "citas sin abonar" = 11 coincide con la agenda mock de /reservas).
// Cualquier parecido con la realidad es casualidad: son cifras ilustrativas.
// ─────────────────────────────────────────────────────────────────────────────

export const PANEL_AVISO = 'Datos de demostración · sin conexión a backend';

export type EstadoProyecto = 'Activo' | 'En preparación' | 'Diferido';

export const panelMock = {
  hoy: {
    citasHoy: 8,
    proxima: { hora: '12:00', servicio: 'Nutrición', profesional: 'Sara' },
    completadas: 3,
    pendientesConfirmar: 2,
  },
  clinica: {
    sesionesMes: 142,
    ocupacionPct: 76,
    servicios: ['Fisioterapia', 'Nutrición', 'Entrenamiento'] as const,
  },
  tesoreria: {
    bancoOperativo: 18450,
    cajaEfectivo: 1240,
    cobrosPendientes: 3260,
    pagosProximos: 2780,
  },
  pendientes: {
    cobrosPendientes: { importe: 3260, clientes: 7 },
    citasSinAbonar: 11,
    vivofacil: 'Pendiente de cierre',
    facturasPorRevisar: 4,
  },
  rentabilidad: {
    margenClinicaPct: 38,
    porServicio: [
      { servicio: 'Fisioterapia', margenPct: 42 },
      { servicio: 'Nutrición', margenPct: 35 },
      { servicio: 'Entrenamiento', margenPct: 28 },
    ],
    costeProfesionalSesion: 21,
    aviso: 'estimación mock, no real',
  },
  proyectos: [
    { nombre: 'Clínica Playamar', estado: 'Activo' as EstadoProyecto },
    { nombre: '9 A.M.', estado: 'En preparación' as EstadoProyecto },
    { nombre: 'Lido Pro', estado: 'Diferido' as EstadoProyecto },
    { nombre: 'Eventos', estado: 'Diferido' as EstadoProyecto },
  ],
};
