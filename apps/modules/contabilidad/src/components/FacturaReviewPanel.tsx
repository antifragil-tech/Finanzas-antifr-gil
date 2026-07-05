import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ExternalLink,
  AlertCircle,
  Info,
  Building2,
  UserCheck,
  Link2,
  Unlink,
  Search,
  Plus,
  Paperclip,
  AlertTriangle,
  Check,
  Cloud,
} from 'lucide-react';
import type {
  FacturaRecibida,
  ConfiguracionContabilidad,
  RolAprobacion,
  OcrConfianza,
  LineaAsiento,
  TipoOperacion,
  MetodoPago,
  TipoPago,
  EstadoPago,
  FacturaPago,
  FacturaIncidencia,
  ProveedorRegla,
} from '@alsari/types';
import { ESTADO_FACTURA_RECIBIDA_LABEL } from '@alsari/types';
import {
  METODO_PAGO_LABEL,
  TIPO_PAGO_LABEL,
  ESTADO_PAGO_LABEL,
  TIPO_INCIDENCIA_LABEL,
  DRIVE_ESTADO_LABEL,
  ESTADO_OPERATIVO_DOMICILIADA_LABEL,
} from '@alsari/types';
import {
  avanzarEstadoFacturaConAuditoria,
  getAprobaciones,
  updateFacturaRecibida,
  registrarCorreccionOcr,
  insertAsientoBorrador,
  searchPartidasPresupuesto,
  crearPagoDesdeFactura,
  desvincularFacturaDePresupuesto,
  marcarPagoComoPagado,
  getFacturaPdfUrl,
  resolveFacturaPdfSource,
  getFacturaPagos,
  getFacturaIncidencias,
  uploadJustificante,
  registrarPagoFactura,
  getJustificanteUrl,
  resolverIncidenciaFactura,
  archivarFacturaEnDrive,
  getFacturaById,
  cambiarSociedadFactura,
  getReglasByContacto,
  insertProveedorRegla,
  type NuevaProveedorRegla,
  type PartidaParaVincular,
} from '../lib/contabilidadApi';
import { accionDeAvance } from '../lib/aprobaciones';
import { normalizeNif } from '../lib/sociedadMatch';
import {
  seleccionarRegla,
  analizarRegla,
  reglaDesdeFactura,
  estadoOperativoFactura,
  type Sugerencia,
} from '../lib/proveedorReglas';
import { calcularTotalAPagar, calcularEstadoPago, type ResumenPago } from '../lib/facturaPagos';
import type { FacturaAprobacion } from '@alsari/types';
import { ACCION_APROBACION_LABEL } from '@alsari/types';

// ── PGC catalog ───────────────────────────────────────────────────────────────

