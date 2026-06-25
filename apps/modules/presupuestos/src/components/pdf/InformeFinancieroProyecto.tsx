// Documento PDF del informe financiero (@react-pdf/renderer).
// Estética "dossier de inversión": portada oscura a página completa con el logo
// de Alsari como protagonista, interiores editoriales claros con cabecera/pie
// discretos. Solo pinta el modelo `InformeFinanciero` (no calcula nada). Sin
// glifos Unicode problemáticos: estados como texto, viñetas como puntos dibujados.
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import type { InformeFinanciero, Fila, Seccion, EscenarioCol } from '../../lib/exportProyectoFinanciero';
import { LOGO_ALSARI } from '../../lib/logoAlsari';

// Sin partición de palabras a mitad ("AC-TUAL"): un documento financiero no
// debe hifenar. Las palabras saltan de línea completas.
Font.registerHyphenationCallback((word) => [word]);

// Paleta: portada antracita + marfil; interiores cálidos claros; acentos sobrios.
const C = {
  dark: '#0d0d10',        // antracita portada/cabeceras
  darkBand: '#15151a',    // banda de cabecera interior
  ivory: '#F5F0E1',       // marfil de marca
  ivoryDim: '#b9b3a3',    // marfil atenuado
  ink: '#1b1b1f',         // texto principal interior
  soft: '#55555f',        // texto secundario
  faint: '#9a978f',       // hints
  line: '#e7e3da',        // líneas finas cálidas
  card: '#f7f5f0',        // fondo de tarjetas/bloques
  cardLine: '#e6e1d6',
  paper: '#ffffff',
  verde: '#1f7a4d', verdeBg: '#eef6f0',
  ambar: '#9a6512', ambarBg: '#f8f1e6',
  rojo: '#9f3a3a', rojoBg: '#f8eeee',
  azul: '#2b4a6f',
};

