import type { Env, JWTHeader, JWTPayload, TokenResponse } from './types';

/**
 * Base64URL encoding (without padding)
 */
function base64UrlEncode(data: ArrayBuffer): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert string to ArrayBuffer
 */
function str2ab(str: string): ArrayBuffer {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

/**
 * Import PKCS8 private key for signing
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
    // Remove PEM header/footer and whitespace
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '');

    // Decode base64
    const binaryDer = atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
        binaryDerArray[i] = binaryDer.charCodeAt(i);
    }

    // Import the key
    return await crypto.subtle.importKey(
        'pkcs8',
        binaryDerArray.buffer,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );
}

/**
 * Create and sign a JWT for Google OAuth2
 */
async function createSignedJWT(env: Env, scope: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // JWT Header
    const header: JWTHeader = {
        alg: 'RS256',
        typ: 'JWT',
    };

    // JWT Payload
    const payload: JWTPayload = {
        iss: env.GCP_SERVICE_ACCOUNT_EMAIL,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(str2ab(JSON.stringify(header)));
    const encodedPayload = base64UrlEncode(str2ab(JSON.stringify(payload)));

    // Create signature input
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Import private key and sign
    const privateKey = await importPrivateKey(env.GCP_PRIVATE_KEY);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        str2ab(signatureInput)
    );

    // Encode signature
    const encodedSignature = base64UrlEncode(signature);

    // Return complete JWT
    return `${signatureInput}.${encodedSignature}`;
}

/**
 * Exchange JWT for Google OAuth2 access token
 */
async function getAccessToken(env: Env, scope: string): Promise<string> {
    const jwt = await createSignedJWT(env, scope);

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json() as TokenResponse;
    return data.access_token;
}

// Token caches (simple in-memory cache, one per scope)
const tokenCache: Record<string, { token: string; expiry: number }> = {};

const SCOPE_SHEETS = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';

/**
 * Get cached token or fetch a new one (Sheets scope)
 */
export async function getGoogleToken(env: Env): Promise<string> {
    return getCachedToken(env, SCOPE_SHEETS);
}

/**
 * Get cached token with Drive scope (for uploading files).
 * The service account accesses folders shared with it as Editor.
 */
export async function getGoogleDriveToken(env: Env): Promise<string> {
    return getCachedToken(env, SCOPE_DRIVE);
}

async function getCachedToken(env: Env, scope: string): Promise<string> {
    const now = Date.now() / 1000;
    const cached = tokenCache[scope];

    if (cached && cached.expiry > now + 300) {
        return cached.token;
    }

    const token = await getAccessToken(env, scope);
    tokenCache[scope] = { token, expiry: now + 3600 };
    return token;
}