const CUENTAS_GASTO: { codigo: string; descripcion: string }[] = [
  // ══ GRUPO 1 — Financiación básica ═══════════════════════════════════════
  { codigo: '100', descripcion: 'Capital social' },
  { codigo: '101', descripcion: 'Fondo social' },
  { codigo: '102', descripcion: 'Capital' },
  { codigo: '108', descripcion: 'Acciones o participaciones propias en situaciones especiales' },
  { codigo: '109', descripcion: 'Acciones o participaciones propias para reducción de capital' },
  { codigo: '112', descripcion: 'Reserva legal' },
  { codigo: '113', descripcion: 'Reservas voluntarias' },
  { codigo: '114', descripcion: 'Reservas especiales' },
  { codigo: '118', descripcion: 'Aportaciones de socios o propietarios' },
  { codigo: '120', descripcion: 'Remanente' },
  { codigo: '121', descripcion: 'Resultados negativos de ejercicios anteriores' },
  { codigo: '129', descripcion: 'Resultado del ejercicio' },
  { codigo: '130', descripcion: 'Subvenciones oficiales de capital' },
  { codigo: '131', descripcion: 'Donaciones y legados de capital' },
  { codigo: '132', descripcion: 'Otras subvenciones, donaciones y legados' },
  {
    codigo: '133',
    descripcion: 'Ajustes por valoración en activos financieros disponibles para la venta',
  },
  { codigo: '134', descripcion: 'Operaciones de cobertura' },
  { codigo: '136', descripcion: 'Diferencias de conversión' },
  { codigo: '140', descripcion: 'Provisión por retribuciones a largo plazo al personal' },
  { codigo: '141', descripcion: 'Provisión para impuestos' },
  { codigo: '142', descripcion: 'Provisión para otras responsabilidades' },
  {
    codigo: '143',
    descripcion: 'Provisión por desmantelamiento, retiro o rehabilitación del inmovilizado',
  },
  { codigo: '145', descripcion: 'Provisión para actuaciones medioambientales' },
  { codigo: '146', descripcion: 'Provisión para reestructuraciones' },
  { codigo: '160', descripcion: 'Deudas a largo plazo con entidades de crédito' },
  { codigo: '161', descripcion: 'Deudas a largo plazo' },
  { codigo: '162', descripcion: 'Deudas a largo plazo transformables en subvenciones' },
  { codigo: '163', descripcion: 'Otras deudas a largo plazo con partes vinculadas' },
  { codigo: '165', descripcion: 'Otros pasivos financieros a largo plazo a valor razonable' },
  { codigo: '166', descripcion: 'Fianzas recibidas a largo plazo' },
  { codigo: '167', descripcion: 'Depósitos recibidos a largo plazo' },
  { codigo: '168', descripcion: 'Deudas a largo plazo por arrendamiento financiero' },
  { codigo: '169', descripcion: 'Otros pasivos financieros a largo plazo' },
  { codigo: '170', descripcion: 'Deudas a largo plazo con entidades de crédito del grupo' },
  { codigo: '171', descripcion: 'Deudas a largo plazo con empresas del grupo' },
  { codigo: '172', descripcion: 'Deudas a largo plazo con empresas asociadas' },
  { codigo: '173', descripcion: 'Proveedores de inmovilizado a largo plazo, empresas del grupo' },
  { codigo: '174', descripcion: 'Proveedores de inmovilizado a largo plazo, empresas asociadas' },
  { codigo: '175', descripcion: 'Efectos a pagar a largo plazo, empresas del grupo' },
  { codigo: '180', descripcion: 'Fianzas recibidas a largo plazo' },
  { codigo: '181', descripcion: 'Anticipos recibidos por ventas a largo plazo' },
  // ══ GRUPO 2 — Activo no corriente ════════════════════════════════════════
  { codigo: '200', descripcion: 'Investigación' },
  { codigo: '201', descripcion: 'Desarrollo' },
  { codigo: '202', descripcion: 'Concesiones administrativas' },
  { codigo: '203', descripcion: 'Propiedad industrial' },
  { codigo: '204', descripcion: 'Fondo de comercio' },
  { codigo: '205', descripcion: 'Derechos de traspaso' },
  { codigo: '206', descripcion: 'Aplicaciones informáticas' },
  { codigo: '209', descripcion: 'Anticipos para inmovilizaciones intangibles' },
  { codigo: '210', descripcion: 'Terrenos y bienes naturales' },
  { codigo: '211', descripcion: 'Construcciones' },
  { codigo: '212', descripcion: 'Instalaciones técnicas' },
  { codigo: '213', descripcion: 'Maquinaria' },
  { codigo: '214', descripcion: 'Utillaje' },
  { codigo: '215', descripcion: 'Otras instalaciones' },
  { codigo: '216', descripcion: 'Mobiliario' },
  { codigo: '217', descripcion: 'Equipos para procesos de información' },
  { codigo: '218', descripcion: 'Elementos de transporte' },
  { codigo: '219', descripcion: 'Otro inmovilizado material' },
  { codigo: '220', descripcion: 'Inversiones en terrenos y bienes naturales' },
  { codigo: '221', descripcion: 'Inversiones en construcciones' },
  { codigo: '230', descripcion: 'Adaptación de terrenos y bienes naturales' },
  { codigo: '231', descripcion: 'Construcciones en curso' },
  { codigo: '232', descripcion: 'Instalaciones técnicas en montaje' },
  { codigo: '233', descripcion: 'Maquinaria en montaje' },
  { codigo: '237', descripcion: 'Equipos para procesos de información en montaje' },
  { codigo: '239', descripcion: 'Anticipos para inmovilizaciones materiales' },
  { codigo: '240', descripcion: 'Participaciones a largo plazo en empresas del grupo' },
  {
    codigo: '241',
    descripcion: 'Valores representativos de deuda a largo plazo, empresas del grupo',
  },
  { codigo: '242', descripcion: 'Créditos a largo plazo a empresas del grupo' },
  { codigo: '243', descripcion: 'Participaciones a largo plazo en empresas asociadas' },
  {
    codigo: '244',
    descripcion: 'Valores representativos de deuda a largo plazo, empresas asociadas',
  },
  { codigo: '245', descripcion: 'Créditos a largo plazo a empresas asociadas' },
  {
    codigo: '250',
    descripcion: 'Inversiones financieras a largo plazo en instrumentos de patrimonio',
  },
  { codigo: '251', descripcion: 'Valores representativos de deuda a largo plazo' },
  { codigo: '252', descripcion: 'Créditos a largo plazo' },
  { codigo: '253', descripcion: 'Créditos a largo plazo por enajenación de inmovilizado' },
  { codigo: '254', descripcion: 'Créditos a largo plazo al personal' },
  { codigo: '255', descripcion: 'Activos por derivados financieros a largo plazo' },
  { codigo: '258', descripcion: 'Imposiciones a largo plazo' },
  { codigo: '259', descripcion: 'Desembolsos pendientes sobre participaciones a largo plazo' },
  { codigo: '260', descripcion: 'Fianzas constituidas a largo plazo' },
  { codigo: '261', descripcion: 'Depósitos constituidos a largo plazo' },
  { codigo: '265', descripcion: 'Derechos de reembolso derivados de contratos de seguro' },
  { codigo: '270', descripcion: 'Gastos de formalización de deudas' },
  { codigo: '271', descripcion: 'Gastos por emisión de obligaciones y otros valores' },
  { codigo: '272', descripcion: 'Gastos de formalización de deudas, empresas del grupo' },
  { codigo: '280', descripcion: 'Amortización acumulada del inmovilizado intangible' },
  { codigo: '281', descripcion: 'Amortización acumulada del inmovilizado material' },
  { codigo: '282', descripcion: 'Amortización acumulada de inversiones inmobiliarias' },
  { codigo: '290', descripcion: 'Deterioro de valor del inmovilizado intangible' },
  { codigo: '291', descripcion: 'Deterioro de valor del inmovilizado material' },
  { codigo: '292', descripcion: 'Deterioro de valor de inversiones inmobiliarias' },
  {
    codigo: '293',
    descripcion: 'Deterioro de valor de participaciones a largo plazo, empresas del grupo',
  },
  {
    codigo: '294',
    descripcion: 'Deterioro de valor de valores de deuda a largo plazo, empresas del grupo',
  },
  {
    codigo: '295',
    descripcion: 'Deterioro de valor de créditos a largo plazo, empresas del grupo',
  },
  {
    codigo: '296',
    descripcion: 'Deterioro de valor de participaciones a largo plazo, empresas asociadas',
  },
  {
    codigo: '297',
    descripcion: 'Deterioro de valor de valores de deuda a largo plazo, empresas asociadas',
  },
  { codigo: '298', descripcion: 'Deterioro de valor de participaciones a largo plazo' },
  {
    codigo: '299',
    descripcion: 'Deterioro de valor de valores representativos de deuda a largo plazo',
  },
  // ══ GRUPO 3 — Existencias ════════════════════════════════════════════════
  { codigo: '300', descripcion: 'Mercaderías A' },
  { codigo: '301', descripcion: 'Mercaderías B' },
  { codigo: '310', descripcion: 'Materias primas A' },
  { codigo: '311', descripcion: 'Materias primas B' },
  { codigo: '320', descripcion: 'Elementos y conjuntos incorporables' },
  { codigo: '321', descripcion: 'Combustibles' },
  { codigo: '322', descripcion: 'Repuestos' },
  { codigo: '325', descripcion: 'Materiales diversos' },
  { codigo: '326', descripcion: 'Embalajes' },
  { codigo: '327', descripcion: 'Envases' },
  { codigo: '328', descripcion: 'Material de oficina' },
  { codigo: '330', descripcion: 'Productos en curso A' },
  { codigo: '331', descripcion: 'Productos en curso B' },
  { codigo: '340', descripcion: 'Productos semiterminados A' },
  { codigo: '341', descripcion: 'Productos semiterminados B' },
  { codigo: '350', descripcion: 'Productos terminados A' },
  { codigo: '351', descripcion: 'Productos terminados B' },
  { codigo: '360', descripcion: 'Subproductos A' },
  { codigo: '365', descripcion: 'Residuos A' },
  { codigo: '368', descripcion: 'Materiales recuperados A' },
  { codigo: '390', descripcion: 'Deterioro de valor de las mercaderías' },
  { codigo: '391', descripcion: 'Deterioro de valor de materias primas' },
  { codigo: '392', descripcion: 'Deterioro de valor de otros aprovisionamientos' },
  { codigo: '393', descripcion: 'Deterioro de valor de productos en curso' },
  { codigo: '394', descripcion: 'Deterioro de valor de productos semiterminados' },
  { codigo: '395', descripcion: 'Deterioro de valor de productos terminados' },
  {
    codigo: '396',
    descripcion: 'Deterioro de valor de subproductos, residuos y materiales recuperados',
  },
  // ══ GRUPO 4 — Acreedores y deudores por operaciones comerciales ══════════
  { codigo: '400', descripcion: 'Proveedores' },
  { codigo: '401', descripcion: 'Proveedores, efectos comerciales a pagar' },
  { codigo: '403', descripcion: 'Proveedores, empresas del grupo' },
  { codigo: '404', descripcion: 'Proveedores, empresas asociadas' },
  { codigo: '405', descripcion: 'Proveedores, otras partes vinculadas' },
  { codigo: '406', descripcion: 'Envases y embalajes a devolver a proveedores' },
  { codigo: '407', descripcion: 'Anticipos a proveedores' },
  { codigo: '408', descripcion: 'Proveedores, facturas pendientes de recibir o de formalizar' },
  {
    codigo: '409',
    descripcion: 'Proveedores, facturas pendientes de recibir o de formalizar (grupo)',
  },
  { codigo: '410', descripcion: 'Acreedores por prestaciones de servicios' },
  { codigo: '411', descripcion: 'Acreedores, efectos comerciales a pagar' },
  { codigo: '419', descripcion: 'Acreedores por operaciones en común' },
  { codigo: '430', descripcion: 'Clientes' },
  { codigo: '431', descripcion: 'Clientes, efectos comerciales a cobrar' },
  { codigo: '432', descripcion: 'Clientes, operaciones de factoring' },
  { codigo: '433', descripcion: 'Clientes, empresas del grupo' },
  { codigo: '434', descripcion: 'Clientes, empresas asociadas' },
  { codigo: '435', descripcion: 'Clientes, otras partes vinculadas' },
  { codigo: '436', descripcion: 'Clientes de dudoso cobro' },
  { codigo: '437', descripcion: 'Envases y embalajes a devolver por clientes' },
  { codigo: '438', descripcion: 'Anticipos de clientes' },
  { codigo: '440', descripcion: 'Deudores' },
  { codigo: '441', descripcion: 'Deudores, efectos comerciales a cobrar' },
  { codigo: '446', descripcion: 'Deudores de dudoso cobro' },
  { codigo: '449', descripcion: 'Deudores por operaciones en común' },
  { codigo: '460', descripcion: 'Anticipos de remuneraciones' },
  { codigo: '465', descripcion: 'Remuneraciones pendientes de pago' },
  { codigo: '470', descripcion: 'H.P. deudora por diversos conceptos' },
  { codigo: '471', descripcion: 'Organismos de la Seguridad Social, deudores' },
  { codigo: '472', descripcion: 'H.P. IVA soportado' },
  { codigo: '473', descripcion: 'H.P. retenciones y pagos a cuenta' },
  { codigo: '474', descripcion: 'Activos por impuesto diferido' },
  { codigo: '475', descripcion: 'H.P. acreedora por conceptos fiscales' },
  { codigo: '4750', descripcion: 'H.P. acreedora por IVA' },
  { codigo: '4751', descripcion: 'H.P. retenciones practicadas' },
  { codigo: '4752', descripcion: 'H.P. acreedora por impuesto sobre sociedades' },
  { codigo: '476', descripcion: 'Organismos de la Seguridad Social, acreedores' },
  { codigo: '477', descripcion: 'H.P. IVA repercutido' },
  { codigo: '478', descripcion: 'Pasivos por diferencias temporarias imponibles' },
  { codigo: '479', descripcion: 'Pasivos por impuesto diferido' },
  { codigo: '480', descripcion: 'Gastos anticipados' },
  { codigo: '481', descripcion: 'Ingresos anticipados' },
  { codigo: '485', descripcion: 'Gastos anticipados a largo plazo' },
  { codigo: '486', descripcion: 'Ingresos anticipados a largo plazo' },
  { codigo: '490', descripcion: 'Deterioro de valor de créditos por operaciones comerciales' },
  {
    codigo: '493',
    descripcion: 'Deterioro de valor de créditos por operaciones comerciales, empresas del grupo',
  },
  {
    codigo: '494',
    descripcion: 'Deterioro de valor de créditos por operaciones comerciales, empresas asociadas',
  },
  {
    codigo: '495',
    descripcion: 'Deterioro de valor de créditos por operaciones con partes vinculadas',
  },
  {
    codigo: '496',
    descripcion: 'Deterioro de valor de créditos por operaciones comerciales (otros)',
  },
  { codigo: '499', descripcion: 'Provisiones por operaciones comerciales' },
  // ══ GRUPO 5 — Cuentas financieras ═══════════════════════════════════════
  { codigo: '500', descripcion: 'Obligaciones y bonos a corto plazo' },
  { codigo: '501', descripcion: 'Obligaciones y bonos convertibles a corto plazo' },
  { codigo: '505', descripcion: 'Deudas representadas en otros valores negociables a corto plazo' },
  { codigo: '506', descripcion: 'Intereses a corto plazo de empréstitos y otras emisiones' },
  { codigo: '507', descripcion: 'Dividendos de obligaciones y otros valores' },
  { codigo: '509', descripcion: 'Valores negociables amortizados' },
  { codigo: '510', descripcion: 'Deudas a corto plazo con entidades de crédito vinculadas' },
  { codigo: '511', descripcion: 'Deudas a corto plazo con otras partes vinculadas' },
  { codigo: '512', descripcion: 'Deudas a corto plazo con entidades de crédito' },
  { codigo: '513', descripcion: 'Proveedores de inmovilizado a corto plazo, empresas del grupo' },
  { codigo: '514', descripcion: 'Proveedores de inmovilizado a corto plazo, empresas asociadas' },
  { codigo: '515', descripcion: 'Deudas a corto plazo por préstamos recibidos y otros conceptos' },
  { codigo: '516', descripcion: 'Fianzas recibidas a corto plazo' },
  { codigo: '517', descripcion: 'Depósitos recibidos a corto plazo' },
  { codigo: '518', descripcion: 'Deudas por intereses' },
  { codigo: '519', descripcion: 'Otras deudas a corto plazo' },
  { codigo: '520', descripcion: 'Deudas a corto plazo con entidades de crédito' },
  { codigo: '521', descripcion: 'Deudas a corto plazo' },
  { codigo: '522', descripcion: 'Deudas a corto plazo transformables en subvenciones' },
  { codigo: '523', descripcion: 'Proveedores de inmovilizado a corto plazo' },
  { codigo: '524', descripcion: 'Acreedores por arrendamiento financiero a corto plazo' },
  { codigo: '525', descripcion: 'Efectos a pagar a corto plazo' },
  { codigo: '527', descripcion: 'Dividendos activos a pagar' },
  { codigo: '528', descripcion: 'Intereses a corto plazo de deudas con partes vinculadas' },
  { codigo: '529', descripcion: 'Provisiones a corto plazo' },
  { codigo: '530', descripcion: 'Participaciones a corto plazo en empresas del grupo' },
  {
    codigo: '531',
    descripcion: 'Valores representativos de deuda a corto plazo, empresas del grupo',
  },
  { codigo: '532', descripcion: 'Créditos a corto plazo, empresas del grupo' },
  { codigo: '533', descripcion: 'Participaciones a corto plazo en empresas asociadas' },
  {
    codigo: '534',
    descripcion: 'Valores representativos de deuda a corto plazo, empresas asociadas',
  },
  { codigo: '535', descripcion: 'Créditos a corto plazo, empresas asociadas' },
  {
    codigo: '540',
    descripcion: 'Inversiones financieras a corto plazo en instrumentos de patrimonio',
  },
  { codigo: '541', descripcion: 'Valores representativos de deuda a corto plazo' },
  { codigo: '542', descripcion: 'Créditos a corto plazo' },
  { codigo: '543', descripcion: 'Créditos a corto plazo por enajenación de inmovilizado' },
  { codigo: '544', descripcion: 'Créditos a corto plazo al personal' },
  { codigo: '545', descripcion: 'Dividendos a cobrar' },
  { codigo: '546', descripcion: 'Intereses a corto plazo de valores representativos de deuda' },
  { codigo: '547', descripcion: 'Intereses a corto plazo de créditos' },
  { codigo: '548', descripcion: 'Imposiciones a corto plazo' },
  { codigo: '549', descripcion: 'Desembolsos pendientes sobre participaciones a corto plazo' },
  { codigo: '550', descripcion: 'Titular de la explotación' },
  { codigo: '551', descripcion: 'Cuenta corriente con socios y administradores' },
  { codigo: '552', descripcion: 'Cuenta corriente con otras empresas del grupo' },
  { codigo: '553', descripcion: 'Cuenta corriente con otras partes vinculadas' },
  {
    codigo: '554',
    descripcion: 'Cuenta corriente con uniones temporales de empresas y comunidades de bienes',
  },
  { codigo: '555', descripcion: 'Partidas pendientes de aplicación' },
  { codigo: '556', descripcion: 'Desembolsos exigidos sobre participaciones, empresas del grupo' },
  { codigo: '557', descripcion: 'Desembolsos exigidos sobre participaciones, empresas asociadas' },
  { codigo: '558', descripcion: 'Desembolsos exigidos sobre participaciones, otras' },
  { codigo: '559', descripcion: 'Activos por derivados financieros a corto plazo' },
  { codigo: '560', descripcion: 'Fianzas constituidas a corto plazo' },
  { codigo: '561', descripcion: 'Depósitos constituidos a corto plazo' },
  { codigo: '565', descripcion: 'Fianzas constituidas a corto plazo, partes vinculadas' },
  { codigo: '566', descripcion: 'Depósitos constituidos a corto plazo, partes vinculadas' },
  { codigo: '570', descripcion: 'Caja, euros' },
  { codigo: '571', descripcion: 'Caja, moneda extranjera' },
  { codigo: '572', descripcion: 'Bancos e instituciones de crédito c/c vista, euros' },
  { codigo: '573', descripcion: 'Bancos e instituciones de crédito c/c vista, moneda extranjera' },
  { codigo: '574', descripcion: 'Bancos e instituciones de crédito, cuentas de ahorro, euros' },
  {
    codigo: '575',
    descripcion: 'Bancos e instituciones de crédito, cuentas de ahorro, moneda extranjera',
  },
  { codigo: '576', descripcion: 'Inversiones a corto plazo de gran liquidez' },
  { codigo: '580', descripcion: 'Activos no corrientes mantenidos para la venta' },
  {
    codigo: '581',
    descripcion: 'Pasivos vinculados con activos no corrientes mantenidos para la venta',
  },
  {
    codigo: '590',
    descripcion: 'Deterioro de valor de participaciones a corto plazo, empresas del grupo',
  },
  {
    codigo: '593',
    descripcion: 'Deterioro de valor de valores de deuda a corto plazo, empresas del grupo',
  },
  {
    codigo: '595',
    descripcion: 'Deterioro de valor de créditos a corto plazo, empresas del grupo',
  },
  { codigo: '596', descripcion: 'Deterioro de valor de participaciones a corto plazo' },
  {
    codigo: '597',
    descripcion: 'Deterioro de valor de valores representativos de deuda a corto plazo',
  },
  { codigo: '598', descripcion: 'Deterioro de valor de créditos a corto plazo' },
  // ══ GRUPO 6 — Compras y gastos ════════════════════════════════════════════
  { codigo: '600', descripcion: 'Compras de mercaderías' },
  { codigo: '601', descripcion: 'Compras de materias primas' },
  { codigo: '602', descripcion: 'Compras de otros aprovisionamientos' },
  { codigo: '606', descripcion: 'Descuentos sobre compras por pronto pago' },
  { codigo: '607', descripcion: 'Trabajos realizados por otras empresas' },
  { codigo: '608', descripcion: 'Devoluciones de compras y operaciones similares' },
  { codigo: '609', descripcion: 'Rappels por compras' },
  { codigo: '610', descripcion: 'Variación de existencias de mercaderías' },
  { codigo: '611', descripcion: 'Variación de existencias de materias primas' },
  { codigo: '612', descripcion: 'Variación de existencias de otros aprovisionamientos' },
  { codigo: '620', descripcion: 'Gastos en investigación y desarrollo del ejercicio' },
  { codigo: '621', descripcion: 'Arrendamientos y cánones' },
  { codigo: '622', descripcion: 'Reparaciones y conservación' },
  { codigo: '623', descripcion: 'Servicios de profesionales independientes' },
  { codigo: '624', descripcion: 'Transportes' },
  { codigo: '625', descripcion: 'Primas de seguros' },
  { codigo: '626', descripcion: 'Servicios bancarios y similares' },
  { codigo: '627', descripcion: 'Publicidad, propaganda y relaciones públicas' },
  { codigo: '628', descripcion: 'Suministros' },
  { codigo: '629', descripcion: 'Otros servicios' },
  { codigo: '630', descripcion: 'Impuesto sobre beneficios' },
  { codigo: '631', descripcion: 'Otros tributos' },
  { codigo: '632', descripcion: 'Responsabilidad fiscal por impuestos diferidos' },
  { codigo: '633', descripcion: 'Ajustes negativos en la imposición sobre beneficios' },
  { codigo: '634', descripcion: 'Ajustes negativos en la imposición indirecta' },
  { codigo: '636', descripcion: 'Devolución de impuestos' },
  { codigo: '638', descripcion: 'Ajuste positivo en la imposición sobre beneficios' },
  { codigo: '639', descripcion: 'Ajustes positivos en la imposición indirecta' },
  { codigo: '640', descripcion: 'Sueldos y salarios' },
  { codigo: '641', descripcion: 'Indemnizaciones' },
  { codigo: '642', descripcion: 'Seguridad Social a cargo de la empresa' },
  {
    codigo: '643',
    descripcion: 'Retribuciones a largo plazo mediante sistemas de aportación definida',
  },
  {
    codigo: '644',
    descripcion: 'Retribuciones a largo plazo mediante sistemas de prestación definida',
  },
  { codigo: '645', descripcion: 'Retribuciones al personal mediante instrumentos de patrimonio' },
  { codigo: '649', descripcion: 'Otros gastos sociales' },
  { codigo: '650', descripcion: 'Pérdidas de créditos comerciales incobrables' },
  { codigo: '651', descripcion: 'Resultados de operaciones en común' },
  { codigo: '659', descripcion: 'Otras pérdidas en gestión corriente' },
  { codigo: '660', descripcion: 'Gastos financieros por actualización de provisiones' },
  { codigo: '661', descripcion: 'Intereses de obligaciones y bonos' },
  { codigo: '662', descripcion: 'Intereses de deudas' },
  {
    codigo: '663',
    descripcion: 'Pérdidas por valoración de instrumentos financieros a valor razonable',
  },
  { codigo: '664', descripcion: 'Dividendos de participaciones consideradas pasivos financieros' },
  { codigo: '665', descripcion: 'Intereses por descuento de efectos y operaciones de factoring' },
  { codigo: '666', descripcion: 'Pérdidas en participaciones y valores representativos de deuda' },
  { codigo: '667', descripcion: 'Pérdidas de créditos' },
  { codigo: '668', descripcion: 'Diferencias negativas de cambio' },
  { codigo: '669', descripcion: 'Otros gastos financieros' },
  { codigo: '670', descripcion: 'Pérdidas procedentes del inmovilizado intangible' },
  { codigo: '671', descripcion: 'Pérdidas procedentes del inmovilizado material' },
  { codigo: '672', descripcion: 'Pérdidas procedentes de las inversiones inmobiliarias' },
  {
    codigo: '673',
    descripcion: 'Pérdidas procedentes de participaciones a largo plazo en partes vinculadas',
  },
  { codigo: '674', descripcion: 'Pérdidas por operaciones con obligaciones propias' },
  {
    codigo: '675',
    descripcion: 'Pérdidas procedentes de participaciones en el capital a largo plazo',
  },
  { codigo: '678', descripcion: 'Gastos excepcionales' },
  { codigo: '679', descripcion: 'Gastos y pérdidas de otros ejercicios' },
  { codigo: '680', descripcion: 'Amortización del inmovilizado intangible' },
  { codigo: '681', descripcion: 'Amortización del inmovilizado material' },
  { codigo: '682', descripcion: 'Amortización de las inversiones inmobiliarias' },
  { codigo: '690', descripcion: 'Pérdidas por deterioro del inmovilizado intangible' },
  { codigo: '691', descripcion: 'Pérdidas por deterioro del inmovilizado material' },
  { codigo: '692', descripcion: 'Pérdidas por deterioro de las inversiones inmobiliarias' },
  { codigo: '693', descripcion: 'Pérdidas por deterioro de existencias' },
  { codigo: '694', descripcion: 'Pérdidas por deterioro de créditos por operaciones comerciales' },
  { codigo: '695', descripcion: 'Dotaciones a las provisiones' },
  {
    codigo: '696',
    descripcion: 'Pérdidas por deterioro de participaciones y valores a largo plazo',
  },
  { codigo: '697', descripcion: 'Pérdidas por deterioro de créditos a largo plazo' },
  {
    codigo: '698',
    descripcion: 'Pérdidas por deterioro de participaciones y valores a corto plazo',
  },
  { codigo: '699', descripcion: 'Pérdidas por deterioro de créditos a corto plazo' },
  // ══ GRUPO 7 — Ventas e ingresos ═══════════════════════════════════════════
  { codigo: '700', descripcion: 'Ventas de mercaderías' },
  { codigo: '701', descripcion: 'Ventas de productos terminados' },
  { codigo: '702', descripcion: 'Ventas de productos semiterminados' },
  { codigo: '703', descripcion: 'Ventas de subproductos y residuos' },
  { codigo: '704', descripcion: 'Ventas de envases y embalajes' },
  { codigo: '705', descripcion: 'Prestaciones de servicios' },
  { codigo: '706', descripcion: 'Descuentos sobre ventas por pronto pago' },
  { codigo: '708', descripcion: 'Devoluciones de ventas y operaciones similares' },
  { codigo: '709', descripcion: 'Rappels sobre ventas' },
  { codigo: '710', descripcion: 'Variación de existencias de productos en curso' },
  { codigo: '711', descripcion: 'Variación de existencias de productos semiterminados' },
  { codigo: '712', descripcion: 'Variación de existencias de productos terminados' },
  {
    codigo: '713',
    descripcion: 'Variación de existencias de subproductos, residuos y materiales recuperados',
  },
  { codigo: '720', descripcion: 'Trabajos realizados para el inmovilizado intangible' },
  { codigo: '721', descripcion: 'Trabajos realizados para el inmovilizado material' },
  { codigo: '722', descripcion: 'Trabajos realizados para inversiones inmobiliarias' },
  { codigo: '731', descripcion: 'Trabajos realizados para el inmovilizado material en curso' },
  { codigo: '740', descripcion: 'Subvenciones, donaciones y legados a la explotación' },
  { codigo: '741', descripcion: 'Subvenciones oficiales a la explotación' },
  {
    codigo: '747',
    descripcion: 'Otras subvenciones, donaciones y legados trasladados al resultado',
  },
  { codigo: '750', descripcion: 'Ingresos por arrendamientos' },
  { codigo: '751', descripcion: 'Ingresos de propiedad industrial cedida en explotación' },
  { codigo: '752', descripcion: 'Ingresos por comisiones' },
  { codigo: '753', descripcion: 'Ingresos por servicios al personal' },
  { codigo: '754', descripcion: 'Ingresos por servicios diversos' },
  { codigo: '755', descripcion: 'Ingresos por prestaciones de servicios al personal' },
  { codigo: '759', descripcion: 'Ingresos por servicios diversos' },
  { codigo: '760', descripcion: 'Ingresos de participaciones en instrumentos de patrimonio' },
  { codigo: '761', descripcion: 'Ingresos de valores representativos de deuda' },
  { codigo: '762', descripcion: 'Ingresos de créditos a largo plazo' },
  { codigo: '763', descripcion: 'Ingresos de créditos a corto plazo' },
  { codigo: '765', descripcion: 'Descuentos sobre compras por pronto pago' },
  {
    codigo: '766',
    descripcion: 'Beneficios en participaciones y valores representativos de deuda',
  },
  { codigo: '767', descripcion: 'Ingresos de créditos' },
  { codigo: '768', descripcion: 'Diferencias positivas de cambio' },
  { codigo: '769', descripcion: 'Otros ingresos financieros' },
  { codigo: '770', descripcion: 'Beneficios procedentes del inmovilizado intangible' },
  { codigo: '771', descripcion: 'Beneficios procedentes del inmovilizado material' },
  { codigo: '772', descripcion: 'Beneficios procedentes de las inversiones inmobiliarias' },
  {
    codigo: '773',
    descripcion: 'Beneficios procedentes de participaciones a largo plazo, partes vinculadas',
  },
  { codigo: '774', descripcion: 'Beneficios por operaciones con obligaciones propias' },
  {
    codigo: '775',
    descripcion: 'Subvenciones, donaciones y legados de capital transferidos al resultado',
  },
  { codigo: '778', descripcion: 'Ingresos excepcionales' },
  { codigo: '779', descripcion: 'Ingresos y beneficios de ejercicios anteriores' },
  { codigo: '790', descripcion: 'Reversión del deterioro del inmovilizado intangible' },
  { codigo: '791', descripcion: 'Reversión del deterioro del inmovilizado material' },
  { codigo: '792', descripcion: 'Reversión del deterioro de inversiones inmobiliarias' },
  { codigo: '793', descripcion: 'Reversión del deterioro de existencias' },
  { codigo: '794', descripcion: 'Reversión del deterioro de créditos por operaciones comerciales' },
  { codigo: '795', descripcion: 'Exceso de provisiones' },
  {
    codigo: '796',
    descripcion: 'Reversión del deterioro de participaciones y valores a largo plazo',
  },
  { codigo: '797', descripcion: 'Reversión del deterioro de créditos a largo plazo' },
  {
    codigo: '798',
    descripcion: 'Reversión del deterioro de participaciones y valores a corto plazo',
  },
  { codigo: '799', descripcion: 'Reversión del deterioro de créditos a corto plazo' },
  // ══ GRUPO 8 — Gastos imputados al patrimonio neto ════════════════════════
  { codigo: '800', descripcion: 'Pérdidas en activos financieros disponibles para la venta' },
  { codigo: '801', descripcion: 'Pérdidas en instrumentos de cobertura' },
  {
    codigo: '802',
    descripcion: 'Transferencia de beneficios en activos financieros disponibles para la venta',
  },
  {
    codigo: '810',
    descripcion: 'Pérdidas actuariales y ajustes por el efecto de límite del activo',
  },
  { codigo: '811', descripcion: 'Transferencia de pérdidas actuariales' },
  { codigo: '820', descripcion: 'Diferencias de conversión negativas' },
  { codigo: '821', descripcion: 'Transferencia de diferencias de conversión negativas' },
  // ══ GRUPO 9 — Ingresos imputados al patrimonio neto ══════════════════════
  { codigo: '900', descripcion: 'Beneficios en activos financieros disponibles para la venta' },
  { codigo: '901', descripcion: 'Beneficios en instrumentos de cobertura' },
  {
    codigo: '902',
    descripcion: 'Transferencia de pérdidas en activos financieros disponibles para la venta',
  },
  { codigo: '910', descripcion: 'Ingresos por valoración de instrumentos de cobertura' },
  { codigo: '911', descripcion: 'Transferencia de ingresos actuariales' },
  { codigo: '920', descripcion: 'Diferencias de conversión positivas' },
  { codigo: '921', descripcion: 'Transferencia de diferencias de conversión positivas' },
];

