/**
 * Google OAuth2 Refresh Token Generator
 *
 * Run this once to get a refresh_token for your Google account.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com/apis/credentials
 *   2. Create an OAuth 2.0 Client ID (type: "Desktop app")
 *   3. Copy the Client ID and Client Secret
 *   4. Set them below or in env vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *
 * Usage:
 *   npx tsx src/get-drive-token.ts
 *
 * It will print a URL — open it in your browser, log in, authorize,
 * and paste the authorization code back here.
 */

import * as readline from 'node:readline';

const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '850645772313-1ehl40lm9cdphahqml4mquce6jkbh0ip.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // For desktop/manual apps
const SCOPES = 'https://www.googleapis.com/auth/drive';

async function main() {
  // Step 1: Generate authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force refresh token

  console.log('\n=== Google OAuth2 Token Generator ===\n');
  console.log('1. Abre esta URL en tu navegador:\n');
  console.log(authUrl.toString());
  console.log('\n2. Inicia sesión con guille.vila.marcos@gmail.com');
  console.log('3. Autoriza el acceso a Google Drive');
  console.log('4. Copia el código de autorización y pégalo aquí:\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => {
    rl.question('Código de autorización: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // Step 2: Exchange code for tokens
  console.log('\nIntercambiando código por tokens...');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await resp.json()) as any;

  if (data.error) {
    console.error('\n❌ Error:', data.error, '-', data.error_description);
    process.exit(1);
  }

  console.log('\n✅ ¡Tokens obtenidos!\n');
  console.log('=== AÑADE ESTO A TU .dev.vars ===\n');
  console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('\n=================================\n');
  console.log('Access token (temporal):', data.access_token?.substring(0, 30) + '...');
  console.log('Refresh token (permanente):', data.refresh_token);
}

main().catch(console.error);
