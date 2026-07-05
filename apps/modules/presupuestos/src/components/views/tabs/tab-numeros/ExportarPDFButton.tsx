// Botón "Exportar PDF" para la pestaña Números.
// Genera el informe financiero bajo demanda y 100% en cliente. La librería de PDF
// (@react-pdf/renderer) y el documento se cargan con import() dinámico SOLO al
// pulsar, para no engordar la carga inicial. No usa servidor ni Storage.
import { useState, createElement } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { AnalisisFinanciero } from '../../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../../lib/proyectosApi';
import { construirInforme, nombreArchivoInforme } from '../../../../lib/exportProyectoFinanciero';

type Props = { analisis: AnalisisFinanciero; proyecto: ProyectoRow };

export function ExportarPDFButton({ analisis, proyecto }: Props) {
  const [estado, setEstado] = useState<'idle' | 'generando' | 'error'>('idle');

  async function exportar() {
    setEstado('generando');
    try {
      // Carga perezosa: la librería pesada solo entra cuando el usuario exporta.
      const [{ pdf }, { InformeFinancieroProyecto }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../../pdf/InformeFinancieroProyecto'),
      ]);
      const informe = construirInforme(analisis, proyecto);
      const elemento = createElement(InformeFinancieroProyecto, {
        informe,
      }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(elemento).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivoInforme(proyecto);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setEstado('idle');
    } catch (e) {
      console.error('Error generando el PDF', e);
      setEstado('error');
      setTimeout(() => setEstado('idle'), 4000);
    }
  }

  return (
    <button
      onClick={() => void exportar()}
      disabled={estado === 'generando'}
      title="Descargar informe financiero en PDF"
      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {estado === 'generando' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <FileDown size={12} />
      )}
      {estado === 'generando'
        ? 'Generando…'
        : estado === 'error'
          ? 'Error — reintentar'
          : 'Exportar PDF'}
    </button>
  );
}
