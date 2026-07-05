import type { Env } from './types';
import { fetchSheetData } from './sheets';
import { transformSheetData } from './transform';
import { ImapIngestionService } from './services/imap-ingestion';
import { EmailService } from './services/email-service';
import { DriveService } from './services/drive-service';

/**
 * CORS headers helper mapping
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = (origin: string | null): boolean => {
    if (!origin) return false;

    // Allow localhost
    if (origin.startsWith('http://localhost:')) return true;
    if (origin.startsWith('http://127.0.0.1:')) return true;

    // Allow Cloudflare Pages
    if (origin.endsWith('.pages.dev')) return true;

    // Allow custom domain (alsari.capital)
    if (origin.endsWith('alsari.capital')) return true;

    return false;
  };

  const currentOrigin = isAllowed(origin) ? origin! : 'http://localhost:5173';

  return {
    'Access-Control-Allow-Origin': currentOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('Origin')),
  });
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data: any, request: Request, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request.headers.get('Origin')),
    },
  });
}

/**
 * Create error response
 */
function errorResponse(message: string, request: Request, status = 500): Response {
  return jsonResponse(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    request,
    status,
  );
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Main endpoint: /api/data or root
    if (url.pathname === '/api/data' || url.pathname === '/' || url.pathname === '') {
      if (request.method !== 'GET') {
        return errorResponse('Method not allowed', request, 405);
      }
      try {
        // Validate environment variables
        if (!env.GCP_SERVICE_ACCOUNT_EMAIL || !env.GCP_PRIVATE_KEY) {
          return errorResponse(
            'Missing required environment variables: GCP_SERVICE_ACCOUNT_EMAIL or GCP_PRIVATE_KEY',
            request,
            500,
          );
        }

        // Fetch data from Google Sheets
        const batchResponse = await fetchSheetData(env);

        // Transform data
        const transformedData = transformSheetData(batchResponse.valueRanges);

        // Return structured response
        return jsonResponse(
          {
            success: true,
            data: transformedData,
            metadata: {
              timestamp: new Date().toISOString(),
              sheetId: env.SHEET_ID,
              ranges: batchResponse.valueRanges.map((vr) => vr.range),
              availableSheets: (batchResponse as any).availableSheets || [],
            },
          },
          request,
        );
      } catch (error) {
        console.error('Error fetching sheet data:', error);

        // Fallback: If Sheets fail, we still want to show
        // what's in KV (like Invoices)
        return jsonResponse(
          {
            success: true,
            data: {
              sociedades: [],
              proyectos: [],
              finanzas_sociedades: [],
              finanzas_proyectos: [],
              fichas: {},
              ponderados: {},
            },
            warning: 'Sheets API failed, showing empty dashboard.',
          },
          request,
        );
      }
    }

    if (url.pathname === '/api/invoices' && request.method === 'GET') {
      try {
        const list = await env.WORKSPACE_KV.list({ prefix: 'invoice:' });
        const invoices = [];
        for (const key of list.keys) {
          const value = await env.WORKSPACE_KV.get(key.name);
          if (value) invoices.push(JSON.parse(value));
        }
        return jsonResponse({ success: true, data: invoices }, request);
      } catch (error) {
        return errorResponse('Error listing invoices', request);
      }
    }

    // DEBUG: List all keys
    if (url.pathname === '/api/debug/kv' && request.method === 'GET') {
      const list = await env.WORKSPACE_KV.list();
      return new Response(JSON.stringify({ success: true, keys: list.keys }), {
        headers: {
          ...getCorsHeaders(request.headers.get('Origin')),
          'Content-Type': 'application/json',
        },
      });
    }

    // --- WORKSPACE API ROUTES ---

    // GET /api/workspace/weeks - List all weeks
    if (url.pathname === '/api/workspace/weeks' && request.method === 'GET') {
      try {
        const list = await env.WORKSPACE_KV.list({ prefix: 'week_index:' });
        const weeks = [];
        for (const key of list.keys) {
          const value = await env.WORKSPACE_KV.get(key.name);
          if (value) weeks.push(JSON.parse(value));
        }
        return jsonResponse({ success: true, data: weeks }, request);
      } catch (error) {
        return errorResponse('Error listing weeks', request);
      }
    }

    // POST /api/workspace/week/:id - Save a week
    if (url.pathname.startsWith('/api/workspace/week/') && request.method === 'POST') {
      try {
        const id = url.pathname.split('/').pop();
        const body = (await request.json()) as any;

        // Store index and data separately or together?
        // Let's store them as week_index:id and week_data:id to mimic the user's Firestore structure
        if (body.index) {
          await env.WORKSPACE_KV.put(`week_index:${id}`, JSON.stringify({ id, ...body.index }));
        }
        if (body.data) {
          await env.WORKSPACE_KV.put(`week_data:${id}`, JSON.stringify(body.data));
        }

        return jsonResponse({ success: true }, request);
      } catch (error) {
        return errorResponse('Error saving week', request);
      }
    }

    // GET /api/workspace/week/:id - Get a week's full data
    if (url.pathname.startsWith('/api/workspace/week/') && request.method === 'GET') {
      try {
        const id = url.pathname.split('/').pop();
        const index = await env.WORKSPACE_KV.get(`week_index:${id}`);
        const data = await env.WORKSPACE_KV.get(`week_data:${id}`);

        if (!index) return errorResponse('Week not found', request, 404);

        return jsonResponse(
          {
            success: true,
            data: {
              index: JSON.parse(index),
              data: data ? JSON.parse(data) : null,
            },
          },
          request,
        );
      } catch (error) {
        return errorResponse('Error fetching week', request);
      }
    }

    // DELETE /api/workspace/week/:id - Delete a week
    if (url.pathname.startsWith('/api/workspace/week/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        await env.WORKSPACE_KV.delete(`week_data:${id}`);
        return jsonResponse({ success: true }, request);
      } catch (error) {
        return errorResponse('Error deleting week', request);
      }
    }

    // DELETE /api/invoices/:id - Delete an invoice
    if (url.pathname.startsWith('/api/invoices/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        await env.WORKSPACE_KV.delete(`invoice:${id}`);
        await env.WORKSPACE_KV.delete(`invoice_pdf:${id}`); // Clean up PDF too
        return jsonResponse({ success: true }, request);
      } catch (error) {
        return errorResponse('Error deleting invoice', request);
      }
    }

    // PATCH /api/invoices/:id/action - Update invoice status + send email
    if (url.pathname.match(/^\/api\/invoices\/[^/]+\/action$/) && request.method === 'PATCH') {
      try {
        const parts = url.pathname.split('/');
        const id = parts[parts.length - 2];
        const body = (await request.json()) as { action: string; comments?: string };

        // Load current invoice from KV
        const raw = await env.WORKSPACE_KV.get(`invoice:${id}`);
        if (!raw) return errorResponse('Invoice not found', request, 404);

        const invoice = JSON.parse(raw);
        const oldStatus = invoice.status;

        // State machine
        let newStatus = oldStatus;
        let emailTarget: 'propiedad' | 'finanzas' | null = null;

        if (body.action === 'accept_direccion' && oldStatus === 'pending') {
          newStatus = 'en_propiedad';
          emailTarget = 'propiedad';
        } else if (body.action === 'accept_propiedad' && oldStatus === 'en_propiedad') {
          newStatus = 'en_finanzas';
          emailTarget = 'finanzas';
        } else if (body.action === 'reject') {
          newStatus = 'rejected';
          invoice.rejectionReason = body.comments || '';
        } else if (body.action === 'mark_paid' && oldStatus === 'en_finanzas') {
          newStatus = 'paid';
        } else {
          return errorResponse(
            `Invalid action '${body.action}' for status '${oldStatus}'`,
            request,
            400,
          );
        }

        // Update and save
        invoice.status = newStatus;
        await env.WORKSPACE_KV.put(`invoice:${id}`, JSON.stringify(invoice));

        // Send email notification if needed
        const emailLogs: string[] = [];
        if (emailTarget) {
          const emailService = new EmailService({
            user: env.IMAP_USER,
            pass: env.IMAP_PASS,
            dashboardUrl: env.DASHBOARD_URL || 'http://localhost:5173/invoices',
          });

          const invoiceData = {
            provider: invoice.provider || 'Desconocido',
            amount: parseFloat(invoice.amount) || 0,
            date: invoice.date || '',
            invoiceId: id,
          };

          if (emailTarget === 'propiedad') {
            await emailService.notifyPropiedad(invoiceData);
          } else if (emailTarget === 'finanzas') {
            await emailService.notifyFinanzas(invoiceData);
          }

          emailLogs.push(...emailService.getLogs());
        }

        return jsonResponse(
          {
            success: true,
            data: invoice,
            statusChange: `${oldStatus} → ${newStatus}`,
            emailLogs,
          },
          request,
        );
      } catch (error: any) {
        return errorResponse(`Error updating invoice: ${error.message}`, request);
      }
    }

    // POST /api/invoices/:id/finalize - Finanzas: upload proof, validate, archive, notify
    if (url.pathname.match(/^\/api\/invoices\/[^/]+\/finalize$/) && request.method === 'POST') {
      try {
        const parts = url.pathname.split('/');
        const id = parts[parts.length - 2];

        // Load invoice
        const raw = await env.WORKSPACE_KV.get(`invoice:${id}`);
        if (!raw) return errorResponse('Invoice not found', request, 404);

        const invoice = JSON.parse(raw);
        if (invoice.status !== 'en_finanzas') {
          return errorResponse(
            `La factura no está en estado 'en_finanzas' (actual: ${invoice.status})`,
            request,
            400,
          );
        }

        // Parse multipart form data
        const formData = await request.formData();
        const proofFile = formData.get('proof') as File | null;
        if (!proofFile) {
          return errorResponse('Falta el archivo de justificante (campo "proof")', request, 400);
        }

        const proofBytes = new Uint8Array(await proofFile.arrayBuffer());
        const proofBase64 = btoa(String.fromCharCode(...proofBytes));
        const proofMimeType = proofFile.type || 'application/pdf';
        const allLogs: string[] = [];

        // ── Step 1: Gemini Validation ──
        allLogs.push('[VALIDATION] 🔍 Analizando justificante con Gemini...');

        const invoiceAmount = parseFloat(invoice.amount) || 0;
        const invoiceProvider = invoice.provider || '';

        const geminiPrompt = `Analiza este justificante de pago y devuelve un JSON con:
{
  "importe": (número, importe pagado),
  "beneficiario": (string, nombre del beneficiario/receptor del pago),
  "coincide_importe": (boolean, true si el importe coincide con ${invoiceAmount}),
  "coincide_beneficiario": (boolean, true si el beneficiario coincide con "${invoiceProvider}")
}
Devuelve SOLO el JSON sin markdown. Sé flexible con variaciones menores del nombre.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const geminiResp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: geminiPrompt },
                  { inline_data: { mime_type: proofMimeType, data: proofBase64 } },
                ],
              },
            ],
          }),
        });

        if (!geminiResp.ok) {
          const errText = await geminiResp.text();
          return errorResponse(`Gemini error: ${geminiResp.status} - ${errText}`, request);
        }

        const geminiResult = (await geminiResp.json()) as any;
        const geminiText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let validation: any;
        try {
          validation = JSON.parse(geminiText.replace(/```json|```/g, '').trim());
        } catch {
          return errorResponse(`No se pudo parsear la respuesta de Gemini: ${geminiText}`, request);
        }

        allLogs.push(
          `[VALIDATION] Importe justificante: ${validation.importe} | Factura: ${invoiceAmount}`,
        );
        allLogs.push(
          `[VALIDATION] Beneficiario: ${validation.beneficiario} | Proveedor: ${invoiceProvider}`,
        );

        // Check match
        if (!validation.coincide_importe || !validation.coincide_beneficiario) {
          const reasons: string[] = [];
          if (!validation.coincide_importe) {
            reasons.push(
              `Importe: justificante ${validation.importe}€ vs factura ${invoiceAmount}€`,
            );
          }
          if (!validation.coincide_beneficiario) {
            reasons.push(
              `Beneficiario: justificante "${validation.beneficiario}" vs factura "${invoiceProvider}"`,
            );
          }
          return jsonResponse(
            {
              success: false,
              error: 'El justificante no coincide con la factura',
              validation,
              reasons,
            },
            request,
            400,
          );
        }

        allLogs.push('[VALIDATION] ✅ Justificante validado correctamente');

        // ── Step 2: Google Drive Upload ──
        allLogs.push('[DRIVE] 📤 Subiendo archivos a Google Drive...');

        const driveService = new DriveService();
        const year = new Date().getFullYear();
        const folderName = `Alsari - Facturas Pagadas ${year}`;
        const folderId = await driveService.findOrCreateFolder(folderName);

        // Build nice file names: YYYY-MM-DD_Provider_Amount
        const invoiceDate = invoice.date || new Date().toISOString().split('T')[0];
        const dateStr = invoiceDate.includes('/')
          ? invoiceDate.split('/').reverse().join('-')
          : invoiceDate;
        const safeName = invoiceProvider
          .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
          .replace(/\s+/g, '_');
        const amountStr = invoiceAmount.toFixed(2).replace('.', '-');

        // Upload invoice PDF
        const invoicePdfBase64 = await env.WORKSPACE_KV.get(`invoice_pdf:${id}`);
        let invoiceDriveLink = { id: '', name: '', webViewLink: '' };
        if (invoicePdfBase64) {
          const pdfBinary = Uint8Array.from(atob(invoicePdfBase64), (c) => c.charCodeAt(0));
          invoiceDriveLink = await driveService.uploadFile({
            folderId,
            fileName: `${dateStr}_${safeName}_${amountStr}_Factura.pdf`,
            content: pdfBinary,
            mimeType: 'application/pdf',
          });
        }

        // Upload proof
        const proofExt = proofMimeType.includes('pdf')
          ? 'pdf'
          : proofMimeType.split('/')[1] || 'pdf';
        const proofDriveLink = await driveService.uploadFile({
          folderId,
          fileName: `${dateStr}_${safeName}_${amountStr}_Justificante.${proofExt}`,
          content: proofBytes,
          mimeType: proofMimeType,
        });

        allLogs.push(...driveService.getLogs());

        // ── Step 3: Email to Gestoría ──
        allLogs.push('[EMAIL] 📧 Enviando email a gestoría...');

        const emailService = new EmailService({
          user: env.IMAP_USER,
          pass: env.IMAP_PASS,
          dashboardUrl: env.DASHBOARD_URL || 'http://localhost:5173/invoices',
        });

        const attachments = [];
        if (invoicePdfBase64) {
          attachments.push({
            filename: `${dateStr}_${safeName}_Factura.pdf`,
            content: invoicePdfBase64,
            contentType: 'application/pdf',
          });
        }
        attachments.push({
          filename: `${dateStr}_${safeName}_Justificante.${proofExt}`,
          content: proofBase64,
          contentType: proofMimeType,
        });

        await emailService.notifyGestoria(
          {
            provider: invoiceProvider,
            amount: invoiceAmount,
            date: invoice.date || '',
            invoiceId: id,
          },
          attachments,
          {
            invoiceLink: invoiceDriveLink.webViewLink,
            proofLink: proofDriveLink.webViewLink,
            folderLink: `https://drive.google.com/drive/folders/${folderId}`,
          },
        );
        allLogs.push(...emailService.getLogs());

        // ── Step 4: Update Status ──
        invoice.status = 'paid_archived';
        invoice.proofFileName = proofFile.name;
        invoice.archivedAt = new Date().toISOString();
        invoice.driveFolder = folderId;
        invoice.driveInvoiceId = invoiceDriveLink.id;
        invoice.driveProofId = proofDriveLink.id;
        await env.WORKSPACE_KV.put(`invoice:${id}`, JSON.stringify(invoice));

        allLogs.push(`[STATUS] ✅ Factura finalizada: en_finanzas → paid_archived`);

        return jsonResponse(
          {
            success: true,
            data: invoice,
            validation,
            driveLinks: {
              folder: `https://drive.google.com/drive/folders/${folderId}`,
              invoice: invoiceDriveLink.webViewLink,
              proof: proofDriveLink.webViewLink,
            },
            logs: allLogs,
          },
          request,
        );
      } catch (error: any) {
        return errorResponse(`Error finalizando factura: ${error.message}`, request);
      }
    }

    // GET /api/invoices/:id/pdf - Serve invoice PDF content
    if (
      url.pathname.startsWith('/api/invoices/') &&
      url.pathname.endsWith('/pdf') &&
      request.method === 'GET'
    ) {
      try {
        const parts = url.pathname.split('/');
        const id = parts[parts.length - 2]; // Get id from /api/invoices/:id/pdf
        const base64 = await env.WORKSPACE_KV.get(`invoice_pdf:${id}`);

        if (!base64) return errorResponse('PDF not found', request, 404);

        // Convert base64 back to binary
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        return new Response(bytes, {
          headers: {
            'Content-Type': 'application/pdf',
            ...getCorsHeaders(request.headers.get('Origin')),
            'Content-Disposition': 'inline',
          },
        });
      } catch (error) {
        return errorResponse('Error fetching PDF', request);
      }
    }

    // --- INVOICES API ROUTES ---

    // POST /api/invoices/ingest - Trigger manual ingestion
    if (url.pathname === '/api/invoices/ingest' && request.method === 'POST') {
      try {
        const { results, logs } = await handleIngestion(env);
        return jsonResponse(
          {
            success: true,
            count: results.length,
            data: results,
            debug_logs: logs,
          },
          request,
        );
      } catch (error: any) {
        return errorResponse(error.message, request);
      }
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse(
        {
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        request,
      );
    }

    // 404 for unknown routes
    return errorResponse('Not found', request, 404);
  },

  /**
   * Handle Scheduled events (Cron Triggers)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`⏰ Cron Trigger: Iniciando ingesta automática (${event.cron})`);
    ctx.waitUntil(handleIngestion(env));
  },
};

/**
 * Shared ingestion logic for API and Cron
 */
