import { describe, it, expect } from 'vitest';
import { resolveDocumentoSource } from '../documentoUrl';

// Fuente del documento de proyecto. Prioridad: storage_path (bucket privado →
// signed URL) > archivo_url (legado público) > nada. Espejo de lo que consume el
// visor (TabDocumentos) tras privatizar el bucket.

describe('resolveDocumentoSource', () => {
  it('con storage_path → fuente firmada', () => {
    expect(resolveDocumentoSource({ storage_path: 'P-X/123-doc.pdf', archivo_url: '' }))
      .toEqual({ kind: 'signed', path: 'P-X/123-doc.pdf' });
  });

  it('storage_path tiene prioridad sobre archivo_url legado', () => {
    expect(resolveDocumentoSource({
      storage_path: 'P-X/123-doc.pdf',
      archivo_url: 'https://x/object/public/proyecto-documentos/old.pdf',
    })).toEqual({ kind: 'signed', path: 'P-X/123-doc.pdf' });
  });

  it('solo archivo_url (legado) → fallback directo', () => {
    expect(resolveDocumentoSource({ storage_path: '', archivo_url: 'https://x/old.pdf' }))
      .toEqual({ kind: 'legacy', url: 'https://x/old.pdf' });
  });

  it('sin storage_path ni archivo_url → none', () => {
    expect(resolveDocumentoSource({ storage_path: '', archivo_url: '' }))
      .toEqual({ kind: 'none' });
  });
});
