// Supabase Edge Function: procesar-factura
// Recibe un PDF o imagen de factura, extrae datos con Claude Vision,
// detecta automáticamente la sociedad receptora y crea/vincula el contacto proveedor.
//
// Despliegue (aplicar migración 20260521140000 primero):
//   supabase functions deploy procesar-factura
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `Eres un experto en análisis de facturas españolas. Analiza la factura adjunta y devuelve ÚNICAMENTE JSON válido con este formato exacto, sin texto adicional ni markdown:

{
  "proveedor_nombre": "nombre de la empresa o autónomo que EMITE la factura",
  "proveedor_nif": "CIF o NIF del emisor, o null",
  "receptor_nombre": "nombre de la empresa o persona que RECIBE la factura (destinatario), o null",
  "receptor_nif": "CIF o NIF del destinatario, o null",
  "numero_factura": "número de factura, o null",
  "fecha_factura": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "base_imponible": 0.00,
  "tipo_iva": 21,
  "cuota_iva": 0.00,
  "retencion_pct": 0,
  "retencion_importe": 0.00,
  "total": 0.00,
  "concepto": "descripción breve del servicio o producto, o null",
  "tipo_operacion": "normal",
  "confidence": {
    "proveedor_nombre": 0.95,
    "proveedor_nif": 0.80,
    "numero_factura": 0.90,
    "fecha_factura": 0.95,
    "fecha_vencimiento": 0.70,
    "base_imponible": 0.95,
    "tipo_iva": 0.99,
    "cuota_iva": 0.90,
    "retencion_pct": 0.80,
    "retencion_importe": 0.75,
    "total": 0.99,
    "concepto": 0.65,
    "tipo_operacion": 0.90,
    "receptor_nombre": 0.85,
    "receptor_nif": 0.80
  }
}

REGLAS IMPORTANTES:

Números: punto decimal (1234.56), no coma. Fechas: YYYY-MM-DD.

Tipos de IVA válidos en España: 0, 4, 5, 10, 21.
- 21% tipo general (servicios profesionales, construcción, suministros…)
- 10% reducido (hostelería, transporte de viajeros, obras rehabilitación vivienda…)
- 5% reducido especial (desde 2023: arrendamiento vivienda social, aceite de oliva…)
- 4% superreducido (alimentos básicos, libros, medicamentos…)
- 0% cuando aplique exención o ISP

Retención IRPF: aplica a autónomos profesionales (15% general, 7% primer año de actividad).

tipo_operacion — detecta el régimen exacto:
- "inversion_sujeto_pasivo": la factura menciona "Inversión del sujeto pasivo", "art. 84 LIVA", "ISP", o que el destinatario es el sujeto pasivo. En este caso cuota_iva = 0 en la factura pero tipo_iva es el tipo aplicable (ej. 21).
- "exenta": menciona "operación exenta", "art. 20 LIVA", "exenta de IVA". tipo_iva = 0, cuota_iva = 0.
- "no_sujeta": menciona "no sujeta a IVA". tipo_iva = 0, cuota_iva = 0.
- "suplido": alguna línea está marcada como suplido (gasto pagado por cuenta del cliente). tipo_iva = 0, cuota_iva = 0.
- "normal": todos los demás casos.

receptor_nombre y receptor_nif: busca el bloque "Destinatario", "Factura a:", "Cliente:", "A/A:", o la empresa que aparece como receptora.

Si un campo no aparece en la factura, usa null. La confidence es tu certeza (0–1).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const sociedadId = (formData.get('sociedad_id') as string | null) ?? 'desconocida';

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Se requiere un fichero PDF o imagen' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Convertir a base64 ─────────────────────────────────────────────────
    const bytes = new Uint8Array(await file.arrayBuffer());
    let b64 = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    b64 = btoa(b64);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const mediaType: string = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');

    // ── 2. Llamar a Claude Vision ─────────────────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            isPdf
              ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: b64 } }
              : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: `Error Claude: ${errText.slice(0, 300)}` }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const anthropicData = await anthropicRes.json() as { content?: { text?: string }[] };
    const rawText = anthropicData.content?.[0]?.text ?? '{}';

    // Claude a veces envuelve el JSON en markdown — extraemos el objeto
    const match = rawText.match(/\{[\s\S]*\}/);
    let extracted: Record<string, unknown> = {};
    try { extracted = JSON.parse(match?.[0] ?? '{}') as Record<string, unknown>; }
    catch { /* si falla el parse, extracted queda vacío */ }

    // ── 3. Calcular importes ──────────────────────────────────────────────────
    const base       = Number(extracted.base_imponible)    || 0;
    const tiva       = Number(extracted.tipo_iva)           || 21;
    const tipoOp     = String(extracted.tipo_operacion      || 'normal');
    const sinIva     = tipoOp === 'exenta' || tipoOp === 'no_sujeta'
                    || tipoOp === 'suplido' || tipoOp === 'inversion_sujeto_pasivo';
    const civa       = sinIva ? 0 : (Number(extracted.cuota_iva) || +(base * tiva / 100).toFixed(2));
    const rpct       = Number(extracted.retencion_pct)      || 0;
    const rimp       = Number(extracted.retencion_importe)  || 0;
    const total      = Number(extracted.total)              || +(base + civa).toFixed(2);
    const provNombre  = (extracted.proveedor_nombre as string) || 'Proveedor desconocido';
    const provNif     = (extracted.proveedor_nif    as string | null) ?? null;
    const recepNombre = (extracted.receptor_nombre  as string | null) ?? null;
    const recepNif    = (extracted.receptor_nif     as string | null) ?? null;

    // ── 4. Inicializar cliente Supabase ───────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── 5. Auto-detectar sociedad por NIF del receptor (match ÚNICO, SIN fallback) ─
    // Normaliza ambos lados (mayúsculas + solo A-Z0-9) para tolerar guiones/puntos/
    // espacios. Si NO hay match único, la factura queda SIN sociedad validada
    // (sociedad_id_ref = null, sociedad_validada = false). NUNCA se asigna "la
    // primera" por defecto; el `sociedad_id` del form ya no se usa como fallback.
    const normNif = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    let sociedadAsignada: string | null = null;
    let sociedadValidada = false;
    const targetNif = normNif(recepNif);
    if (targetNif) {
      try {
        const { data: socs } = await supabase.from('sociedades').select('id_ref, cif');
        const matches = (socs ?? []).filter((s: { id_ref: string; cif: string | null }) =>
          normNif(s.cif) !== '' && normNif(s.cif) === targetNif);
        if (matches.length === 1) { sociedadAsignada = matches[0].id_ref; sociedadValidada = true; }
      } catch { /* sin asignar → queda pendiente de validar */ }
    }

    // ── 6. Buscar o crear contacto proveedor ──────────────────────────────────
    let contactoId: string | null = null;
    try {
      if (provNif) {
        const { data: existing } = await supabase
          .from('contactos')
          .select('id')
          .eq('nif', provNif)
          .maybeSingle();

        if (existing?.id) {
          contactoId = existing.id;
        } else {
          const { data: nuevo } = await supabase
            .from('contactos')
            .insert({ nombre: provNombre, nif: provNif, tipo: 'proveedor' })
            .select('id')
            .single();
          contactoId = nuevo?.id ?? null;
        }
      } else {
        // Sin NIF: buscar por nombre similar (primeros 30 chars para evitar falsos)
        const { data: byName } = await supabase
          .from('contactos')
          .select('id')
          .ilike('nombre', `%${provNombre.slice(0, 30)}%`)
          .limit(1)
          .maybeSingle();

        if (byName?.id) {
          contactoId = byName.id;
        } else {
          const { data: nuevo } = await supabase
            .from('contactos')
            .insert({ nombre: provNombre, tipo: 'proveedor' })
            .select('id')
            .single();
          contactoId = nuevo?.id ?? null;
        }
      }
    } catch { /* contacto es opcional — no bloquea */ }

    // ── 7. Guardar factura en Supabase ────────────────────────────────────────
    const { data, error } = await supabase
      .from('facturas_recibidas')
      .insert({
        sociedad_id_ref:     sociedadAsignada,
        sociedad_validada:   sociedadValidada,
        estado:              'borrador_ocr',
        proveedor_nombre:    provNombre,
        proveedor_nif:       provNif,
        numero_factura:      (extracted.numero_factura    as string | null) ?? null,
        fecha_factura:       (extracted.fecha_factura     as string) || new Date().toISOString().slice(0, 10),
        fecha_vencimiento:   (extracted.fecha_vencimiento as string | null) ?? null,
        base_imponible:      base,
        tipo_iva:            tiva,
        cuota_iva:           civa,
        retencion_pct:       rpct,
        retencion_importe:   rimp,
        total,
        total_a_pagar:       total - rimp,
        concepto:            (extracted.concepto as string | null) ?? null,
        tipo_operacion:      tipoOp,
        receptor_nombre_ocr: recepNombre,
        receptor_nif_ocr:    recepNif,
        contacto_id:         contactoId,
        ocr_raw:             extracted,
        ocr_confianza:       (extracted.confidence as Record<string, number> | null) ?? null,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 7b. Evento de auditoría: creación desde OCR (actor: sistema) ───────────
    // No bloquea: si falla, la factura ya existe y la UI sintetiza la línea desde
    // created_at. El service role bypasea RLS (la tabla no admite INSERT directo).
    try {
      await supabase.from('factura_aprobaciones').insert({
        factura_id:      data.id,
        actor_rol:       'sistema',
        accion:          'crea_borrador_ocr',
        estado_anterior: null,
        estado_nuevo:    'borrador_ocr',
        comentario:      'Factura creada automáticamente desde OCR.',
      });
    } catch { /* auditoría best-effort; no bloquea */ }

    // ── 8. Subir PDF al bucket privado `facturas` y guardar storage_path ──────
    // El bucket es PRIVADO: persistimos la RUTA del objeto (storage_path), NO una
    // URL pública. El visor firma una URL temporal al abrir. La subida usa el
    // service role (bypassa RLS). Best-effort: si falla, la factura ya existe.
    let storagePath: string | null = null;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageKey = `recibidas/${data.id}/${safeName}`;
      const { error: storageErr } = await supabase.storage
        .from('facturas')
        .upload(storageKey, bytes, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });
      if (!storageErr) {
        storagePath = storageKey;
        await supabase.from('facturas_recibidas')
          .update({ storage_path: storagePath })
          .eq('id', data.id);
      }
    } catch { /* Storage es opcional; no bloquea la respuesta */ }

    return new Response(JSON.stringify({ factura: { ...data, storage_path: storagePath } }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
