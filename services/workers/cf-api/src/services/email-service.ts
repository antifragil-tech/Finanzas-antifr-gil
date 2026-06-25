/**
 * Email Notification Service
 * Sends workflow notifications via Gmail SMTP.
 * 
 * Calls the email sidecar service (Node.js + Nodemailer on port 8788)
 * which handles the actual SMTP connection to smtp.gmail.com.
 */

interface SmtpConfig {
    user: string;     // Gmail address (used as "from")
    pass: string;     // Not used directly — sidecar handles auth
    dashboardUrl: string;
}

interface InvoiceEmailData {
    provider: string;
    amount: number;
    date: string;
    invoiceId: string;
}

interface EmailAttachment {
    filename: string;
    content: string; // base64
    contentType: string;
}

// Test mode: all emails go to this address
const TEST_RECIPIENT = 'guillevilapt@gmail.com';

const RECIPIENTS = {
    javi: TEST_RECIPIENT,
    alicia: TEST_RECIPIENT,
    gestoria: TEST_RECIPIENT, // Production: gestoría real email
};

// Email sidecar URL
const EMAIL_SIDECAR_URL = 'http://localhost:8788';

function formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function buildEmailHTML(params: {
    greeting: string;
    body: string;
    invoice: InvoiceEmailData;
    dashboardUrl: string;
    extraContent?: string;
}): string {
    const { greeting, body, invoice, dashboardUrl, extraContent } = params;

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0b;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#18181b;border-radius:16px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.05);">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#6366f1;margin-right:8px;vertical-align:middle;"></div>
                                        <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;vertical-align:middle;">ALSARI CAPITAL</span>
                                    </td>
                                    <td align="right">
                                        <span style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Sistema de Facturas</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:32px 40px;">
                            <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin:0 0 16px;">${greeting}</h2>
                            <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                                ${body}
                            </p>

                            <!-- Invoice Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin-bottom:28px;">
                                <tr>
                                    <td style="padding:20px 24px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td>
                                                    <p style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Proveedor</p>
                                                    <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">${invoice.provider}</p>
                                                </td>
                                                <td align="right">
                                                    <p style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Importe</p>
                                                    <p style="color:#ffffff;font-size:20px;font-weight:800;margin:0;">${formatMoney(invoice.amount)}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding-top:12px;">
                                                    <p style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Fecha</p>
                                                    <p style="color:#a1a1aa;font-size:14px;margin:0;">${invoice.date || '—'}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            ${extraContent || ''}

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="${dashboardUrl}" 
                                           style="display:inline-block;padding:14px 32px;background-color:#6366f1;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                                            Ir al Dashboard →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
                            <p style="color:#52525b;font-size:12px;text-align:center;margin:0;">
                                Alsari Capital · Sistema de Gestión de Facturas · Este es un email automático
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export class EmailService {
    private config: SmtpConfig;
    private logs: string[] = [];

    constructor(config: SmtpConfig) {
        this.config = config;
    }

    private log(msg: string) {
        this.logs.push(`[EMAIL] ${msg}`);
    }

    getLogs(): string[] {
        return this.logs;
    }

    /**
     * Send simple HTML email via sidecar
     */
    private async send(to: string, subject: string, html: string): Promise<boolean> {
        try {
            const response = await fetch(`${EMAIL_SIDECAR_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: `"Alsari Capital" <${this.config.user}>`,
                    to,
                    subject,
                    html,
                }),
            });

            const result = await response.json() as any;

            if (result.success) {
                this.log(`✅ Email enviado a ${to} (${result.messageId})`);
                return true;
            } else {
                this.log(`❌ Error email: ${result.error}`);
                return false;
            }
        } catch (err: any) {
            this.log(`❌ Error conectando al servicio de email: ${err.message}`);
            return false;
        }
    }

    /**
     * Send email with file attachments via sidecar
     */
    private async sendWithAttachments(
        to: string,
        subject: string,
        html: string,
        attachments: EmailAttachment[],
    ): Promise<boolean> {
        try {
            const response = await fetch(`${EMAIL_SIDECAR_URL}/send-with-attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: `"Alsari Capital" <${this.config.user}>`,
                    to,
                    subject,
                    html,
                    attachments,
                }),
            });

            const result = await response.json() as any;

            if (result.success) {
                this.log(`✅ Email con ${attachments.length} adjuntos enviado a ${to} (${result.messageId})`);
                return true;
            } else {
                this.log(`❌ Error email con adjuntos: ${result.error}`);
                return false;
            }
        } catch (err: any) {
            this.log(`❌ Error conectando al servicio de email: ${err.message}`);
            return false;
        }
    }

    /**
     * Notify Javi (Propiedad) that Dirección accepted an invoice
     */
    async notifyPropiedad(invoice: InvoiceEmailData): Promise<boolean> {
        const subject = `Nueva factura de ${invoice.provider} por ${formatMoney(invoice.amount)} pendiente`;

        const html = buildEmailHTML({
            greeting: 'Hola Javi,',
            body: `<strong>Dirección</strong> ha validado una nueva factura de <strong>${invoice.provider}</strong>. Tienes pendiente tu aprobación en el Dashboard.`,
            invoice,
            dashboardUrl: this.config.dashboardUrl,
        });

        this.log(`📧 Enviando notificación a Propiedad (Javi) → ${RECIPIENTS.javi}`);
        return this.send(RECIPIENTS.javi, subject, html);
    }

    /**
     * Notify Alicia (Finanzas) that Propiedad approved an invoice
     */
    async notifyFinanzas(invoice: InvoiceEmailData): Promise<boolean> {
        const subject = `Nueva factura de ${invoice.provider} por ${formatMoney(invoice.amount)} pendiente`;

        const html = buildEmailHTML({
            greeting: 'Hola Alicia,',
            body: `<strong>Javi</strong> ha aprobado una factura de <strong>${invoice.provider}</strong>. Ya puedes subir el comprobante y proceder al pago.`,
            invoice,
            dashboardUrl: this.config.dashboardUrl,
        });

        this.log(`📧 Enviando notificación a Finanzas (Alicia) → ${RECIPIENTS.alicia}`);
        return this.send(RECIPIENTS.alicia, subject, html);
    }

    /**
     * Notify Gestoría that an invoice has been paid and archived.
     * Includes the invoice PDF and payment proof as attachments.
     */
    async notifyGestoria(
        invoice: InvoiceEmailData,
        attachments: EmailAttachment[],
        driveLinks: { invoiceLink: string; proofLink: string; folderLink: string },
    ): Promise<boolean> {
        const subject = `Nueva Factura Pagada - Alsari Capital`;

        const driveSection = `
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
                <tr>
                    <td style="padding:16px 20px;">
                        <p style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">📁 Archivos en Google Drive</p>
                        <p style="margin:4px 0;"><a href="${driveLinks.invoiceLink}" style="color:#6366f1;font-size:13px;text-decoration:none;">📄 Factura</a></p>
                        <p style="margin:4px 0;"><a href="${driveLinks.proofLink}" style="color:#6366f1;font-size:13px;text-decoration:none;">🧾 Justificante de Pago</a></p>
                        <p style="margin:8px 0 0;"><a href="${driveLinks.folderLink}" style="color:#a1a1aa;font-size:11px;text-decoration:none;">Abrir carpeta →</a></p>
                    </td>
                </tr>
            </table>`;

        const html = buildEmailHTML({
            greeting: 'Nueva Factura Pagada',
            body: `La factura de <strong>${invoice.provider}</strong> por <strong>${formatMoney(invoice.amount)}</strong> ha sido pagada y archivada. Adjuntamos la factura original y el justificante de pago.`,
            invoice,
            dashboardUrl: this.config.dashboardUrl,
            extraContent: driveSection,
        });

        this.log(`📧 Enviando notificación a Gestoría → ${RECIPIENTS.gestoria} (${attachments.length} adjuntos)`);
        return this.sendWithAttachments(RECIPIENTS.gestoria, subject, html, attachments);
    }
}