const TIPOS_IVA = [
  { value: '21', label: '21% — General' },
  { value: '10', label: '10% — Reducido' },
  { value: '5', label: '5% — Reducido especial' },
  { value: '4', label: '4% — Superreducido' },
  { value: '0', label: '0% — Exento / ISP' },
];

const TIPOS_OPERACION: { value: TipoOperacion; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'inversion_sujeto_pasivo', label: 'Inversión del sujeto pasivo' },
  { value: 'exenta', label: 'Exenta de IVA (art. 20 LIVA)' },
  { value: 'no_sujeta', label: 'No sujeta a IVA' },
  { value: 'suplido', label: 'Suplido' },
];

function sugerirCuenta(concepto: string, proveedor: string): string {
  const t = (concepto + ' ' + proveedor).toLowerCase();
  if (/arrendamiento|alquiler|c[aá]non/.test(t)) return '621';
  if (/reparaci|reforma|obra|mantenimiento|rehabilitaci/.test(t)) return '622';
  if (/notari|abogad|asesor|gestor|consultor|honorario|arquitecto|ingenier|aparejador/.test(t))
    return '623';
  if (/transporte|mensajer[ií]a|envio|env[ií]o|log[ií]stica/.test(t)) return '624';
  if (/seguro/.test(t)) return '625';
  if (/banco|comisi[oó]n|custodia|financier|interés|inter[eé]s/.test(t)) return '626';
  if (/publicidad|marketing|propaganda|relaciones p[uú]blicas/.test(t)) return '627';
  if (/agua|luz|electricidad|gas|suministro|energ[ií]a|tel[eé]fono|internet/.test(t)) return '628';
  if (/impuesto|ibi|tasa|tributo|licencia|gravamen/.test(t)) return '631';
  if (/sueldo|n[oó]mina|salario/.test(t)) return '640';
  if (/indemnizaci/.test(t)) return '641';
  if (/seguridad social|ss |cotizaci/.test(t)) return '642';
  if (/amortizaci[oó]n|depreciac/.test(t)) return '681';
  if (/material|suministro|mercanc[ií]a|producto/.test(t)) return '600';
  return '629';
}