async function handleIngestion(env: Env): Promise<{ results: any[]; logs: string[] }> {
  const imapService = new ImapIngestionService(env);
  const results = await imapService.fetchNewInvoices();

  // Persist recognized invoices
  for (const inv of results) {
    if (inv.status !== 'ERROR_LECTURA') {
      // SAFE INGESTION: Check if invoice already exists
      const existing = await env.WORKSPACE_KV.get(`invoice:${inv.id}`);
      if (existing) {
        const existingData = JSON.parse(existing);
        // Preserve current status and other manual fields
        const mergedInvoice = {
          ...inv, // Latest data from Gmail
          status: existingData.status, // Keep manual status (approved, paid, etc.)
          project: existingData.project || inv.project, // Keep manual project classification
          rejectionReason: existingData.rejectionReason,
          note: existingData.note,
        };
        await env.WORKSPACE_KV.put(`invoice:${inv.id}`, JSON.stringify(mergedInvoice));
      } else {
        // New invoice
        const { pdfContent, ...invoiceData } = inv;
        await env.WORKSPACE_KV.put(`invoice:${inv.id}`, JSON.stringify(invoiceData));

        // Store PDF content separately if available
        if (pdfContent) {
          await env.WORKSPACE_KV.put(`invoice_pdf:${inv.id}`, pdfContent);
        }
      }
    }
  }

  return { results, logs: imapService.logs };
}
