'use server';

import {
  ESTADO_AGENDA_A_BD,
  aIsoLocal,
  type CitaAgenda,
  type EstadoCitaAgenda,
  type OrigenCitaAgenda,
} from './reservas';
import { rest } from './fuenteDatos';

/**
 * Server actions de la agenda (Bloque B): escrituras reales sobre
 * clinica_citas / clinica_clientes / cobros vía PostgREST (service_role,
 * solo servidor). Sin entorno devuelven un error legible — el módulo sigue
 * funcionando en demo. La constraint de exclusión anti-solapes de la BD
 * (clinica_citas_sin_solape_profesional) es el guard último: un 409 se
 * traduce a mensaje de solape para recepción.
 */

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const ACTOR = 'reservas-web';

interface Resultado<T> {
  ok: boolean;
  filas: T[];
  error: string;
  status: number;
}

async function escribir<T>(
  metodo: 'POST' | 'PATCH',
  recurso: string,
  cuerpo: Record<string, unknown>,
): Promise<Resultado<T>> {
  if (!URL_BASE || !SERVICE_KEY) {
    return {
      ok: false,
      filas: [],
      status: 0,
      error: 'Sin conexión a Supabase: entorno no configurado (modo demo, solo lectura).',
    };
  }
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${recurso}`, {
      method: metodo,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(cuerpo),
      cache: 'no-store',
    });
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 200);
      return { ok: false, filas: [], status: res.status, error: `HTTP ${res.status}: ${detalle}` };
    }
    return { ok: true, filas: (await res.json()) as T[], status: res.status, error: '' };
  } catch (e) {
    return { ok: false, filas: [], status: 0, error: `Error de red (${recurso}): ${String(e)}` };
  }
}

export interface RespuestaAccion {
  ok: boolean;
  error?: string;
}

export interface RespuestaCrearCita extends RespuestaAccion {
  cita?: CitaAgenda;
}

/** Busca el cliente por nombre exacto; si no existe lo crea (alta rápida de recepción). */
async function resolverCliente(nombre: string): Promise<{ id: string; error?: string }> {
  const limpio = nombre.trim();
  const existentes = await rest<{ id: string }>(
    `clinica_clientes?select=id&nombre=eq.${encodeURIComponent(limpio)}&limit=1`,
  );
  const primero = existentes[0];
  if (primero) return { id: primero.id };
  const alta = await escribir<{ id: string }>('POST', 'clinica_clientes', {
    nombre: limpio,
    procedencia: 'alta_recepcion_agenda',
  });
  const creado = alta.filas[0];
  if (!alta.ok || !creado) return { id: '', error: alta.error || 'No se pudo crear el cliente' };
  return { id: creado.id };
}

async function resolverCanal(origen: OrigenCitaAgenda): Promise<string | null> {
  if (origen === 'directo') return null;
  const canales = await rest<{ id: string; nombre: string }>(`canales?select=id,nombre&limit=100`);
  const buscado = origen.toLowerCase();
  const match = canales.find((c) =>
    c.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(buscado),
  );
  return match?.id ?? null;
}

export async function crearCitaReal(datos: {
  clienteNombre: string;
  profesionalId: string;
  servicioId: string;
  inicioIso: string; // ISO local Europe/Madrid "YYYY-MM-DDTHH:mm:ss"
  finIso: string;
  origen: OrigenCitaAgenda;
  precio: number;
}): Promise<RespuestaCrearCita> {
  if (!datos.clienteNombre.trim()) return { ok: false, error: 'Falta el nombre del cliente' };

  const cliente = await resolverCliente(datos.clienteNombre);
  if (cliente.error) return { ok: false, error: cliente.error };
  const canalId = await resolverCanal(datos.origen);

  const res = await escribir<{ id: string; inicio: string; fin: string }>('POST', 'clinica_citas', {
    cliente_id: cliente.id,
    profesional_id: datos.profesionalId,
    servicio_id: datos.servicioId,
    canal_id: canalId,
    // El ISO local sin zona se interpreta con el timezone de la BD (Europe/Madrid en uso).
    inicio: datos.inicioIso,
    fin: datos.finIso,
    estado: 'reservada',
    precio_snapshot: datos.precio > 0 ? datos.precio : null,
    registrado_por_email: ACTOR,
  });
  const fila = res.filas[0];
  if (!res.ok || !fila) {
    const esSolape = res.status === 409 && res.error.includes('sin_solape');
    return {
      ok: false,
      error: esSolape
        ? 'Solape: el profesional ya tiene una cita en ese horario.'
        : res.error || 'No se pudo crear la cita',
    };
  }

  return {
    ok: true,
    cita: {
      id: fila.id,
      cliente_nombre: datos.clienteNombre.trim(),
      profesional_id: datos.profesionalId,
      sala_id: null,
      servicio_id: datos.servicioId,
      origen: datos.origen,
      inicio: aIsoLocal(fila.inicio),
      fin: aIsoLocal(fila.fin),
      estado_cita: 'pendiente',
      estado_pago: 'pendiente_pago',
      precio_previsto: datos.precio,
      cambios: [],
    },
  };
}

export async function cambiarEstadoCitaReal(
  citaId: string,
  estado: EstadoCitaAgenda,
): Promise<RespuestaAccion> {
  if (estado === 'reprogramada') return { ok: false, error: 'Reprogramar aún no está conectado' };
  const res = await escribir('PATCH', `clinica_citas?id=eq.${encodeURIComponent(citaId)}`, {
    estado: ESTADO_AGENDA_A_BD[estado],
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function registrarCobroCitaReal(
  citaId: string,
  medio: 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia',
): Promise<RespuestaAccion> {
  // Importe y cliente se resuelven desde la CITA en el servidor: la UI solo
  // elige el medio de pago (un toque para recepción, cero importes a mano).
  const citas = await rest<{ id: string; cliente_id: string; precio_snapshot: number | null }>(
    `clinica_citas?select=id,cliente_id,precio_snapshot&id=eq.${encodeURIComponent(citaId)}&limit=1`,
  );
  const cita = citas[0];
  if (!cita) return { ok: false, error: 'Cita no encontrada' };
  const importe = cita.precio_snapshot ?? 0;
  if (!(importe > 0)) {
    return { ok: false, error: 'La cita no tiene precio fijado: ponlo antes de cobrar.' };
  }

  // La cuenta de tesorería se resuelve por TIPO (nunca ids hardcodeados):
  // efectivo → caja; el resto de medios → banco.
  const tipoCuenta = medio === 'efectivo' ? 'caja' : 'banco';
  const cuentas = await rest<{ id: string }>(
    `cuenta_tesoreria?select=id&tipo=eq.${tipoCuenta}&activa=is.true&limit=1`,
  );
  const cuenta = cuentas[0];
  if (!cuenta)
    return { ok: false, error: `No hay cuenta de tesorería activa de tipo ${tipoCuenta}` };

  const res = await escribir('POST', 'cobros', {
    origen_tipo: 'cita',
    origen_id: cita.id,
    cliente_id: cita.cliente_id,
    importe,
    medio_pago: medio,
    cuenta_tesoreria_id: cuenta.id,
    registrado_por_email: ACTOR,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