function buildLineasAsiento(
  cuentaGasto: string,
  base: number,
  cuotaIva: number,
  retencion: number,
  totalPagar: number,
  tipoOp: string,
  tivaNum: number,
): LineaAsiento[] {
  const desc = CUENTAS_GASTO.find((c) => c.codigo === cuentaGasto)?.descripcion ?? 'Gasto';
  const lineas: LineaAsiento[] = [
    { cuenta_codigo: cuentaGasto, cuenta_descripcion: desc, debe: base, haber: 0 },
  ];

  if (tipoOp === 'inversion_sujeto_pasivo' && tivaNum > 0) {
    // ISP: el receptor auto-liquida el IVA — genera 472 y 477 por el mismo importe
    const ivaISP = +((base * tivaNum) / 100).toFixed(2);
    lineas.push({
      cuenta_codigo: '472',
      cuenta_descripcion: 'H.P. IVA soportado (ISP)',
      debe: ivaISP,
      haber: 0,
    });
    lineas.push({
      cuenta_codigo: '477',
      cuenta_descripcion: 'H.P. IVA repercutido (ISP)',
      debe: 0,
      haber: ivaISP,
    });
  } else if (cuotaIva > 0) {
    lineas.push({
      cuenta_codigo: '472',
      cuenta_descripcion: 'H.P. IVA soportado',
      debe: cuotaIva,
      haber: 0,
    });
  }

  if (retencion > 0)
    lineas.push({
      cuenta_codigo: '4751',
      cuenta_descripcion: 'H.P. retenciones IRPF',
      debe: 0,
      haber: retencion,
    });
  lineas.push({
    cuenta_codigo: '400',
    cuenta_descripcion: 'Proveedores',
    debe: 0,
    haber: totalPagar,
  });
  return lineas;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function detectarRol(
  email: string | null,
  config: ConfiguracionContabilidad | null,
): RolAprobacion | null {
  if (!email || !config) return null;
  if (email === config.email_guille) return 'guille';
  if (email === config.email_javi) return 'javi';
  if (email === config.email_alicia) return 'alicia';
  return null;
}

function esTestMode(config: ConfiguracionContabilidad | null): boolean {
  if (!config) return true;
  return config.email_guille === config.email_javi && config.email_guille === config.email_alicia;
}

// ── OCR aggregate confidence ──────────────────────────────────────────────────

function calcOcrPct(c: OcrConfianza | null): number | null {
  if (!c) return null;
  const vals = Object.values(c).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
}

// ── Estado badge maps ─────────────────────────────────────────────────────────
// Label visible: fuente única ESTADO_FACTURA_RECIBIDA_LABEL en @alsari/types.
// Aquí solo el color del badge.

const ESTADO_COLOR: Record<FacturaRecibida['estado'], string> = {
  borrador_ocr: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  revision_javi: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
  pendiente_pago: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
  pagada: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  rechazada: 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20',
};

// ── Field — lectura elegante, edición discreta ────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const isEmpty = !value;

  return (
    <div className="group">
      <p className="text-2xs mb-1 uppercase leading-none tracking-widest text-zinc-500">
        {label}
        {required && <span className="ml-0.5 text-rose-400/70">*</span>}
      </p>
      <div
        className={`relative rounded-md transition-all duration-150 ${
          focused
            ? 'bg-white/[0.04] ring-1 ring-white/15'
            : 'bg-transparent ring-0 hover:bg-white/[0.02]'
        } ${disabled ? 'pointer-events-none opacity-40' : ''} `}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`h-8 w-full bg-transparent px-2 text-sm font-medium [color-scheme:dark] focus:outline-none ${isEmpty && !focused ? 'text-zinc-600' : 'text-white'} placeholder:text-zinc-600`}
          placeholder="—"
        />
      </div>
    </div>
  );
}

// ── Select Field — portal-based (evita fondo blanco en Chrome/Windows) ────────

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  hint,
  searchable = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hint?: string | undefined;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered =
    searchable && q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q.toLowerCase()) || o.value.includes(q),
        )
      : options;

  function openMenu() {
    if (disabled || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = Math.min(filtered.length * 36 + (searchable ? 44 : 0) + 8, 320);
    const top = window.innerHeight - r.bottom < menuH ? r.top - menuH - 4 : r.bottom + 4;
    setPos({ top, left: r.left, width: r.width });
    setQ('');
    setOpen(true);
  }

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-2xs uppercase leading-none tracking-widest text-zinc-500">{label}</p>
        {hint && <span className="text-2xs tracking-wide text-blue-400/70">{hint}</span>}
      </div>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else openMenu();
        }}
        className={`flex h-8 w-full items-center justify-between rounded-md px-2 text-sm font-medium transition-all duration-150 ${open ? 'bg-white/[0.04] ring-1 ring-white/15' : 'bg-transparent hover:bg-white/[0.02]'} ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        <span className={selectedLabel ? 'text-white' : 'text-zinc-600'}>
          {selectedLabel || '—'}
        </span>
        <ChevronDown size={11} className="ml-2 shrink-0 text-zinc-500" />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
            <div
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-[9999] flex max-h-[320px] flex-col rounded-lg border border-white/10 bg-zinc-900 shadow-2xl"
            >
              {searchable && (
                <div className="shrink-0 px-2 pb-1 pt-2">
                  <input
                    ref={searchRef}
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Buscar cuenta..."
                    className="w-full rounded-md border border-white/[0.08] bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-zinc-600">Sin resultados</p>
                ) : (
                  filtered.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onChange(o.value);
                        setOpen(false);
                        setQ('');
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        o.value === value
                          ? 'bg-white/[0.08] font-medium text-white'
                          : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs pb-3 uppercase tracking-widest text-zinc-600">{children}</p>;
}

// ── Timeline de trazabilidad ──────────────────────────────────────────────────

function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const estadoLabel = (e: string) =>
  ESTADO_FACTURA_RECIBIDA_LABEL[e as FacturaRecibida['estado']] ?? e;

function TimelineRow({
  actor,
  fecha,
  titulo,
  detalle,
  sintetica = false,
}: {
  actor: string;
  fecha: string;
  titulo: string;
  detalle?: string;
  sintetica?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${sintetica ? 'bg-zinc-600' : 'bg-zinc-400'}`}
        />
        <span className="w-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="min-w-0 pb-1">
        <p className="text-2xs text-zinc-500">
          <span className="font-medium text-zinc-300">{actor}</span> · {fecha}
          {sintetica && <span className="text-zinc-600"> · informativo</span>}
        </p>
        <p className="text-xs text-zinc-300">
          {titulo}
          {detalle ? <span className="text-zinc-500"> · {detalle}</span> : null}
        </p>
      </div>
    </div>
  );
}