const s = StyleSheet.create({
  // Páginas
  cover: { backgroundColor: C.dark, color: C.ivory, fontFamily: 'Helvetica' },
  page: { paddingTop: 50, paddingBottom: 46, paddingHorizontal: 54, fontSize: 9, color: C.ink, fontFamily: 'Helvetica', backgroundColor: C.paper },

  // ── Portada ──────────────────────────────────────────────
  coverFrame: { flex: 1, paddingHorizontal: 64, paddingTop: 150, paddingBottom: 52 },
  coverHair: { width: 46, height: 2, backgroundColor: C.ivory, opacity: 0.55, marginBottom: 26, alignSelf: 'center' },
  coverLogo: { width: 250, height: 64, objectFit: 'contain', alignSelf: 'center', marginBottom: 64 },
  coverTitle: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: C.ivory, textAlign: 'center', letterSpacing: 0.3 },
  coverSubtitle: { fontSize: 12, color: C.ivoryDim, textAlign: 'center', letterSpacing: 3, marginTop: 12, textTransform: 'uppercase' },
  coverMetaWrap: { marginTop: 30, alignItems: 'center' },
  coverMeta: { fontSize: 11, color: C.ivory, textAlign: 'center', marginBottom: 3 },
  coverSpacer: { flex: 1 },
  coverFootWrap: { borderTopWidth: 0.7, borderTopColor: 'rgba(245,240,225,0.18)', paddingTop: 14, alignItems: 'center' },
  coverSociedad: { fontSize: 10, color: C.ivory, marginBottom: 6, letterSpacing: 0.5 },
  coverNote: { fontSize: 8.5, color: C.ivoryDim, textAlign: 'center' },
  coverBrandTiny: { fontSize: 7, color: 'rgba(245,240,225,0.45)', letterSpacing: 1.5, marginTop: 10, textTransform: 'uppercase' },

  // ── Cabecera / pie interiores ────────────────────────────
  hdrBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 30, backgroundColor: C.darkBand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 54 },
  hdrLogo: { width: 74, height: 19, objectFit: 'contain' },
  hdrProj: { fontSize: 8, color: C.ivoryDim, letterSpacing: 0.5 },
  ftr: { position: 'absolute', bottom: 22, left: 54, right: 54, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 6, fontSize: 7.5, color: C.faint },

  // ── Secciones ────────────────────────────────────────────
  secWrap: { marginTop: 17, marginBottom: 3 },
  secKicker: { fontSize: 7.5, color: C.faint, letterSpacing: 2, textTransform: 'uppercase' },
  secTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 2 },
  secRule: { height: 1.4, backgroundColor: C.ink, width: 30, marginTop: 6 },
  lead: { fontSize: 8.5, color: C.soft, marginTop: 6, marginBottom: 2, lineHeight: 1.45 },

  // ── Veredicto ────────────────────────────────────────────
  verCard: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 5, padding: 13, marginTop: 9 },
  verLabel: { fontSize: 7.5, color: C.faint, letterSpacing: 1.5, textTransform: 'uppercase' },
  verTipo: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 5 },
  verMotivo: { fontSize: 9.5, color: C.ink, lineHeight: 1.5, marginBottom: 6 },
  bulletLine: { flexDirection: 'row', marginBottom: 2.5, alignItems: 'flex-start' },
  bulletDot: { width: 2.6, height: 2.6, borderRadius: 1.3, marginTop: 4, marginRight: 6 },
  bulletTxt: { flex: 1, color: C.soft, fontSize: 9, lineHeight: 1.4 },
  verNota: { fontSize: 7.5, color: C.faint, marginTop: 6, fontStyle: 'italic' },

  // ── Grid de KPIs (tarjetas) ──────────────────────────────
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
  kpiCard: { width: '33.33%', paddingHorizontal: 4, marginBottom: 8 },
  kpiInner: { backgroundColor: C.card, borderWidth: 0.8, borderColor: C.cardLine, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 10, height: 50, justifyContent: 'center' },
  kpiLabel: { fontSize: 7, color: C.faint, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink },

  // ── Bloques de datos (cards) ─────────────────────────────
  block: { backgroundColor: C.card, borderWidth: 0.8, borderColor: C.cardLine, borderRadius: 4, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 4, marginBottom: 8 },
  blockTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.azul, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  dRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: C.cardLine, paddingVertical: 2.8 },
  dRowLast: { borderBottomWidth: 0 },
  dLabel: { fontSize: 8.5, color: C.soft, flex: 1, paddingRight: 10 },
  dValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },

  // ── Tabla limpia (KPIs calculados / supuestos / desglose) ─
  tRow: { flexDirection: 'row', paddingVertical: 3.2, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  tRowAlt: { backgroundColor: '#faf9f5' },
  tLabel: { flex: 1, color: C.soft, fontSize: 9, paddingRight: 10 },
  tValue: { width: 160, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.ink, fontSize: 9 },

  // ── Explotar vs liquidar ─────────────────────────────────
  elBox: { borderWidth: 1, borderRadius: 5, padding: 13, marginTop: 9 },
  elTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 },
  elEstado: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  elMetrics: { flexDirection: 'row' },
  elMetric: { marginLeft: 18, alignItems: 'flex-end' },
  elMetricLabel: { fontSize: 6.5, color: C.faint, letterSpacing: 0.5, textTransform: 'uppercase' },
  elMetricValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink },
  elMsg: { fontSize: 9, color: C.ink, lineHeight: 1.45 },
  elNota: { fontSize: 7.5, color: C.faint, marginTop: 6, fontStyle: 'italic' },

  // ── Escenarios ───────────────────────────────────────────
  escHead: { flexDirection: 'row', backgroundColor: C.dark, paddingVertical: 6, paddingHorizontal: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  escHM: { flex: 1.5, color: C.ivoryDim, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  escHC: { flex: 1, textAlign: 'right', color: C.ivory, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  escHCbase: { flex: 1, textAlign: 'right', color: C.ivory, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  escRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: C.line },
  escM: { flex: 1.5, color: C.soft, fontSize: 8.5 },
  escC: { flex: 1, textAlign: 'right', fontSize: 8.5, color: C.ink },
  escCbase: { flex: 1, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink },
  escBaseCol: { backgroundColor: '#f4f2ec' },

  // ── Calidad del dato ─────────────────────────────────────
  calBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 11, marginTop: 8, marginBottom: 4 },
  calBadgeTxt: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  calGroup: { marginTop: 7 },
  calGroupTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  calGroupItems: { fontSize: 8.5, color: C.soft, lineHeight: 1.5 },

  // ── Alertas ──────────────────────────────────────────────
  alGroup: { marginTop: 8 },
  alTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },

  // ── Anexo ────────────────────────────────────────────────
  fxRow: { marginBottom: 7 },
  fxName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  fxBody: { fontSize: 8.5, color: C.soft, marginTop: 1, lineHeight: 1.4 },
});

