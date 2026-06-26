// ─────────────────────────────────────────────────────────────────────────────
// Tipos canónicos del dominio Clínica/Reservas (contrato compartido).
//
// Reflejan 1:1 las columnas de las tablas `clinica_*` (migración Fase 1). Los
// consumen la agenda interna, la visión cliente y la capa API. Campos en
// snake_case (como devuelve PostgREST); fechas/horas como string ISO; nullables
// como `| null`. Enums = uniones de string-literal alineadas con los CHECK del SQL.
//
// Fase 2 (cita, pagos, bonos, auditoría) añadirá sus tipos aquí.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums (alineados con los CHECK de la migración) ──────────────────────────
export type RolClinica =
  | 'admin'
  | 'profesional'
  | 'recepcion'
  | 'viewer'
  | 'cliente';

export type ModoAgenda = 'huecos_abiertos' | 'bajo_demanda';

export type RecursoRequerido = 'obligatorio' | 'opcional' | 'ninguno';

// Fisioterapia incluye lo deportivo (no se separa en categorías).
export type CategoriaServicio =
  | 'fisioterapia'
  | 'nutricion'
  | 'entrenamiento_personal';

export type TipoProfesional =
  | 'fisioterapeuta'
  | 'entrenador'
  | 'nutricionista'
  | 'otro';

export type TipoProducto =
  | 'sesion_suelta'
  | 'bono_sesiones'
  | 'programa'
  | 'seguimiento'
  | 'valoracion'
  | 'mensualidad'
  | 'tarifa_especial'
  | 'sesion_extra';

// Tarifa especial del producto.
export type CondicionEspecial = 'estandar' | 'founder' | 'vip' | 'ug' | 'especial';

// Condición del cliente (aplica tarifa por defecto).
export type CondicionCliente =
  | 'estandar'
  | 'founder'
  | 'vip'
  | 'ug'
  | 'especial_manual';

export type TipoExcepcionDisponibilidad = 'abre' | 'cierra';

export type TipoBloqueo =
  | 'vacaciones'
  | 'reunion'
  | 'comida'
  | 'formacion'
  | 'baja'
  | 'otro';

// ── Filas (reflejan las tablas clinica_*) ────────────────────────────────────

export type UsuarioClinica = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  rol: RolClinica;
  profesional_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Ubicacion = {
  id: string;
  nombre: string;
  direccion: string | null;
  sociedad_id_ref: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Recurso = {
  id: string;
  ubicacion_id: string | null;
  nombre: string;
  capacidad: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Profesional = {
  id: string;
  nombre: string;
  titulo: string | null;
  tipo: TipoProfesional;
  email: string | null;
  telefono: string | null;
  color: string | null;
  auth_user_id: string | null;
  modo_agenda: ModoAgenda;
  prioridad: number;
  sociedad_id_ref: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Servicio = {
  id: string;
  nombre: string;
  categoria: CategoriaServicio;
  duracion_minutos: number;
  buffer_antes_minutos: number;
  buffer_despues_minutos: number;
  recurso_requerido: RecursoRequerido;
  modo_agenda: ModoAgenda | null;
  color: string | null;
  sociedad_id_ref: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfesionalServicio = {
  profesional_id: string;
  servicio_id: string;
};

export type Producto = {
  id: string;
  nombre: string;
  servicio_id: string | null;
  tipo_producto: TipoProducto;
  duracion_estandar_minutos: number | null;
  precio: number;
  sesiones_incluidas: number | null;
  condicion_especial: CondicionEspecial;
  exento_iva: boolean;
  tipo_operacion: string | null;
  // Gobierno del catálogo público
  visible_en_reserva_publica: boolean;
  requiere_asignacion_manual: boolean;
  solo_uso_interno: boolean;
  requiere_confirmacion: boolean;
  activo: boolean;
  notas_internas: string | null;
  sociedad_id_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  dni_nie: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  procedencia: string | null;
  condicion: CondicionCliente;
  consentimiento_rgpd: boolean;
  consentimiento_fecha: string | null;
  notas_admin: string | null;
  auth_user_id: string | null;
  sociedad_id_ref: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type HorarioProfesional = {
  id: string;
  profesional_id: string;
  dia_semana: number; // 0=domingo … 6=sábado
  hora_inicio: string; // "HH:mm:ss"
  hora_fin: string;
  recurrencia: string;
  valido_desde: string | null;
  valido_hasta: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type DisponibilidadExcepcional = {
  id: string;
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: TipoExcepcionDisponibilidad;
  motivo: string | null;
  created_at: string;
  updated_at: string;
};

export type BloqueoAgenda = {
  id: string;
  profesional_id: string | null; // null = bloqueo global
  inicio: string;
  fin: string;
  tipo: TipoBloqueo;
  motivo: string | null;
  created_at: string;
  updated_at: string;
};
