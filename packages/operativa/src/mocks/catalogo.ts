/**
 * Catálogo mock de productos y estructura (centros/canales) para el vertical
 * MVP. Precios del ejemplo canónico de los docs (bono 225 €/5, suelta 55 €).
 * Los acuerdos de centros partner quedan pendiente_confirmar (B2-P3).
 */

import type { Canal, Centro, ProductoCatalogo } from '../types';

export const PRODUCTOS: ProductoCatalogo[] = [
  {
    id: 'prod-suelta-fisio',
    nombre: 'Sesión fisioterapia',
    tipo: 'sesion_suelta',
    unidades: 1,
    precioCatalogo: 55,
    servicio: 'fisioterapia',
  },
  {
    id: 'prod-bono-fisio-5',
    nombre: 'Bono 5 sesiones fisioterapia',
    tipo: 'bono_sesiones',
    unidades: 5,
    precioCatalogo: 225,
    servicio: 'fisioterapia',
    caducidadMeses: 6,
  },
  {
    id: 'prod-plan-nutricion',
    nombre: 'Plan nutrición mensual',
    tipo: 'programa_mensual',
    unidades: 1,
    precioCatalogo: 120,
    servicio: 'nutricion',
  },
];

export const CENTROS: Centro[] = [
  { id: 'centro-playamar', nombre: 'Clínica Playamar', proyecto: 'clinica', tipoAcuerdo: 'propio' },
  {
    id: 'centro-lidomare',
    nombre: 'Lidomare',
    proyecto: 'clinica',
    tipoAcuerdo: 'pendiente_confirmar',
  },
  { id: 'centro-oasis', nombre: 'Oasis', proyecto: 'clinica', tipoAcuerdo: 'pendiente_confirmar' },
];

export const CANALES: Canal[] = [
  { id: 'canal-organico', nombre: 'Orgánico / walk-in', tipo: 'walk_in', activo: true },
  { id: 'canal-recomendacion', nombre: 'Recomendación', tipo: 'referido', activo: true },
  { id: 'canal-vivofacil', nombre: 'Vivofácil (partner B2B)', tipo: 'partner_b2b', activo: true },
  { id: 'canal-lidomare', nombre: 'Derivación Lidomare', tipo: 'partner_b2b', activo: true },
  { id: 'canal-afdh', nombre: 'AFDH (plataforma)', tipo: 'partner_b2b', activo: true },
  {
    id: 'canal-9am',
    nombre: '9AM (proyecto eventos — contabilidad aparte)',
    tipo: 'referido',
    activo: true,
  },
];