const verColor = (t: string) => (t === 'Atractivo' ? C.verde : t === 'Defensivo' ? C.azul : t === 'Agresivo' ? C.ambar : C.rojo);
const verBg = (t: string) => (t === 'Atractivo' ? C.verdeBg : t === 'Defensivo' ? '#eef1f5' : t === 'Agresivo' ? C.ambarBg : C.rojoBg);
const nivelColor = (n: string) => (n === 'Alta' ? C.verde : n === 'Media' ? C.ambar : C.rojo);
const nivelBg = (n: string) => (n === 'Alta' ? C.verdeBg : n === 'Media' ? C.ambarBg : C.rojoBg);
const elColor = (n: string) => (n === 'explotar' ? C.verde : n === 'neutral' ? C.ambar : C.rojo);
const elBg = (n: string) => (n === 'explotar' ? C.verdeBg : n === 'neutral' ? C.ambarBg : C.rojoBg);

// Reparte alertas en "supuestos por defecto" vs "limitaciones" (presentacional).
const RE_SUPUESTO = /no informad|se asume|se usan|se usa|no aplicada|antes de impuestos|por defecto|como estimación/i;

function SectionTitle({ kicker, titulo }: { kicker?: string; titulo: string }) {
  return (
    <View style={s.secWrap}>
      {kicker ? <Text style={s.secKicker}>{kicker}</Text> : null}
      <Text style={s.secTitle}>{titulo}</Text>
      <View style={s.secRule} />
    </View>
  );
}

function Bullet({ texto, color }: { texto: string; color: string }) {
  return (
    <View style={s.bulletLine}>
      <View style={[s.bulletDot, { backgroundColor: color }]} />
      <Text style={s.bulletTxt}>{texto}</Text>
    </View>
  );
}

