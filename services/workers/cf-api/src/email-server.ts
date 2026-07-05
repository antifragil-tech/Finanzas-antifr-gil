/**
 * Email + Drive Sidecar Service
 *
 * A Node.js HTTP server that:
 *   POST /send                   — Simple HTML email via Gmail SMTP
 *   POST /send-with-attachments  — Email with file attachments (base64)
 *   POST /upload-to-drive        — Upload file to Google Drive using OAuth2
 *
 * Drive uploads use the user's personal OAuth2 refresh token,
 * so files are owned by the user (not the service account).
 *
 * Usage: npx tsx src/email-server.ts
 * Listens on port 8788 by default.
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createTransport } from 'nodemailer';

const PORT = 8788;
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB

// ── Gmail SMTP transporter ──
const transporter = createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.IMAP_USER || 'guille.vila.marcos@gmail.com',
    pass: process.env.IMAP_PASS || 'noxiywpaxocwyvmn',
  },
});

// ── Google OAuth2 config for Drive ──
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

let cachedAccessToken: { token: string; expiry: number } | null = null;

async function getDriveAccessToken(): Promise<string> {
  const now = Date.now() / 1000;
  if (cachedAccessToken && cachedAccessToken.expiry > now + 60) {
    return cachedAccessToken.token;
  }

  console.log('[DRIVE] Refreshing OAuth2 access token...');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OAuth2 token refresh failed: ${resp.status} - ${err}`);
  }

  const data = (await resp.json()) as any;
  cachedAccessToken = {
    token: data.access_token,
    expiry: now + (data.expires_in || 3600),
  };

  console.log('[DRIVE] ✅ Access token refreshed');
  return data.access_token;
}

// ── Helpers ──

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonResponse(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Server ──

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // POST /send — simple email
  if (req.method === 'POST' && req.url === '/send') {
    try {
      const { from, to, subject, html } = await parseBody(req);
      const info = await transporter.sendMail({
        from:
          from || `"Alsari Capital" <${process.env.IMAP_USER || 'guille.vila.marcos@gmail.com'}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email enviado a ${to} (${info.messageId})`);
      jsonResponse(res, 200, { success: true, messageId: info.messageId });
    } catch (err: any) {
      console.error(`❌ Error:`, err.message);
      jsonResponse(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // POST /send-with-attachments — email with attachments
  if (req.method === 'POST' && req.url === '/send-with-attachments') {
    try {
      const { from, to, subject, html, attachments } = await parseBody(req);
      const mailAttachments = (attachments || []).map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType || 'application/pdf',
      }));

      const info = await transporter.sendMail({
        from:
          from || `"Alsari Capital" <${process.env.IMAP_USER || 'guille.vila.marcos@gmail.com'}>`,
        to,
        subject,
        html,
        attachments: mailAttachments,
      });

      console.log(
        `✅ Email con ${mailAttachments.length} adjuntos enviado a ${to} (${info.messageId})`,
      );
      jsonResponse(res, 200, { success: true, messageId: info.messageId });
    } catch (err: any) {
      console.error(`❌ Error (attachments):`, err.message);
      jsonResponse(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // POST /upload-to-drive — upload file using OAuth2 (user's account)
  if (req.method === 'POST' && req.url === '/upload-to-drive') {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        jsonResponse(res, 500, {
          success: false,
          error: 'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in env',
        });
        return;
      }

      const { fileName, content, mimeType, folderId } = await parseBody(req);
      // content is base64-encoded

      const token = await getDriveAccessToken();
      const fileBuffer = Buffer.from(content, 'base64');

      console.log(
        `[DRIVE] 📤 Subiendo: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB) → ${folderId}`,
      );

      // Multipart upload to Drive
      const boundary = 'alsari_drive_boundary';
      const metadata = JSON.stringify({
        name: fileName,
        parents: [folderId],
      });

      const preamble =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${metadata}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`;

      const epilogue = `\r\n--${boundary}--`;

      const body = Buffer.concat([
        Buffer.from(preamble, 'utf-8'),
        fileBuffer,
        Buffer.from(epilogue, 'utf-8'),
      ]);

      const uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

      const driveResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      });

      if (!driveResp.ok) {
        const errBody = await driveResp.text();
        console.error(`[DRIVE] ❌ Error ${driveResp.status}: ${errBody}`);
        jsonResponse(res, driveResp.status, { success: false, error: errBody });
        return;
      }

      const fileData = (await driveResp.json()) as any;
      const webViewLink =
        fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`;
      console.log(`[DRIVE] ✅ Subido: ${fileName} → ${webViewLink}`);

      jsonResponse(res, 200, {
        success: true,
        id: fileData.id,
        name: fileData.name,
        webViewLink,
      });
    } catch (err: any) {
      console.error(`[DRIVE] ❌ Error:`, err.message);
      jsonResponse(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // Health check
  jsonResponse(res, 200, {
    status: 'ok',
    service: 'alsari-email-drive-sidecar',
    hasDriveCredentials: !!GOOGLE_REFRESH_TOKEN,
  });
});

server.listen(PORT, () => {
  console.log(`📧 Sidecar running on http://localhost:${PORT}`);
  console.log(`   Email: POST /send, POST /send-with-attachments`);
  console.log(`   Drive: POST /upload-to-drive`);
  console.log(
    `   Drive OAuth2: ${GOOGLE_REFRESH_TOKEN ? '✅ Configurado' : '❌ FALTA GOOGLE_REFRESH_TOKEN'}`,
  );
});
