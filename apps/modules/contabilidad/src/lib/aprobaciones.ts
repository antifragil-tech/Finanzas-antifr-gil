// Lógica pura de transiciones de factura (espejo de la RPC
// `avanzar_estado_factura_con_auditoria`). La fuente de verdad es la RPC en BD;
// esto sirve para la UI optimista y para tests deterministas.
import type { EstadoFacturaRecibida, AccionAprobacion } from '@alsari/types';

// Acciones humanas que disparan una transición desde la UI.
export type AccionHumana = 'valida' | 'aprueba' | 'marca_pagada' | 'rechaza';

const ESTADOS_TERMINALES: EstadoFacturaRecibida[] = ['pagada', 'rechazada'];

// Devuelve el estado nuevo de una transición o lanza si la transición es inválida.
// Misma lógica y validaciones que la RPC.
export function calcularEstadoNuevo(
  estadoActual: EstadoFacturaRecibida,
  accion: AccionHumana,
  total: number,
  umbral: number,
): EstadoFacturaRecibida {
  switch (accion) {
    case 'valida':
      if (estadoActual !== 'borrador_ocr')
        throw new Error(`No se puede validar desde el estado ${estadoActual}`);
      return total > umbral ? 'revision_javi' : 'pendiente_pago';
    case 'aprueba':
      if (estadoActual !== 'revision_javi')
        throw new Error(`No se puede aprobar desde el estado ${estadoActual}`);
      return 'pendiente_pago';
    case 'marca_pagada':
      if (estadoActual !== 'pendiente_pago')
        throw new Error(`No se puede marcar pagada desde el estado ${estadoActual}`);
      return 'pagada';
    case 'rechaza':
      if (ESTADOS_TERMINALES.includes(estadoActual))
        throw new Error(`No se puede rechazar desde el estado ${estadoActual}`);
      return 'rechazada';
  }
}

// La acción humana a registrar al pulsar "Aprobar/Validar" depende del estado:
// desde borrador_ocr es "valida" (Guille); desde revision_javi es "aprueba" (Javi).
export function accionDeAvance(estadoActual: EstadoFacturaRecibida): Extract<AccionAprobacion, 'valida' | 'aprueba'> {
  return estadoActual === 'revision_javi' ? 'aprueba' : 'valida';
}
