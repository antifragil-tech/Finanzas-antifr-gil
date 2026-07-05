import { CFImap } from 'cf-imap';
import PostalMime from 'postal-mime';
import type { Env } from '../types';

export class ImapIngestionService {
  private env: Env;
  public logs: string[] = [];

  constructor(env: Env) {
    this.env = env;
  }

  private log(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    console.log(formattedMsg);
    this.logs.push(formattedMsg);
  }

  async fetchNewInvoices(): Promise<any[]> {
    this.log('👷 Iniciando Escaneo de Alta Visibilidad...');

    const host = this.env.IMAP_HOST;
    const port = Number(this.env.IMAP_PORT);
    const user = this.env.IMAP_USER;
    const pass = this.env.IMAP_PASS;

    const imap = new CFImap({
      host: host,
      port: port,
      tls: true,
      auth: { username: user, password: pass },
    });

    try {
      await imap.connect();
      this.log('✅ Conexión establecida.');

      const metadata = await imap.selectFolder('INBOX');
      this.log(`📂 INBOX: ${metadata.emails} mensajes.`);

      this.log(`[DEBUG] Iniciando búsqueda IMAP...`);

      // NEW FILTERING REQUIREMENTS:
      // 1. Only emails sent to finanzas@alsari.net
      // 2. Only emails received from NOW (2026-02-20T18:10:00+01:00) onwards
      const cutoffTime = new Date('2026-02-20T00:00:00Z'); // Start of today

      this.log(`📥 Buscando correos para finanzas@alsari.net...`);

      // Use the specific TO filter again now that we have header-awareness
      const uids = await imap.searchEmails({
        to: 'finanzas@alsari.net',
        since: cutoffTime,
      });

      this.log(`🔍 IMAP encontró ${uids.length} UIDs para finanzas@alsari.net`);

      if (uids.length === 0) {
        this.log('📭 No se encontraron correos nuevos para finanzas@alsari.net.');
        await imap.logout();
        return [];
      }

      if (uids.length > 10) {
        this.log(`⚠️ Demasiados correos (${uids.length}). Solo procesando los 10 más recientes.`);
        uids.sort((a, b) => b - a); // Order descending
        uids.splice(10); // Keep only first 10
      }

      this.log(
        `📥 Encontrados ${uids.length} correos potenciales. Descargando uno a uno para máxima fiabilidad...`,
      );

      const processedResults: any[] = [];

      // Loop through UIDs and fetch one by one
      for (let i = 0; i < uids.length; i++) {
        const uid = uids[i];
        this.log(`[${i + 1}/${uids.length}] 📥 Descargando UID: ${uid}...`);

        const fetchResult = await imap.fetchEmails({
          folder: 'INBOX',
          limit: uid.toString() as any,
          fetchBody: true,
          peek: true,
        });

        if (fetchResult.length === 0) {
          this.log(`   ⚠️ No se pudo descargar el correo ${uid}`);
          continue;
        }

        const email = fetchResult[0];
        const subject = email.subject || '(Sin Asunto)';
        const from = email.from || '(Sin Remitente)';
        const to = email.to || '';
        const deliveredTo = ((email as any).headers?.['delivered-to'] || '').toString();
        const originalTo = ((email as any).headers?.['x-original-to'] || '').toString();
        const emailDate = new Date(email.date);

        this.log(`[${i + 1}/${uids.length}] 👓 Verificando: "${subject}"`);
        this.log(`   🔸 To: ${to} | Delivered-To: ${deliveredTo} | Original-To: ${originalTo}`);

        // Precise Filtering: Date/Time and To address
        if (emailDate < cutoffTime) {
          this.log(`   ⏩ Ignorando por ser antiguo (${emailDate.toLocaleString()})`);
          continue;
        }

        const isTargetRecipient =
          to.toLowerCase().includes('finanzas@alsari.net') ||
          deliveredTo.toLowerCase().includes('finanzas@alsari.net') ||
          originalTo.toLowerCase().includes('finanzas@alsari.net');

        if (!isTargetRecipient) {
          this.log(`   ⏩ Ignorando: no dirigido a finanzas@alsari.net`);
          continue;
        }

        this.log(`[${i + 1}/${uids.length}] ✉️ "${subject}" | De: ${from}`);

        // Use the raw email content that cf-imap already extracted
        const rawContent = (email.raw || '').toString();

        // Strip IMAP FETCH wrapper if present
        let mimeContent = rawContent;
        if (mimeContent.startsWith('*') && mimeContent.includes('FETCH')) {
          const marker = '}\r\n';
          const idx = mimeContent.indexOf(marker);
          if (idx !== -1) {
            mimeContent = mimeContent.substring(idx + marker.length);
          }
          // Remove trailing IMAP artifacts
          const lastParen = mimeContent.lastIndexOf(')');
          if (lastParen !== -1 && lastParen > mimeContent.length - 10) {
            mimeContent = mimeContent.substring(0, lastParen);
          }
        }

        this.log(`   [DEBUG] MIME content: ${mimeContent.length} chars`);

        const parser = new PostalMime();
        const parsed = await parser.parse(mimeContent);

        this.log(`   [DEBUG] Parsed attachments: ${parsed.attachments?.length || 0}`);

        if (parsed.attachments && parsed.attachments.length > 0) {
          this.log(`   📎 Encontrados ${parsed.attachments.length} adjuntos.`);
          for (const att of parsed.attachments) {
            const filename = att.filename || `document_${Date.now()}.pdf`;
            this.log(`   🔸 Adjunto: ${filename} (${att.mimeType})`);
            const isPDF =
              att.mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
            if (isPDF) {
              this.log(`   📄 Documento PDF detectado. Iniciando análisis...`);

              try {
                let uint8: Uint8Array;
                if (att.content instanceof Uint8Array) {
                  uint8 = att.content;
                } else if (att.content instanceof ArrayBuffer) {
                  uint8 = new Uint8Array(att.content);
                } else {
                  uint8 = new TextEncoder().encode(String(att.content));
                }

                this.log(
                  `   [DEBUG] Attachment content type: ${att.content?.constructor?.name}, size: ${uint8.byteLength} bytes`,
                );
                this.log(
                  `   [DEBUG] First 20 bytes: [${Array.from(uint8.slice(0, 20)).join(', ')}]`,
                );
                this.log(
                  `   [DEBUG] PDF header check: ${String.fromCharCode(...uint8.slice(0, 5))}`,
                );

                // Robust Base64 conversion for Cloudflare Worker
                let binary = '';
                const len = uint8.byteLength;
                for (let j = 0; j < len; j++) {
                  binary += String.fromCharCode(uint8[j]);
                }
                const base64Content = btoa(binary);
                this.log(
                  `   [DEBUG] Base64 length: ${base64Content.length}, preview: ${base64Content.substring(0, 30)}...`,
                );

                const data = await this.analyzeInvoice(base64Content);
                this.log(`   ✅ Gemini reconocido: ${data.proveedor} por ${data.total}€`);

                // Stable ID construction: INV-PROVIDER-DATE-AMOUNT
                const sanitizedProvider = (data.proveedor || 'unknown')
                  .replace(/[^a-z0-9]/gi, '')
                  .toUpperCase();
                const sanitizedDate = (data.fecha || 'nodate').replace(/[^0-9]/g, '');
                const sanitizedAmount = String(data.total || '0').replace(/[^0-9]/g, '');
                const stableId = `INV-${sanitizedProvider}-${sanitizedDate}-${sanitizedAmount}`;

                processedResults.push({
                  id: stableId,
                  date: data.fecha,
                  provider: data.proveedor,
                  cif: data.cif,
                  amount: parseFloat(data.total) || 0,
                  project: 'Sin clasificar',
                  status: 'pending',
                  details: data,
                  filename: att.filename,
                  pdfContent: base64Content, // Store content for KV persistence in worker
                });
              } catch (ocrError: any) {
                this.log(`   ❌ Error en análisis: ${ocrError.message}`);
              }
            }
          }
        }
      }

      await imap.logout();
      this.log(`🏁 Ingestión finalizada. ${processedResults.length} facturas encontradas.`);
      return processedResults;
    } catch (error: any) {
      this.log(`❌ FALLO: ${error.message}`);
      if (imap) await imap.logout().catch(() => {});
      throw error;
    }
  }