function KpiGrid({ filas }: { filas: Fila[] }) {
  return (
    <View style={s.kpiGrid}>
      {filas.map((f, i) => (
        <View key={i} style={s.kpiCard} wrap={false}>
          <View style={s.kpiInner}>
            <Text style={s.kpiLabel}>{f.label}</Text>
            <Text style={s.kpiValue}>{f.valor}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DataBlock({ sec }: { sec: Seccion }) {
  return (
    <View style={s.block} wrap={false}>
      <Text style={s.blockTitle}>{sec.titulo}</Text>
      {sec.filas.map((f, i) => (
        <View key={i} style={i === sec.filas.length - 1 ? [s.dRow, s.dRowLast] : s.dRow}>
          <Text style={s.dLabel}>{f.label}</Text>
          <Text style={s.dValue}>{f.valor}</Text>
        </View>
      ))}
    </View>
  );
}

function CleanTable({ filas }: { filas: Fila[] }) {
  return (
    <View>
      {filas.map((f, i) => (
        <View key={i} style={i % 2 === 1 ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
          <Text style={s.tLabel}>{f.label}</Text>
          <Text style={s.tValue}>{f.valor}</Text>
        </View>
      ))}
    </View>
  );
}

function Escenarios({ cols }: { cols: EscenarioCol[] }) {
  if (cols.length === 0) return null;
  return (
    <View wrap={false}>
      <View style={s.escHead}>
        <Text style={s.escHM}>Métrica</Text>
        <Text style={s.escHC}>Pesimista</Text>
        <Text style={s.escHCbase}>Base</Text>
        <Text style={s.escHC}>Optimista</Text>
      </View>
      {cols.map((c, i) => (
        <View key={i} style={s.escRow}>
          <Text style={s.escM}>{c.metrica}</Text>
          <Text style={s.escC}>{c.pesimista}</Text>
          <Text style={[s.escCbase, s.escBaseCol]}>{c.base}</Text>
          <Text style={s.escC}>{c.optimista}</Text>
        </View>
      ))}
    </View>
  );
}

function Header({ r }: { r: InformeFinanciero }) {
  return (
    <View style={s.hdrBand} fixed>
      <Image style={s.hdrLogo} src={LOGO_ALSARI} />
      <Text style={s.hdrProj}>{r.nombreProyecto} · {r.tipoLabel}</Text>
    </View>
  );
}

function Footer({ r }: { r: InformeFinanciero }) {
  return (
    <View style={s.ftr} fixed>
      <Text>Informe financiero · {r.fechaGeneracion}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function InformeFinancieroProyecto({ informe: r }: { informe: InformeFinanciero }) {
  const vc = verColor(r.veredictoTipo);
  const supuestos = r.alertas.filter((a) => RE_SUPUESTO.test(a));
  const limitaciones = r.alertas.filter((a) => !RE_SUPUESTO.test(a));

  const completos = r.calidadCampos.filter((c) => c.estado === 'completo');
  const estimados = r.calidadCampos.filter((c) => c.estado === 'estimado');
  const faltantes = r.calidadCampos.filter((c) => c.estado === 'faltante');

  return (
    <Document title={`Informe financiero — ${r.nombreProyecto}`} author="Alsari Capital">
      {/* ── Portada (página completa, oscura) ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverFrame}>
          <View style={s.coverHair} />
          <Image style={s.coverLogo} src={LOGO_ALSARI} />
          <Text style={s.coverTitle}>{r.nombreProyecto}</Text>
          <Text style={s.coverSubtitle}>Informe financiero</Text>
          <View style={s.coverMetaWrap}>
            <Text style={s.coverMeta}>{r.tipoLabel}</Text>
            <Text style={s.coverMeta}>{r.fechaGeneracion}</Text>
          </View>

          <View style={s.coverSpacer} />

          <View style={s.coverFootWrap}>
            {r.sociedad ? <Text style={s.coverSociedad}>Sociedad tenedora · {r.sociedad}</Text> : null}
            <Text style={s.coverNote}>Informe interno basado en datos introducidos por el usuario.</Text>
            <Text style={s.coverBrandTiny}>Generado desde Alsari Capital OS</Text>
          </View>
        </View>
      </Page>

      {/* ── Interior ── */}
      <Page size="A4" style={s.page}>
        <Header r={r} />

        {/* Resumen ejecutivo */}
        <SectionTitle kicker="01" titulo="Resumen ejecutivo" />
        <View style={[s.verCard, { borderColor: vc, borderLeftColor: vc, backgroundColor: verBg(r.veredictoTipo) }]} wrap={false}>
          <Text style={s.verLabel}>Veredicto</Text>
          <Text style={[s.verTipo, { color: vc }]}>{r.veredictoTipo}</Text>
          <Text style={s.verMotivo}>{r.veredictoMotivo}</Text>
          {r.veredictoBullets.map((b, i) => <Bullet key={i} texto={b} color={vc} />)}
          <Text style={s.verNota}>Ayuda interna de análisis; no es una recomendación de inversión definitiva.</Text>
        </View>

        <Text style={s.lead}>Indicadores principales</Text>
        <KpiGrid filas={r.kpisResumen} />

        {/* Explotar vs liquidar (renta) */}
        {r.explotarLiquidar ? (
          <View wrap={false}>
            <SectionTitle kicker="02" titulo="Explotar vs liquidar" />
            <View style={[s.elBox, { borderColor: elColor(r.explotarLiquidar.nivel), backgroundColor: elBg(r.explotarLiquidar.nivel) }]}>
              <View style={s.elTop}>
                <Text style={[s.elEstado, { color: elColor(r.explotarLiquidar.nivel) }]}>{r.explotarLiquidar.titulo}</Text>
                <View style={s.elMetrics}>
                  <View style={s.elMetric}>
                    <Text style={s.elMetricLabel}>Rentab. neta s/ valor actual</Text>
                    <Text style={s.elMetricValue}>{r.explotarLiquidar.rentaValor}</Text>
                  </View>
                  <View style={s.elMetric}>
                    <Text style={s.elMetricLabel}>Tasa exigida</Text>
                    <Text style={s.elMetricValue}>{r.explotarLiquidar.tasaValor}</Text>
                  </View>
                </View>
              </View>
              <Text style={s.elMsg}>{r.explotarLiquidar.mensaje}</Text>
              <Text style={s.elNota}>{r.explotarLiquidar.nota}</Text>
            </View>
          </View>
        ) : null}

        {/* Datos introducidos */}
        <SectionTitle kicker={r.explotarLiquidar ? '03' : '02'} titulo="Datos introducidos" />
        <Text style={s.lead}>Inputs facilitados por el usuario. Los campos sin informar aparecen como "No informado".</Text>
        {r.datosIntroducidos.map((sec, i) => <DataBlock key={i} sec={sec} />)}

        {/* KPIs calculados */}
        <SectionTitle kicker={r.explotarLiquidar ? '04' : '03'} titulo="KPIs calculados" />
        <Text style={s.lead}>Resultados estimados por la aplicación a partir de los datos anteriores.</Text>
        <CleanTable filas={r.kpisCalculados} />

        {/* Escenarios */}
        <SectionTitle kicker={r.explotarLiquidar ? '05' : '04'} titulo="Escenarios" />
        <Escenarios cols={r.escenarios} />

        {/* Desglose */}
        {r.desglose.length > 0 ? (
          <>
            <SectionTitle kicker={r.explotarLiquidar ? '06' : '05'} titulo="Desglose financiero" />
            {r.desglose.map((sec, i) => (
              <View key={i} wrap={false}>
                {sec.titulo ? <Text style={s.lead}>{sec.titulo}</Text> : null}
                <CleanTable filas={sec.filas} />
              </View>
            ))}
          </>
        ) : null}

        {/* Supuestos */}
        <SectionTitle titulo="Supuestos" />
        <CleanTable filas={r.supuestos} />

        {/* Calidad del dato */}
        <SectionTitle titulo="Calidad del dato" />
        <View style={[s.calBadge, { backgroundColor: nivelBg(r.calidadNivel) }]}>
          <Text style={[s.calBadgeTxt, { color: nivelColor(r.calidadNivel) }]}>{r.calidadScore}% · Calidad {r.calidadNivel}</Text>
        </View>
        {completos.length > 0 ? (
          <View style={s.calGroup} wrap={false}>
            <Text style={[s.calGroupTitle, { color: C.verde }]}>Completos</Text>
            <Text style={s.calGroupItems}>{completos.map((c) => c.label).join('  ·  ')}</Text>
          </View>
        ) : null}
        {estimados.length > 0 ? (
          <View style={s.calGroup} wrap={false}>
            <Text style={[s.calGroupTitle, { color: C.ambar }]}>Estimados</Text>
            <Text style={s.calGroupItems}>{estimados.map((c) => c.label).join('  ·  ')}</Text>
          </View>
        ) : null}
        {faltantes.length > 0 ? (
          <View style={s.calGroup} wrap={false}>
            <Text style={[s.calGroupTitle, { color: C.rojo }]}>Faltantes</Text>
            <Text style={s.calGroupItems}>{faltantes.map((c) => c.label + (c.critico ? ' (clave)' : '')).join('  ·  ')}</Text>
          </View>
        ) : null}

        {/* Alertas y limitaciones */}
        <SectionTitle titulo="Alertas y limitaciones" />
        {supuestos.length > 0 ? (
          <View style={s.alGroup} wrap={false}>
            <Text style={s.alTitle}>Supuestos por defecto</Text>
            {supuestos.map((a, i) => <Bullet key={i} texto={a} color={C.ambar} />)}
          </View>
        ) : null}
        <View style={s.alGroup} wrap={false}>
          <Text style={s.alTitle}>Limitaciones</Text>
          {limitaciones.map((a, i) => <Bullet key={i} texto={a} color={C.faint} />)}
        </View>

        {/* Anexo */}
        <SectionTitle titulo="Anexo de cálculo" />
        {r.formulas.map((fm, i) => (
          <View key={i} style={s.fxRow} wrap={false}>
            <Text style={s.fxName}>{fm.nombre}</Text>
            <Text style={s.fxBody}>{fm.formula}</Text>
          </View>
        ))}

        <Footer r={r} />
      </Page>
    </Document>
  );
}
