import { describe, it, expect } from 'vitest';
import { resolveFacturaPdfSource } from '../facturaPdf';

// Decisión de fuente del PDF de una factura. Prioridad: storage_path (bucket
// privado → signed URL) > archivo_url (legado público) > nada. Espejo de lo que
// consumen el visor (FacturaModal) y el botón "abrir" (FacturaReviewPanel).

describe('resolveFacturaPdfSource', () => {
  it('con storage_path → fuente firmada (signed)', () => {
    expect(resolveFacturaPdfSource({ storage_path: 'recibidas/abc/f.pdf', archivo_url: null }))
      .toEqual({ kind: 'signed', path: 'recibidas/abc/f.pdf' });
  });

  it('storage_path tiene prioridad sobre archivo_url legado', () => {
    expect(resolveFacturaPdfSource({
      storage_path: 'recibidas/abc/f.pdf',
      archivo_url: 'https://x/object/public/facturas/old.pdf',
    })).toEqual({ kind: 'signed', path: 'recibidas/abc/f.pdf' });
  });

  it('solo archivo_url (legado) → fallback directo (legacy)', () => {
    expect(resolveFacturaPdfSource({ storage_path: null, archivo_url: 'https://x/old.pdf' }))
      .toEqual({ kind: 'legacy', url: 'https://x/old.pdf' });
  });

  it('sin storage_path ni archivo_url → none', () => {
    expect(resolveFacturaPdfSource({ storage_path: null, archivo_url: null }))
      .toEqual({ kind: 'none' });
  });
});