  async analyzeInvoice(base64Content: string): Promise<any> {
    const apiKey = this.env.GEMINI_API_KEY;
    const prompt = `Eres un experto en contabilidad española. Analiza esta factura PDF y extrae los siguientes datos.

REGLAS IMPORTANTES:
- "total" debe ser el IMPORTE TOTAL DE LA FACTURA (la cantidad final a pagar, incluyendo IVA). NO uses subtotales ni importes parciales.
- "fecha" debe ser la FECHA DE EMISIÓN de la factura en formato DD/MM/YYYY.
- "base_imponible" es el importe ANTES de impuestos.
- Todos los importes deben ser NÚMEROS decimales (ej: 2584.70), SIN símbolos de moneda ni separadores de miles.
- Si un campo no se encuentra, usa null.

Devuelve SOLO un objeto JSON con esta estructura exacta:
{
  "proveedor": "Nombre de la empresa que emite la factura",
  "cif": "CIF/NIF del emisor",
  "fecha": "DD/MM/YYYY",
  "base_imponible": 0.00,
  "iva_porcentaje": 21,
  "cuota_iva": 0.00,
  "total": 0.00,
  "concepto": "Breve descripción del servicio/producto"
}

Devuelve SOLO el JSON, sin markdown ni explicaciones.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'application/pdf', data: base64Content } },
          ],
        },
      ],
    });

    const delays = [5000, 15000, 30000]; // retry delays in ms
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) {
        const result = (await response.json()) as any;
        const text = result.candidates[0].content.parts[0].text;
        return JSON.parse(text.replace(/```json|```/g, '').trim());
      }

      if (response.status === 429 && attempt < delays.length) {
        const waitSec = delays[attempt] / 1000;
        this.log(
          `   ⏳ Gemini cuota agotada. Reintentando en ${waitSec}s... (intento ${attempt + 1}/${delays.length})`,
        );
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }

      const errorBody = await response.text();
      throw new Error(`Gemini status ${response.status}: ${errorBody}`);
    }
    throw new Error('Gemini: reintentos agotados');
  }
}