function Timeline({
  factura,
  aprobaciones,
}: {
  factura: FacturaRecibida;
  aprobaciones: FacturaAprobacion[];
}) {
  // Para facturas antiguas sin evento de creación auditado, sintetizamos una
  // primera línea informativa (no es un evento auditado real) desde created_at.
  const sintetica = !aprobaciones.some((a) => a.accion === 'crea_borrador_ocr');

  if (aprobaciones.length === 0 && !sintetica) {
    return <p className="text-2xs text-zinc-600">Sin historial.</p>;
  }

  return (
    <div>
      {sintetica && factura.created_at && (
        <TimelineRow
          actor="Sistema"
          fecha={fmtFechaHora(factura.created_at)}
          titulo="Creada desde OCR"
          detalle="Validación Guille"
          sintetica
        />
      )}
      {aprobaciones.map((a) => (
        <TimelineRow
          key={a.id}
          actor={a.actor_nombre ?? (a.actor_rol === 'sistema' ? 'Sistema' : (a.actor_email ?? '—'))}
          fecha={fmtFechaHora(a.created_at)}
          titulo={ACCION_APROBACION_LABEL[a.accion]}
          detalle={[
            a.estado_anterior
              ? `${estadoLabel(a.estado_anterior)} → ${estadoLabel(a.estado_nuevo)}`
              : estadoLabel(a.estado_nuevo),
            a.motivo_rechazo || a.comentario || '',
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </div>
  );
}

// ── Props / DraftForm ─────────────────────────────────────────────────────────

type Props = {
  factura: FacturaRecibida;
  config: ConfiguracionContabilidad | null;
  userEmail: string | null;
  isPrivateMode: boolean;
  sociedades?: { id: string; nombre: string; cif?: string | null }[] | undefined;
  onClose: () => void;
  onUpdate: (f: FacturaRecibida) => void;
};

type DraftForm = {
  proveedor_nombre: string;
  proveedor_nif: string;
  numero_factura: string;
  fecha_factura: string;
  fecha_vencimiento: string;
  base_imponible: string;
  tipo_iva: string;
  cuota_iva: string;
  retencion_pct: string;
  retencion_importe: string;
  total: string;
  concepto: string;
  cuenta_gasto: string;
  tipo_operacion: string;
  es_domiciliada: boolean; // PR E
  notas: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

// ── Pagos (libro de tesorería) ────────────────────────────────────────────────

const ESTADO_PAGO_STYLE: Record<EstadoPago, string> = {
  sin_pagos: 'text-zinc-400 bg-white/[0.04] ring-white/10',
  pago_parcial: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
  pagada: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
  sobrepagada: 'text-rose-400 bg-rose-500/10 ring-rose-500/20',
  descuadrada: 'text-rose-400 bg-rose-500/10 ring-rose-500/20',
};

function fmtFechaCorta(iso: string): string {
  try {
    return new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
}

type PagoFormData = {
  importe: number;
  fecha: string;
  metodo: MetodoPago;
  tipo: TipoPago;
  file: File | null;
  comentario: string;
};

function PagoForm({
  soloRegularizacion,
  saving,
  onSubmit,
  onCancel,
}: {
  soloRegularizacion: boolean;
  saving: boolean;
  onSubmit: (a: PagoFormData) => void;
  onCancel: () => void;
}) {
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia');
  const [tipo, setTipo] = useState<TipoPago>(soloRegularizacion ? 'regularizacion' : 'parcial');
  const [comentario, setComentario] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importeNum = parseFloat(importe.replace(',', '.'));
  const valido = !Number.isNaN(importeNum) && importeNum !== 0 && !!fecha && !saving;
  const faltaJustificante = metodo === 'transferencia' && !file;

  const tipoOptions = (
    soloRegularizacion
      ? (['regularizacion'] as TipoPago[])
      : (['parcial', 'total', 'anticipo', 'regularizacion'] as TipoPago[])
  ).map((t) => ({ value: t, label: TIPO_PAGO_LABEL[t] }));
  const metodoOptions = (
    ['transferencia', 'domiciliacion', 'tarjeta', 'efectivo', 'otro'] as MetodoPago[]
  ).map((m) => ({ value: m, label: METODO_PAGO_LABEL[m] }));

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Importe (€)" value={importe} onChange={setImporte} required />
        <Field label="Fecha" value={fecha} onChange={setFecha} type="date" required />
        <SelectField
          label="Método"
          value={metodo}
          onChange={(v) => setMetodo(v as MetodoPago)}
          options={metodoOptions}
        />
        <SelectField
          label="Tipo"
          value={tipo}
          onChange={(v) => setTipo(v as TipoPago)}
          options={tipoOptions}
          disabled={soloRegularizacion}
        />
      </div>

      <div>
        <p className="text-2xs mb-1 uppercase tracking-widest text-zinc-500">Justificante</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-2xs flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 font-medium text-zinc-300 transition-colors hover:border-white/20"
          >
            <Paperclip size={11} /> {file ? 'Cambiar' : 'Adjuntar'}
          </button>
          {file && <span className="text-2xs truncate text-zinc-400">{file.name}</span>}
        </div>
        {faltaJustificante && (
          <p className="text-2xs mt-1 flex items-center gap-1 text-amber-400/80">
            <AlertTriangle size={10} /> Transferencia sin justificante (puedes registrar
            igualmente).
          </p>
        )}
      </div>

      <Field label="Comentario" value={comentario} onChange={setComentario} />

      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-2xs flex-1 rounded-lg border border-white/[0.08] py-2 font-medium text-zinc-500 transition-all hover:border-white/15 hover:text-zinc-300 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() =>
            onSubmit({
              importe: importeNum,
              fecha,
              metodo,
              tipo,
              file,
              comentario: comentario.trim(),
            })
          }
          disabled={!valido}
          className="text-2xs flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 py-2 font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Registrar
          pago
        </button>
      </div>
    </div>
  );
}

function PagosSection({
  resumen,
  pagos,
  incidencias,
  isPrivateMode,
  puedeRegistrar,
  soloRegularizacion,
  puedeResolver,
  showForm,
  registrando,
  onToggleForm,
  onSubmit,
  onAbrirJustificante,
  onResolverIncidencia,
}: {
  resumen: ResumenPago;
  pagos: FacturaPago[];
  incidencias: FacturaIncidencia[];
  isPrivateMode: boolean;
  puedeRegistrar: boolean;
  soloRegularizacion: boolean;
  puedeResolver: boolean;
  showForm: boolean;
  registrando: boolean;
  onToggleForm: (v: boolean) => void;
  onSubmit: (a: PagoFormData) => void;
  onAbrirJustificante: (path: string) => void;
  onResolverIncidencia: (id: string) => void;
}) {
  const f = (n: number) =>
    isPrivateMode
      ? '****'
      : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const pct = Math.max(0, Math.min(100, Math.round(resumen.pct * 100)));
  const incidenciasAbiertas = incidencias.filter((i) => !i.resuelta);

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="space-y-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-lg font-light text-white">{f(resumen.totalPagado)}</span>
            <span className="text-2xs truncate text-zinc-500">de {f(resumen.totalAPagar)}</span>
          </div>
          <span
            className={`text-2xs shrink-0 rounded-full px-2 py-0.5 font-medium ring-1 ${ESTADO_PAGO_STYLE[resumen.estadoPago]}`}
          >
            {ESTADO_PAGO_LABEL[resumen.estadoPago]}
            {resumen.dentroTolerancia ? ' · dentro de tolerancia' : ''}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${resumen.estadoPago === 'sobrepagada' ? 'bg-rose-500/70' : 'bg-emerald-500/60'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-2xs flex items-center justify-between text-zinc-500">
          <span>
            Pendiente:{' '}
            <span
              className={
                resumen.pendiente > 0
                  ? 'text-amber-400'
                  : resumen.pendiente < 0
                    ? 'text-rose-400'
                    : 'text-emerald-400'
              }
            >
              {f(resumen.pendiente)}
            </span>
          </span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Lista de pagos */}
      {pagos.length > 0 && (
        <div className="space-y-1.5">
          {pagos.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5"
            >
              <span className="text-2xs w-12 shrink-0 text-zinc-500">
                {fmtFechaCorta(p.fecha_pago)}
              </span>
              <span
                className={`text-sm font-medium ${p.importe < 0 ? 'text-rose-300' : 'text-white'}`}
              >
                {f(p.importe)}
              </span>
              <span className="text-2xs truncate text-zinc-500">
                · {METODO_PAGO_LABEL[p.metodo_pago]} · {TIPO_PAGO_LABEL[p.tipo_pago]}
              </span>
              {p.justificante_storage_path && (
                <button
                  onClick={() => onAbrirJustificante(p.justificante_storage_path!)}
                  title="Ver justificante"
                  className="ml-auto shrink-0 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                >
                  <Paperclip size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Incidencias abiertas */}
      {incidenciasAbiertas.length > 0 && (
        <div className="space-y-1.5">
          {incidenciasAbiertas.map((i) => (
            <div
              key={i.id}
              className="flex items-start gap-2 rounded-md border border-rose-500/15 bg-rose-500/[0.06] px-2.5 py-1.5"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-medium text-rose-300">
                  {TIPO_INCIDENCIA_LABEL[i.tipo]}
                </p>
                {i.descripcion && (
                  <p className="text-2xs leading-snug text-zinc-400">{i.descripcion}</p>
                )}
              </div>
              {puedeResolver && (
                <button
                  onClick={() => onResolverIncidencia(i.id)}
                  className="text-2xs shrink-0 font-medium text-zinc-400 transition-colors hover:text-emerald-400"
                >
                  Resolver
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form / botón */}
      {puedeRegistrar &&
        (showForm ? (
          <PagoForm
            soloRegularizacion={soloRegularizacion}
            saving={registrando}
            onSubmit={onSubmit}
            onCancel={() => onToggleForm(false)}
          />
        ) : (
          <button
            onClick={() => onToggleForm(true)}
            className="text-2xs flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 py-2 font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.02]"
          >
            <Plus size={12} /> {soloRegularizacion ? 'Registrar regularización' : 'Registrar pago'}
          </button>
        ))}
    </div>
  );
}

export function FacturaReviewPanel({
  factura,
  config,
  userEmail,
  isPrivateMode,
  sociedades,
  onClose,
  onUpdate,
}: Props) {
  const rol = detectarRol(userEmail, config);
  const test = esTestMode(config);
  const c = factura.ocr_confianza as OcrConfianza | null;
  const ocrPct = calcOcrPct(c);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [showVincular, setShowVincular] = useState(false);
  const [partidas, setPartidas] = useState<PartidaParaVincular[]>([]);
  const [loadingPartidas, setLoadingPartidas] = useState(false);
  const [queryPartidas, setQueryPartidas] = useState('');
  const [vincularando, setVincularando] = useState(false);
  const [partidaVinculada, setPartidaVinculada] = useState<PartidaParaVincular | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [aprobaciones, setAprobaciones] = useState<FacturaAprobacion[]>([]);
  const [abriendoPdf, setAbriendoPdf] = useState(false);
  const [pagos, setPagos] = useState<FacturaPago[]>([]);
  const [incidencias, setIncidencias] = useState<FacturaIncidencia[]>([]);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [archivandoDrive, setArchivandoDrive] = useState(false);
  const [sociedadSel, setSociedadSel] = useState<string>(factura.sociedad_id_ref ?? '');
  const [cambiandoSociedad, setCambiandoSociedad] = useState(false);
  const [reglas, setReglas] = useState<ProveedorRegla[]>([]); // PR E
  const [appliedReglaId, setAppliedReglaId] = useState<string | null>(factura.regla_aplicada_id);
  const [creandoRegla, setCreandoRegla] = useState(false);
  const [reglaInfo, setReglaInfo] = useState<string | null>(null);

  const sugerida = sugerirCuenta(factura.concepto ?? '', factura.proveedor_nombre);
  const socVinculada = sociedades?.find((s) => s.id === factura.sociedad_id_ref) ?? null;
  const sociedadNombre = socVinculada?.nombre ?? null;
  const cifVinculada = socVinculada?.cif ?? null;

  // PR D.1 — Sociedad receptora: estado de validación y coherencia con el OCR.
  // `sociedadPendiente` bloquea el visto bueno y el archivo en Drive: nunca se
  // archiva ni se valida una factura cuya sociedad no está confirmada.
  const sociedadPendiente = !factura.sociedad_id_ref || !factura.sociedad_validada;
  const nifMismatch =
    !!normalizeNif(factura.receptor_nif_ocr) &&
    !!normalizeNif(cifVinculada) &&
    normalizeNif(factura.receptor_nif_ocr) !== normalizeNif(cifVinculada);
  const drivePreview = (() => {
    const fecha = factura.fecha_factura || '';
    const año = fecha.slice(0, 4) || '—';
    const mes = fecha.slice(5, 7) || '—';
    return `Contabilidad / ${sociedadNombre ?? '—'} / ${año} / ${mes}`;
  })();

  // Historial de auditoría (timeline). Se recarga tras cada acción.
  const refreshAprobaciones = useCallback(() => {
    getAprobaciones(factura.id)
      .then(setAprobaciones)
      .catch(() => {
        /* no crítico */
      });
  }, [factura.id]);
  useEffect(() => {
    refreshAprobaciones();
  }, [refreshAprobaciones]);

  // Pagos + incidencias (libro de tesorería). Se recargan tras cada acción.
  const refreshPagos = useCallback(() => {
    getFacturaPagos(factura.id)
      .then(setPagos)
      .catch(() => {
        /* no crítico */
      });
    getFacturaIncidencias(factura.id)
      .then(setIncidencias)
      .catch(() => {
        /* no crítico */
      });
  }, [factura.id]);
  useEffect(() => {
    refreshPagos();
  }, [refreshPagos]);

  // PR E — Reglas del proveedor (por contacto). Se usan para SUGERIR (no aplica nada solo).
  useEffect(() => {
    if (!factura.contacto_id) {
      setReglas([]);
      return;
    }
    getReglasByContacto(factura.contacto_id)
      .then(setReglas)
      .catch(() => setReglas([]));
  }, [factura.contacto_id]);

  // Cargar partidas cuando se abre el modal
  useEffect(() => {
    if (!showVincular) return;
    setLoadingPartidas(true);
    searchPartidasPresupuesto()
      .then((rows) => {
        setPartidas(rows);
        setLoadingPartidas(false);
      })
      .catch(() => setLoadingPartidas(false));
  }, [showVincular]);

  const partidasFiltered = useMemo(() => {
    const q = queryPartidas.toLowerCase();
    if (!q) return partidas;
    return partidas.filter(
      (p) =>
        p.presupuesto_nombre.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        p.capitulo_nombre.toLowerCase().includes(q) ||
        (p.proyecto_nombre?.toLowerCase().includes(q) ?? false) ||
        (p.proveedor_esperado?.toLowerCase().includes(q) ?? false),
    );
  }, [partidas, queryPartidas]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { key: string; capitulo: string; presupuesto: string; partidas: PartidaParaVincular[] }
    >();
    for (const p of partidasFiltered) {
      const key = `${p.presupuesto_id}__${p.capitulo_id}`;
      if (!map.has(key))
        map.set(key, {
          key,
          capitulo: p.capitulo_nombre,
          presupuesto: p.presupuesto_nombre,
          partidas: [],
        });
      map.get(key)!.partidas.push(p);
    }
    return Array.from(map.values());
  }, [partidasFiltered]);

  useEffect(() => {
    setExpandedGroups(queryPartidas ? new Set(grouped.map((g) => g.key)) : new Set());
  }, [queryPartidas, grouped]);

  async function handleVincularPartida(partida: PartidaParaVincular) {
    setVincularando(true);
    setError(null);
    try {
      const pago = await crearPagoDesdeFactura(partida, {
        id: factura.id,
        base_imponible: factura.base_imponible,
        tipo_iva: factura.tipo_iva,
        fecha_factura: factura.fecha_factura,
        fecha_vencimiento: factura.fecha_vencimiento,
        numero_factura: factura.numero_factura,
        proveedor_nombre: factura.proveedor_nombre,
        estado: factura.estado,
      });
      setPartidaVinculada(partida);
      setShowVincular(false);
      setQueryPartidas('');
      setExpandedGroups(new Set());
      onUpdate({ ...factura, presupuesto_pago_id: pago.id });
    } catch (e) {
      setShowVincular(false);
      setError(e instanceof Error ? e.message : 'Error al crear el pago en presupuesto');
    }
    setVincularando(false);
  }

  async function handleDesvincular() {
    if (!factura.presupuesto_pago_id) return;
    await desvincularFacturaDePresupuesto(factura.id, factura.presupuesto_pago_id).catch(() => {});
    setPartidaVinculada(null);
    onUpdate({ ...factura, presupuesto_pago_id: null });
  }

  const [form, setForm] = useState<DraftForm>({
    proveedor_nombre: factura.proveedor_nombre,
    proveedor_nif: factura.proveedor_nif ?? '',
    numero_factura: factura.numero_factura ?? '',
    fecha_factura: factura.fecha_factura,
    fecha_vencimiento: factura.fecha_vencimiento ?? '',
    base_imponible: String(factura.base_imponible),
    tipo_iva: String(factura.tipo_iva),
    cuota_iva: String(factura.cuota_iva),
    retencion_pct: String(factura.retencion_pct),
    retencion_importe: String(factura.retencion_importe),
    total: String(factura.total),
    concepto: factura.concepto ?? '',
    cuenta_gasto: factura.cuenta_gasto ?? sugerida,
    tipo_operacion: factura.tipo_operacion ?? 'normal',
    es_domiciliada: factura.es_domiciliada,
    notas: factura.notas ?? '',
  });

  const set = (k: keyof DraftForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isReadOnly = factura.estado === 'pagada' || factura.estado === 'rechazada';

  // Pagos: referencia total_a_pagar (= total − retención). Permiso: Alicia o
  // modo single-operator. Estados con pago: pendiente_pago (normal) y pagada
  // (solo regularizaciones). El estado de pago es DERIVADO (no toca el enum).
  const totalAPagarFactura =
    factura.total_a_pagar || calcularTotalAPagar(factura.total, factura.retencion_importe);
  const resumenPago = calcularEstadoPago(
    totalAPagarFactura,
    pagos.map((p) => p.importe),
  );
  const puedeRegistrarPago =
    (test || rol === 'alicia') &&
    (factura.estado === 'pendiente_pago' || factura.estado === 'pagada');
  const soloRegularizacion = factura.estado === 'pagada';
  const mostrarPagos =
    factura.estado === 'pendiente_pago' || factura.estado === 'pagada' || pagos.length > 0;
  // Drive (PR D): hay algo que archivar si hay PDF de factura o algún justificante.
  const hayDocsDrive = !!factura.storage_path || pagos.some((p) => !!p.justificante_storage_path);

  // Cuando cambia tipo_operacion: auto-ajustar cuota_iva y tipo_iva
  function handleTipoOpChange(v: string) {
    setForm((f) => {
      const next = { ...f, tipo_operacion: v };
      if (v === 'exenta' || v === 'no_sujeta' || v === 'suplido') {
        next.tipo_iva = '0';
        next.cuota_iva = '0';
      } else if (v === 'inversion_sujeto_pasivo') {
        next.cuota_iva = '0'; // cuota_iva = 0 en la factura (el receptor la auto-liquida)
      }
      return next;
    });
  }

  // Live totals
  const base = parseFloat(form.base_imponible) || 0;
  const cuotaIva = parseFloat(form.cuota_iva) || 0;
  const ret = parseFloat(form.retencion_importe) || 0;
  const total = parseFloat(form.total) || 0;
  const totalPagar = total - ret;
  const tivaNum = parseFloat(form.tipo_iva) || 0;

  // PR E — Regla de proveedor aplicable + análisis contra el estado VIVO del formulario.
  const reglaProveedor = useMemo(
    () =>
      seleccionarRegla(
        reglas,
        factura.contacto_id,
        factura.sociedad_id_ref,
        factura.sociedad_validada,
      ),
    [reglas, factura.contacto_id, factura.sociedad_id_ref, factura.sociedad_validada],
  );
  const facturaView: FacturaRecibida = {
    ...factura,
    cuenta_gasto: form.cuenta_gasto || null,
    tipo_operacion: (form.tipo_operacion as TipoOperacion) || null,
    tipo_iva: tivaNum,
    retencion_pct: parseFloat(form.retencion_pct) || 0,
    concepto: form.concepto || null,
    es_domiciliada: form.es_domiciliada,
    total,
  };
  const analisisRegla = reglaProveedor ? analizarRegla(reglaProveedor, facturaView) : null;
  const subEstadoDomiciliada = estadoOperativoFactura(facturaView, pagos);
  const fmtSugValor = (s: Sugerencia): string => {
    if (s.campo === 'es_domiciliada') return 'Sí';
    if (s.campo === 'tipo_operacion')
      return TIPOS_OPERACION.find((o) => o.value === s.valor)?.label ?? String(s.valor);
    if (s.campo === 'tipo_iva' || s.campo === 'retencion_pct') return `${s.valor}%`;
    return String(s.valor);
  };

  // Live asiento preview
  const asientoLineas = useMemo(
    () =>
      buildLineasAsiento(
        form.cuenta_gasto,
        base,
        cuotaIva,
        ret,
        totalPagar,
        form.tipo_operacion,
        tivaNum,
      ),
    [form.cuenta_gasto, base, cuotaIva, ret, totalPagar, form.tipo_operacion, tivaNum],
  );

  const fmt = (n: number) =>
    isPrivateMode
      ? '****'
      : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  // ── Actions ────────────────────────────────────────────────────────────────

  async function registrarCorrecciones(f: DraftForm) {
    const raw = factura.ocr_raw as Record<string, unknown> | null;
    if (!raw) return;
    const campos: (keyof DraftForm)[] = [
      'proveedor_nombre',
      'proveedor_nif',
      'numero_factura',
      'fecha_factura',
      'fecha_vencimiento',
      'base_imponible',
      'tipo_iva',
      'cuota_iva',
      'retencion_pct',
      'retencion_importe',
      'total',
      'concepto',
    ];
    await Promise.allSettled(
      campos.map((campo) => {
        const ocrVal = String(raw[campo] ?? '');
        return registrarCorreccionOcr(campo, ocrVal === f[campo] || (!ocrVal && !f[campo]));
      }),
    );
  }

  function buildUpdates() {
    // PR D.1: sociedad_id_ref NO se persiste aquí (vía updateFacturaRecibida sin
    // auditar). Su cambio pasa siempre por la RPC `cambiar_sociedad_factura`.
    return {
      proveedor_nombre: form.proveedor_nombre.trim() || 'Desconocido',
      ...(form.proveedor_nif ? { proveedor_nif: form.proveedor_nif } : {}),
      ...(form.numero_factura ? { numero_factura: form.numero_factura } : {}),
      ...(form.fecha_vencimiento ? { fecha_vencimiento: form.fecha_vencimiento } : {}),
      ...(form.concepto ? { concepto: form.concepto } : {}),
      ...(form.notas ? { notas: form.notas } : {}),
      fecha_factura: form.fecha_factura,
      base_imponible: base,
      tipo_iva: tivaNum,
      cuota_iva: cuotaIva,
      retencion_pct: parseFloat(form.retencion_pct) || 0,
      retencion_importe: ret,
      total,
      total_a_pagar: totalPagar,
      cuenta_gasto: form.cuenta_gasto || null,
      tipo_operacion: (form.tipo_operacion as TipoOperacion) || 'normal',
      es_domiciliada: form.es_domiciliada,
      ...(appliedReglaId ? { regla_aplicada_id: appliedReglaId } : {}),
    } as Partial<Omit<FacturaRecibida, 'id' | 'created_at' | 'updated_at'>>;
  }

  async function handleAprobar() {
    // PR D.1: nunca se da visto bueno con la sociedad receptora sin validar.
    if (sociedadPendiente) {
      setError(
        'La sociedad receptora no está validada. Reasigna la sociedad correcta antes de dar el visto bueno.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await registrarCorrecciones(form);
      const updates = buildUpdates();
      const umbral = config?.umbral_aprobacion_javi ?? 1000;

      // 1. Persistir ediciones de campos (no auditado) para que la RPC lea el total fresco.
      await updateFacturaRecibida(factura.id, updates);
      // 2. Transición + auditoría ATÓMICAS en la RPC (actor derivado de la sesión).
      const accion = accionDeAvance(factura.estado);
      const comentario =
        accion === 'valida' && total > umbral ? 'Supera el umbral: pasa a revisión de Javi.' : null;
      const actualizada = await avanzarEstadoFacturaConAuditoria({
        facturaId: factura.id,
        accion,
        comentario,
      });

      onUpdate({ ...factura, ...updates, estado: actualizada.estado });
      refreshAprobaciones();

      // Asiento borrador (no-crítico)
      try {
        const totalDebe = asientoLineas.reduce((s, l) => s + l.debe, 0);
        const totalHaber = asientoLineas.reduce((s, l) => s + l.haber, 0);
        await insertAsientoBorrador({
          // No-null garantizado: handleAprobar aborta si sociedadPendiente.
          sociedad_id_ref: factura.sociedad_id_ref!,
          fecha: form.fecha_factura,
          numero: null,
          concepto: `Fra. ${form.numero_factura || factura.id.slice(0, 8)} — ${form.proveedor_nombre}`,
          lineas: asientoLineas,
          total_debe: totalDebe,
          total_haber: totalHaber,
          estado: 'borrador',
          movimiento_id: null,
          factura_recibida_id: factura.id,
          factura_emitida_id: null,
        });
      } catch (asientoErr) {
        console.error('Asiento borrador no creado (no crítico):', asientoErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la factura');
    } finally {
      setSaving(false);
    }
  }

  async function handlePagar() {
    setSaving(true);
    setError(null);
    try {
      const actualizada = await avanzarEstadoFacturaConAuditoria({
        facturaId: factura.id,
        accion: 'marca_pagada',
      });
      if (factura.presupuesto_pago_id) await marcarPagoComoPagado(factura.presupuesto_pago_id);
      onUpdate({ ...factura, estado: actualizada.estado });
      refreshAprobaciones();
      if (actualizada.estado === 'pagada') void handleArchivarDrive(); // auto-archivo a Drive (best-effort)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como pagada');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmarRechazo() {
    if (!motivoRechazo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const motivo = motivoRechazo.trim();
      const notaRechazo = `[RECHAZADA en ${ESTADO_FACTURA_RECIBIDA_LABEL[factura.estado]}] ${motivo}`;
      const notasNuevas = factura.notas ? `${factura.notas}\n${notaRechazo}` : notaRechazo;
      // Persistir las notas (no auditado) y luego transición + auditoría atómicas.
      await updateFacturaRecibida(factura.id, { notas: notasNuevas });
      const actualizada = await avanzarEstadoFacturaConAuditoria({
        facturaId: factura.id,
        accion: 'rechaza',
        motivoRechazo: motivo,
        comentario: motivo,
      });
      onUpdate({ ...factura, estado: actualizada.estado, notas: notasNuevas });
      refreshAprobaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar la factura');
    } finally {
      setSaving(false);
      setRechazando(false);
    }
  }

  // Abre el PDF firmando una URL temporal al hacer clic (el bucket es privado y
  // las URLs caducan; firmar en el momento evita enlaces muertos).
  async function handleAbrirPdf() {
    setAbriendoPdf(true);
    setError(null);
    try {
      const u = await getFacturaPdfUrl(factura);
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
      else setError('No hay documento disponible para esta factura.');
    } catch {
      setError('No se pudo generar el enlace al documento.');
    } finally {
      setAbriendoPdf(false);
    }
  }

  async function handleRegistrarPago(a: PagoFormData) {
    setRegistrandoPago(true);
    setError(null);
    try {
      const pagoId = crypto.randomUUID();
      const just = a.file ? await uploadJustificante(factura.id, pagoId, a.file) : null;
      const r = await registrarPagoFactura({
        pagoId,
        facturaId: factura.id,
        importe: a.importe,
        fechaPago: a.fecha,
        metodoPago: a.metodo,
        tipoPago: a.tipo,
        justificante: just,
        comentario: a.comentario || null,
      });
      if (r.transiciona) {
        onUpdate({ ...factura, estado: 'pagada' });
        void handleArchivarDrive();
      }
      setShowPagoForm(false);
      refreshPagos();
      refreshAprobaciones();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar el pago');
    } finally {
      setRegistrandoPago(false);
    }
  }

  // Archiva la factura + justificantes en Google Drive (best-effort; NO bloquea el
  // flujo). Re-lee la factura para reflejar el estado autoritativo (evita pisar el
  // estado tras una transición a pagada). Drive es secundario.
  async function handleArchivarDrive() {
    // PR D.1: no se archiva en Drive si la sociedad receptora no está validada
    // (evita repetir el caso de la factura archivada bajo la sociedad equivocada).
    if (sociedadPendiente) {
      setError(
        'No se archiva en Drive: la sociedad receptora no está validada. Reasigna la sociedad correcta primero.',
      );
      return;
    }
    setArchivandoDrive(true);
    setError(null);
    try {
      const r = await archivarFacturaEnDrive(factura.id);
      const fresh = await getFacturaById(factura.id);
      if (fresh) onUpdate(fresh);
      refreshPagos();
      if (r.error) setError(`Drive: ${r.error}`);
      else if (r.errores && r.errores.length > 0) setError(`Drive: ${r.errores[0]}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo archivar en Drive.');
    } finally {
      setArchivandoDrive(false);
    }
  }

  // Reasigna la sociedad receptora de forma AUDITADA (RPC `cambiar_sociedad_factura`:
  // actualiza sociedad_id_ref, marca sociedad_validada=true e inserta el evento
  // `cambia_sociedad` con CIF anterior/nuevo). NO pasa por updateFacturaRecibida.
  async function handleCambiarSociedad() {
    if (!sociedadSel || sociedadSel === factura.sociedad_id_ref) return;
    setCambiandoSociedad(true);
    setError(null);
    try {
      const actualizada = await cambiarSociedadFactura(factura.id, sociedadSel);
      onUpdate(actualizada);
      refreshAprobaciones();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la sociedad receptora.');
    } finally {
      setCambiandoSociedad(false);
    }
  }

  // ── PR E — Reglas de proveedor (sugerencias; nada se valida ni paga solo) ─────
  function aplicarSugerencia(s: Sugerencia) {
    switch (s.campo) {
      case 'cuenta_gasto':
        set('cuenta_gasto')(String(s.valor));
        break;
      case 'concepto':
        set('concepto')(String(s.valor));
        break;
      case 'tipo_operacion':
        handleTipoOpChange(String(s.valor));
        break;
      case 'tipo_iva': {
        const tiva = Number(s.valor) || 0;
        const b = parseFloat(form.base_imponible) || 0;
        const sinI = form.tipo_operacion !== 'normal';
        setForm((f) => ({
          ...f,
          tipo_iva: String(tiva),
          cuota_iva: sinI ? '0' : String(+((b * tiva) / 100).toFixed(2)),
        }));
        break;
      }
      case 'retencion_pct': {
        const rpct = Number(s.valor) || 0;
        setForm((f) => ({
          ...f,
          retencion_pct: String(rpct),
          retencion_importe: String(+((base * rpct) / 100).toFixed(2)),
        }));
        break;
      }
      case 'es_domiciliada':
        void handleToggleDomiciliada(true);
        return; // ya persiste por su cuenta
    }
    if (reglaProveedor) setAppliedReglaId(reglaProveedor.id);
  }

  function aplicarTodasSugerencias() {
    analisisRegla?.sugerencias.filter((s) => !s.yaAplicado).forEach(aplicarSugerencia);
  }

  // `es_domiciliada` se persiste al momento: controla el sub-estado operativo
  // (pendiente_cargo/cargada/pagada) incluso en pendiente_pago. NO cambia el estado
  // principal ni registra ningún pago.
  async function handleToggleDomiciliada(next: boolean) {
    setForm((f) => ({ ...f, es_domiciliada: next }));
    setError(null);
    try {
      const patch = {
        es_domiciliada: next,
        ...(reglaProveedor ? { regla_aplicada_id: reglaProveedor.id } : {}),
      };
      await updateFacturaRecibida(factura.id, patch);
      onUpdate({ ...factura, ...patch });
      if (reglaProveedor) setAppliedReglaId(reglaProveedor.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la domiciliación.');
    }
  }

  async function handleCrearReglaDesdeFactura() {
    if (!factura.contacto_id) {
      setError('La factura no tiene proveedor (contacto) asociado.');
      return;
    }
    setCreandoRegla(true);
    setReglaInfo(null);
    setError(null);
    try {
      const draft = reglaDesdeFactura(
        facturaView,
        factura.contacto_id,
        pagos[0]?.metodo_pago ?? null,
      ) as NuevaProveedorRegla;
      const nueva = await insertProveedorRegla(draft);
      setReglas((rs) => [nueva, ...rs]);
      setReglaInfo(
        'Regla creada desde esta factura. Ajústala en Contactos › Reglas de facturación.',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /duplicate|unique|23505/i.test(msg)
          ? 'Ya existe una regla activa para este proveedor y sociedad. Edítala en Contactos.'
          : msg || 'No se pudo crear la regla.',
      );
    } finally {
      setCreandoRegla(false);
    }
  }

  async function handleResolverIncidencia(id: string) {
    setError(null);
    try {
      await resolverIncidenciaFactura(id);
      refreshPagos();
      refreshAprobaciones();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al resolver la incidencia');
    }
  }

  async function handleAbrirJustificante(path: string) {
    setError(null);
    try {
      const u = await getJustificanteUrl(path);
      window.open(u, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No se pudo abrir el justificante.');
    }
  }

  // ── Permisos ───────────────────────────────────────────────────────────────

  const puedeAprobar =
    !sociedadPendiente &&
    ((factura.estado === 'borrador_ocr' && (rol === 'guille' || test)) ||
      (factura.estado === 'revision_javi' && (rol === 'guille' || rol === 'javi' || test)));
  const puedePagar = factura.estado === 'pendiente_pago' && (rol === 'alicia' || test);
  const puedeRechazar = !isReadOnly && (puedeAprobar || puedePagar) && !rechazando;

  const labelAprobar = factura.estado === 'revision_javi' ? 'Aprobar revisión' : 'Dar visto bueno';

  // ISP: cuota_iva = 0 pero tipo_iva indica el % que el receptor auto-liquida
  const ivaISPEfectivo =
    form.tipo_operacion === 'inversion_sujeto_pasivo' ? +((base * tivaNum) / 100).toFixed(2) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-zinc-900">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          {/* Identidad + importe */}
          <div className="min-w-0 flex-1">
            <p className="text-2xs mb-1 font-mono uppercase tracking-widest text-zinc-600">
              {factura.proveedor_nif ?? '—'}
            </p>
            <h2 className="mb-3 truncate text-base font-semibold leading-snug text-white">
              {factura.proveedor_nombre}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-light tracking-tight text-white">
                {isPrivateMode ? '€ ****' : fmt(factura.total)}
              </span>
              <span
                className={`text-2xs inline-flex items-center rounded-md px-2 py-0.5 font-medium ${ESTADO_COLOR[factura.estado]}`}
              >
                {ESTADO_FACTURA_RECIBIDA_LABEL[factura.estado]}
              </span>
            </div>

            {/* Metadatos: fecha, OCR %, sociedad, contacto */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-zinc-600">{factura.fecha_factura}</span>
              {ocrPct !== null && !isReadOnly && (
                <span className="text-2xs text-zinc-600">OCR {ocrPct}%</span>
              )}
              {sociedadNombre && (
                <span className="text-2xs inline-flex items-center gap-1 text-zinc-500">
                  <Building2 size={10} className="shrink-0" />
                  {sociedadNombre}
                </span>
              )}
              {factura.contacto_id && (
                <span className="text-2xs inline-flex items-center gap-1 text-emerald-500/70">
                  <UserCheck size={10} className="shrink-0" />
                  Contacto vinculado
                </span>
              )}
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div className="-mt-0.5 flex shrink-0 items-center gap-1.5">
            {resolveFacturaPdfSource(factura).kind !== 'none' && (
              <button
                onClick={handleAbrirPdf}
                disabled={abriendoPdf}
                title="Ver PDF original"
                className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50"
              >
                {abriendoPdf ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ExternalLink size={14} />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-rose-500/8 mx-5 mt-4 flex shrink-0 items-start gap-2.5 rounded-lg border border-rose-500/15 px-3.5 py-2.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="flex-1 text-xs leading-relaxed text-rose-300/90">{error}</p>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-rose-500/60 transition-colors hover:text-rose-400"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Proveedor */}
        <div className="space-y-4">
          <SectionLabel>Proveedor</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field
              label="Nombre"
              value={form.proveedor_nombre}
              onChange={set('proveedor_nombre')}
              required
              disabled={isReadOnly}
            />
            <Field
              label="NIF / CIF"
              value={form.proveedor_nif}
              onChange={set('proveedor_nif')}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <hr className="border-white/[0.06]" />

        {/* ── Sociedad receptora (PR D.1) ── */}
        <div className="space-y-3">
          <SectionLabel>Sociedad receptora</SectionLabel>

          {/* Sociedad vinculada + estado de validación */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-2xs mb-1 uppercase tracking-widest text-zinc-600">Vinculada</p>
              {factura.sociedad_id_ref ? (
                <>
                  <p className="flex items-center gap-1.5 truncate text-sm text-white">
                    <Building2 size={12} className="shrink-0 text-zinc-500" />
                    {sociedadNombre ?? factura.sociedad_id_ref}
                  </p>
                  {cifVinculada && (
                    <p className="text-2xs mt-1 font-mono text-zinc-500">{cifVinculada}</p>
                  )}
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-amber-300">
                  <AlertTriangle size={12} className="shrink-0" /> Sin asignar
                </p>
              )}
            </div>
            {sociedadPendiente ? (
              <span className="text-2xs inline-flex shrink-0 items-center gap-1 text-amber-400/90">
                <AlertTriangle size={11} /> Pendiente
              </span>
            ) : (
              <span className="text-2xs inline-flex shrink-0 items-center gap-1 text-emerald-400/80">
                <Check size={11} /> Validada
              </span>
            )}
          </div>

          {/* Receptor detectado por OCR */}
          <div className="text-2xs flex items-start gap-2 px-1 text-zinc-500">
            <Building2 size={11} className="mt-0.5 shrink-0 text-zinc-600" />
            <span>
              Facturado a (OCR):{' '}
              {factura.receptor_nombre_ocr ? (
                <>
                  <span className="text-zinc-300">{factura.receptor_nombre_ocr}</span>
                  {factura.receptor_nif_ocr && (
                    <span className="ml-1 font-mono text-zinc-400">
                      ({factura.receptor_nif_ocr})
                    </span>
                  )}
                </>
              ) : (
                <span className="italic text-zinc-600">no detectado</span>
              )}
            </span>
          </div>

          {/* Alerta de discrepancia NIF receptor ↔ sociedad vinculada */}
          {nifMismatch && (
            <div className="bg-amber-500/8 flex items-start gap-2.5 rounded-lg border border-amber-500/20 px-3 py-2.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-2xs leading-relaxed text-amber-300/90">
                La sociedad vinculada no coincide con el receptor detectado por OCR. Revisa y
                reasigna la sociedad correcta antes de dar el visto bueno.
              </p>
            </div>
          )}

          {/* Selector + reasignación auditada (RPC cambiar_sociedad_factura) */}
          {sociedades && sociedades.length > 0 && !isReadOnly && (
            <div className="space-y-2">
              <SelectField
                label="Reasignar sociedad"
                value={sociedadSel}
                onChange={setSociedadSel}
                options={sociedades.map((s) => ({
                  value: s.id,
                  label: s.cif ? `${s.nombre} · ${s.cif}` : s.nombre,
                }))}
              />
              {sociedadSel && sociedadSel !== factura.sociedad_id_ref && (
                <button
                  onClick={handleCambiarSociedad}
                  disabled={cambiandoSociedad}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                  {cambiandoSociedad ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Building2 size={13} />
                  )}
                  Reasignar y validar sociedad
                </button>
              )}
            </div>
          )}

          {/* Previsualización de la ruta de archivo en Drive */}
          <div className="text-2xs flex items-center gap-1.5 px-1 text-zinc-600">
            <Cloud size={11} className="shrink-0" />
            <span className="truncate font-mono">{drivePreview}</span>
          </div>
        </div>

        <hr className="border-white/[0.06]" />

        {/* ── Proveedor recurrente / domiciliada (PR E) ── */}
        {factura.contacto_id && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Proveedor recurrente</SectionLabel>
                {!isReadOnly && (
                  <button
                    onClick={handleCrearReglaDesdeFactura}
                    disabled={creandoRegla}
                    className="text-2xs inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-50"
                  >
                    {creandoRegla ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Plus size={11} />
                    )}
                    Crear regla desde esta factura
                  </button>
                )}
              </div>

              {reglaInfo && (
                <div className="bg-emerald-500/8 flex items-start gap-2 rounded-lg border border-emerald-500/15 px-3 py-2">
                  <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />
                  <p className="text-2xs leading-relaxed text-emerald-300/90">{reglaInfo}</p>
                </div>
              )}

              {/* Sugerencias de la regla */}
              {analisisRegla && analisisRegla.sugerencias.length > 0 && (
                <div className="space-y-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs uppercase tracking-widest text-zinc-500">
                      Sugerencias del proveedor
                    </span>
                    {!isReadOnly && analisisRegla.sugerencias.some((s) => !s.yaAplicado) && (
                      <button
                        onClick={aplicarTodasSugerencias}
                        className="text-2xs rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
                      >
                        Aplicar todo
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analisisRegla.sugerencias.map((s) => (
                      <button
                        key={s.campo}
                        onClick={() => aplicarSugerencia(s)}
                        disabled={isReadOnly || s.yaAplicado}
                        title={s.yaAplicado ? 'Ya aplicado' : 'Aplicar sugerencia'}
                        className={`text-2xs inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors ${
                          s.yaAplicado
                            ? 'cursor-default border-emerald-500/20 text-emerald-400/70'
                            : 'border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="text-zinc-500">{s.label}:</span> {fmtSugValor(s)}
                        {s.yaAplicado ? <Check size={10} /> : <Plus size={10} />}
                      </button>
                    ))}
                  </div>
                  {analisisRegla.partidaSugerida && (
                    <p className="text-2xs text-zinc-500">
                      Partida presupuestaria habitual sugerida — vincúlala desde la sección de
                      presupuesto.
                    </p>
                  )}
                  {analisisRegla.metodoPagoDefault && (
                    <p className="text-2xs text-zinc-500">
                      Método de pago habitual: {METODO_PAGO_LABEL[analisisRegla.metodoPagoDefault]}.
                    </p>
                  )}
                </div>
              )}

              {/* Aviso: requiere revisión de Javi (solo aviso en v1, no fuerza routing) */}
              {analisisRegla?.requiereJavi && (
                <div className="bg-amber-500/8 flex items-start gap-2.5 rounded-lg border border-amber-500/20 px-3 py-2.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                  <p className="text-2xs leading-relaxed text-amber-300/90">
                    Este proveedor requiere revisión de Javi según la regla del proveedor.
                  </p>
                </div>
              )}

              {/* Aviso: importe fuera de lo habitual */}
              {analisisRegla?.importeFueraRango && (
                <div className="bg-amber-500/8 flex items-start gap-2.5 rounded-lg border border-amber-500/20 px-3 py-2.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                  <p className="text-2xs leading-relaxed text-amber-300/90">
                    Importe fuera de lo habitual: {fmt(analisisRegla.importeFueraRango.actual)} vs
                    habitual {fmt(analisisRegla.importeFueraRango.habitual)} (tolerancia ±
                    {analisisRegla.importeFueraRango.toleranciaPct}%, desviación{' '}
                    {analisisRegla.importeFueraRango.desviacionPct}%).
                  </p>
                </div>
              )}

              {/* Toggle domiciliada (disponible aunque no haya regla) */}
              <label
                className={`flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 ${isReadOnly ? 'opacity-60' : 'cursor-pointer'}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-200">
                    <Cloud size={12} className="shrink-0 text-zinc-500" /> Factura domiciliada
                  </span>
                  <span className="text-2xs mt-0.5 block text-zinc-500">
                    Se carga en banco — no requiere transferencia manual.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.es_domiciliada}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    void handleToggleDomiciliada(e.target.checked);
                  }}
                  className="h-4 w-4 shrink-0 accent-zinc-200"
                />
              </label>

              {/* Sub-estado operativo de la domiciliada */}
              {form.es_domiciliada && subEstadoDomiciliada && (
                <div className="text-2xs flex items-start gap-2 px-1 text-zinc-500">
                  <Info size={11} className="mt-0.5 shrink-0 text-zinc-600" />
                  <span>
                    Estado operativo:{' '}
                    <span className="text-zinc-300">
                      {ESTADO_OPERATIVO_DOMICILIADA_LABEL[subEstadoDomiciliada]}
                    </span>
                    .
                    {subEstadoDomiciliada === 'pendiente_cargo' &&
                      ' Espera el cargo bancario; al aparecer, registra el pago con método “Domiciliación”.'}
                    {subEstadoDomiciliada === 'cargada_sin_justificante' &&
                      ' Adjunta el justificante del cargo bancario.'}
                  </span>
                </div>
              )}
            </div>

            <hr className="border-white/[0.06]" />
          </>
        )}

        {/* Factura */}
        <div className="space-y-4">
          <SectionLabel>Factura</SectionLabel>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <Field
              label="Nº factura"
              value={form.numero_factura}
              onChange={set('numero_factura')}
              disabled={isReadOnly}
            />
            <Field
              label="Fecha emisión"
              value={form.fecha_factura}
              onChange={set('fecha_factura')}
              type="date"
              required
              disabled={isReadOnly}
            />
            <Field
              label="Vencimiento"
              value={form.fecha_vencimiento}
              onChange={set('fecha_vencimiento')}
              type="date"
              disabled={isReadOnly}
            />
          </div>
          <Field
            label="Concepto"
            value={form.concepto}
            onChange={set('concepto')}
            disabled={isReadOnly}
          />
        </div>

        <hr className="border-white/[0.06]" />

        {/* Importes */}
        <div className="space-y-4">
          <SectionLabel>Importes</SectionLabel>

          {/* Tipo de operación */}
          <SelectField
            label="Tipo de operación"
            value={form.tipo_operacion}
            onChange={handleTipoOpChange}
            options={TIPOS_OPERACION.map((o) => ({ value: o.value, label: o.label }))}
            disabled={isReadOnly}
          />

          {/* Banner ISP */}
          {form.tipo_operacion === 'inversion_sujeto_pasivo' && (
            <div className="bg-amber-500/6 flex items-start gap-2.5 rounded-lg border border-amber-500/15 px-3 py-2.5">
              <Info size={12} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-amber-300">Inversión del sujeto pasivo</p>
                <p className="text-2xs leading-relaxed text-amber-400/70">
                  El proveedor no carga IVA en la factura. Tú debes auto-liquidarlo al {tivaNum}%
                  {ivaISPEfectivo !== null &&
                    ivaISPEfectivo > 0 &&
                    ` — importe: ${fmt(ivaISPEfectivo)}`}
                  . Se generan los apuntes 472 y 477 en el asiento.
                </p>
              </div>
            </div>
          )}

          {/* Banner Suplido */}
          {form.tipo_operacion === 'suplido' && (
            <div className="bg-zinc-500/6 flex items-start gap-2.5 rounded-lg border border-white/[0.06] px-3 py-2.5">
              <Info size={12} className="mt-0.5 shrink-0 text-zinc-500" />
              <p className="text-2xs leading-relaxed text-zinc-500">
                Suplido: gasto pagado por cuenta del cliente, no sujeto a IVA ni deducible como
                gasto propio.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <Field
              label="Base imponible"
              value={form.base_imponible}
              onChange={(v) => {
                set('base_imponible')(v);
                const b = parseFloat(v) || 0;
                const tiva = parseFloat(form.tipo_iva) || 0;
                const sinI = form.tipo_operacion !== 'normal';
                if (!sinI)
                  setForm((f) => ({
                    ...f,
                    base_imponible: v,
                    cuota_iva: String(+((b * tiva) / 100).toFixed(2)),
                  }));
              }}
              type="number"
              required
              disabled={isReadOnly}
            />

            <SelectField
              label="IVA %"
              value={form.tipo_iva}
              onChange={(v) => {
                const tiva = parseFloat(v) || 0;
                const b = parseFloat(form.base_imponible) || 0;
                const sinI = form.tipo_operacion !== 'normal';
                setForm((f) => ({
                  ...f,
                  tipo_iva: v,
                  cuota_iva: sinI ? '0' : String(+((b * tiva) / 100).toFixed(2)),
                }));
              }}
              options={TIPOS_IVA}
              disabled={isReadOnly}
            />

            <Field
              label="Cuota IVA"
              value={form.cuota_iva}
              onChange={set('cuota_iva')}
              type="number"
              disabled={
                isReadOnly ||
                form.tipo_operacion === 'inversion_sujeto_pasivo' ||
                form.tipo_operacion === 'exenta' ||
                form.tipo_operacion === 'no_sujeta' ||
                form.tipo_operacion === 'suplido'
              }
            />

            <Field
              label="Retención %"
              value={form.retencion_pct}
              onChange={(v) => {
                const rpct = parseFloat(v) || 0;
                set('retencion_pct')(v);
                set('retencion_importe')(String(+((base * rpct) / 100).toFixed(2)));
              }}
              type="number"
              disabled={isReadOnly}
            />
            <Field
              label="Retención €"
              value={form.retencion_importe}
              onChange={set('retencion_importe')}
              type="number"
              disabled={isReadOnly}
            />
            <Field
              label="Total factura"
              value={form.total}
              onChange={set('total')}
              type="number"
              required
              disabled={isReadOnly}
            />
          </div>

          {/* Total a pagar */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-2xs uppercase tracking-widest text-zinc-500">Total a pagar</span>
            <span className="text-sm font-semibold tabular-nums text-white">{fmt(totalPagar)}</span>
          </div>
        </div>

        <hr className="border-white/[0.06]" />

        {/* Asiento contable */}
        <div className="space-y-4">
          <SectionLabel>Asiento contable</SectionLabel>

          <SelectField
            label="Cuenta de gasto"
            value={form.cuenta_gasto}
            onChange={set('cuenta_gasto')}
            options={CUENTAS_GASTO.map((cc) => ({
              value: cc.codigo,
              label: `${cc.codigo} — ${cc.descripcion}`,
            }))}
            disabled={isReadOnly}
            hint={form.cuenta_gasto === sugerida ? 'sugerida por OCR' : undefined}
            searchable
          />

          {/* Tabla minimal */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-2xs pb-2 text-left font-normal uppercase tracking-widest text-zinc-600">
                  Cuenta
                </th>
                <th className="text-2xs w-20 pb-2 text-right font-normal uppercase tracking-widest text-zinc-600">
                  Debe
                </th>
                <th className="text-2xs w-20 pb-2 text-right font-normal uppercase tracking-widest text-zinc-600">
                  Haber
                </th>
              </tr>
            </thead>
            <tbody>
              {asientoLineas.map((l, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2.5">
                    <span className="font-mono text-xs text-zinc-300">{l.cuenta_codigo}</span>
                    <span className="ml-2 text-zinc-500">{l.cuenta_descripcion}</span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-zinc-300">
                    {l.debe > 0 ? fmt(l.debe) : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="py-2.5 text-right font-mono text-zinc-500">
                    {l.haber > 0 ? fmt(l.haber) : <span className="text-zinc-700">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isReadOnly && (
            <p className="text-2xs text-zinc-700">
              Se creará en Diario Borrador al dar visto bueno.
            </p>
          )}
        </div>

        <hr className="border-white/[0.06]" />

        {/* Vinculación a presupuesto */}
        <div className="space-y-3">
          <SectionLabel>Presupuesto</SectionLabel>

          {(partidaVinculada ?? factura.presupuesto_pago_id) ? (
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/8 flex flex-1 items-center gap-2 rounded-lg border border-blue-500/15 px-3 py-2.5">
                <Link2 size={12} className="shrink-0 text-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-blue-300">
                    {partidaVinculada
                      ? `${partidaVinculada.presupuesto_nombre} · ${partidaVinculada.descripcion}`
                      : 'Vinculada a partida de presupuesto'}
                  </p>
                  {partidaVinculada && (
                    <p className="text-2xs text-blue-400/60">{partidaVinculada.capitulo_nombre}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => void handleDesvincular()}
                className="rounded-md p-2 text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                title="Desvincular y eliminar pago creado"
              >
                <Unlink size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowVincular(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.1] py-2.5 text-xs font-medium text-zinc-500 transition-all hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-400"
            >
              <Link2 size={12} /> Enfrentar a partida de presupuesto
            </button>
          )}

          {/* Modal búsqueda de partidas */}
          {showVincular &&
            createPortal(
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                    <Link2 size={15} className="shrink-0 text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        Enfrentar a partida de presupuesto
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {factura.proveedor_nombre} · {fmt(factura.total_a_pagar)}
                        {' · '}Se creará un pago en la partida seleccionada
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowVincular(false);
                        setQueryPartidas('');
                        setExpandedGroups(new Set());
                      }}
                      className="p-1 text-zinc-600 transition-colors hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="border-b border-white/[0.04] px-4 py-3">
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <input
                        type="text"
                        placeholder="Buscar partida, presupuesto o proyecto..."
                        value={queryPartidas}
                        onChange={(e) => setQueryPartidas(e.target.value)}
                        className="w-full rounded-xl border border-white/[0.06] bg-zinc-800/60 py-2 pl-8 pr-4 text-sm text-zinc-200 transition-all placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {loadingPartidas ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 size={18} className="animate-spin text-blue-400" />
                      </div>
                    ) : partidasFiltered.length === 0 ? (
                      <div className="py-10 text-center text-sm text-zinc-600">
                        Sin partidas disponibles
                      </div>
                    ) : (
                      grouped.map((group) => (
                        <div key={group.key} className="border-b border-white/[0.04] last:border-0">
                          {/* Capítulo header */}
                          <button
                            onClick={() =>
                              setExpandedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.key)) next.delete(group.key);
                                else next.add(group.key);
                                return next;
                              })
                            }
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                          >
                            <ChevronDown
                              size={12}
                              className={`shrink-0 text-zinc-500 transition-transform duration-150 ${expandedGroups.has(group.key) ? '' : '-rotate-90'}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-zinc-200">
                                {group.capitulo}
                              </p>
                              <p className="text-2xs truncate text-zinc-600">
                                {group.presupuesto} · {group.partidas.length} partida
                                {group.partidas.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </button>
                          {/* Partidas expandidas */}
                          {expandedGroups.has(group.key) && (
                            <div className="border-t border-white/[0.04]">
                              {group.partidas.map((p) => (
                                <button
                                  key={p.id}
                                  disabled={vincularando}
                                  onClick={() => void handleVincularPartida(p)}
                                  className="flex w-full cursor-pointer items-center gap-3 border-b border-white/[0.03] py-3 pl-11 pr-5 text-left transition-colors last:border-0 hover:border-blue-500/10 hover:bg-blue-500/5 disabled:opacity-50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-zinc-200">
                                      {p.descripcion}
                                    </p>
                                    {p.proveedor_esperado && (
                                      <p className="text-2xs truncate text-zinc-600">
                                        {p.proveedor_esperado}
                                      </p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold text-white">
                                      {fmt(p.importe_presupuestado)}
                                    </p>
                                    {p.tipo_iva > 0 && (
                                      <p className="text-2xs text-amber-400/70">
                                        IVA {p.tipo_iva}%
                                      </p>
                                    )}
                                  </div>
                                  {vincularando ? (
                                    <Loader2
                                      size={13}
                                      className="shrink-0 animate-spin text-blue-400"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={13}
                                      className="shrink-0 -rotate-90 text-zinc-600"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>

        <hr className="border-white/[0.06]" />

        {/* Notas */}
        <div className="space-y-3">
          <SectionLabel>Notas internas</SectionLabel>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas')(e.target.value)}
            disabled={isReadOnly}
            rows={2}
            className="w-full resize-none rounded-md bg-transparent px-2 py-1.5 text-sm text-white transition-all placeholder:text-zinc-700 hover:bg-white/[0.02] focus:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-40"
            placeholder="Observaciones, instrucciones de pago…"
          />
        </div>

        {/* Motivo de rechazo */}
        {factura.estado === 'rechazada' &&
          factura.notas &&
          factura.notas.includes('[RECHAZADA') && (
            <>
              <hr className="border-white/[0.06]" />
              <div className="space-y-2">
                <p className="text-2xs uppercase tracking-widest text-rose-500/60">
                  Motivo del rechazo
                </p>
                <p className="text-sm leading-relaxed text-rose-300/80">
                  {factura.notas
                    .split('\n')
                    .find((l) => l.startsWith('[RECHAZADA'))
                    ?.replace(/\[RECHAZADA en [^\]]+\]\s*/, '') ?? '—'}
                </p>
              </div>
            </>
          )}

        {/* Pagos (libro de tesorería) */}
        {mostrarPagos && (
          <div className="space-y-3">
            <SectionLabel>Pagos</SectionLabel>
            <PagosSection
              resumen={resumenPago}
              pagos={pagos}
              incidencias={incidencias}
              isPrivateMode={isPrivateMode}
              puedeRegistrar={puedeRegistrarPago}
              soloRegularizacion={soloRegularizacion}
              puedeResolver={test || rol === 'guille' || rol === 'alicia'}
              showForm={showPagoForm}
              registrando={registrandoPago}
              onToggleForm={setShowPagoForm}
              onSubmit={(a) => {
                void handleRegistrarPago(a);
              }}
              onAbrirJustificante={(p) => {
                void handleAbrirJustificante(p);
              }}
              onResolverIncidencia={(id) => {
                void handleResolverIncidencia(id);
              }}
            />
          </div>
        )}

        {/* Archivo en Google Drive (PR D) */}
        {(factura.estado === 'pagada' ||
          factura.drive_estado !== 'no_archivado' ||
          hayDocsDrive) && (
          <div className="space-y-3">
            <SectionLabel>Archivo en Drive</SectionLabel>
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <Cloud
                size={16}
                className={
                  factura.drive_estado === 'sincronizado'
                    ? 'text-emerald-400'
                    : factura.drive_estado === 'error'
                      ? 'text-rose-400'
                      : 'text-zinc-500'
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200">
                  {archivandoDrive
                    ? 'Archivando…'
                    : !hayDocsDrive
                      ? 'Sin documentos para archivar'
                      : DRIVE_ESTADO_LABEL[factura.drive_estado]}
                </p>
                {factura.drive_estado === 'error' && factura.drive_error ? (
                  <p className="text-2xs truncate text-rose-400/80">{factura.drive_error}</p>
                ) : (
                  <p className="text-2xs text-zinc-600">
                    Copia documental (factura + justificantes). El original sigue en la app.
                  </p>
                )}
              </div>
              {factura.drive_folder_id && (
                <button
                  onClick={() =>
                    window.open(
                      `https://drive.google.com/drive/folders/${factura.drive_folder_id}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                  title="Abrir expediente en Drive"
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-blue-400"
                >
                  <ExternalLink size={14} />
                </button>
              )}
              {hayDocsDrive && (
                <button
                  onClick={() => {
                    void handleArchivarDrive();
                  }}
                  disabled={archivandoDrive}
                  className="text-2xs flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 font-medium text-zinc-300 transition-colors hover:border-white/20 disabled:opacity-50"
                >
                  {archivandoDrive ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Cloud size={12} />
                  )}
                  {factura.drive_estado === 'error'
                    ? 'Reintentar'
                    : factura.drive_estado === 'sincronizado'
                      ? 'Re-archivar'
                      : 'Enviar a Drive'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trazabilidad (auditoría) */}
        <div className="space-y-3">
          <SectionLabel>Trazabilidad</SectionLabel>
          <Timeline factura={factura} aprobaciones={aprobaciones} />
        </div>

        <div className="h-2" />
      </div>

      {/* ── Actions bar ── */}
      {!isReadOnly && (
        <div className="shrink-0 border-t border-white/[0.06] bg-zinc-900 px-5 py-4">
          {rechazando ? (
            <div className="space-y-3">
              <p className="text-2xs uppercase tracking-widest text-zinc-500">Motivo del rechazo</p>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                autoFocus
                rows={2}
                placeholder="Describe el motivo…"
                className="w-full resize-none rounded-lg border border-rose-500/20 bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRechazando(false);
                    setMotivoRechazo('');
                  }}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-zinc-500 transition-all hover:border-white/15 hover:text-zinc-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    void handleConfirmarRechazo();
                  }}
                  disabled={saving || !motivoRechazo.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600/80 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Confirmar rechazo
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {puedeRechazar && (
                <button
                  onClick={() => setRechazando(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-500 transition-all hover:border-rose-500/20 hover:text-rose-400"
                >
                  <XCircle size={12} />
                  Rechazar
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                {puedeAprobar && (
                  <button
                    onClick={() => {
                      void handleAprobar();
                    }}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    {labelAprobar}
                  </button>
                )}
                {puedePagar && (
                  <button
                    onClick={() => {
                      void handlePagar();
                    }}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    Marcar como pagada
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
