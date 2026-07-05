/**
 * Environment variables for the Cloudflare Worker
 */
export interface Env {
  // Google Sheets
  SHEET_ID: string;
  GCP_SERVICE_ACCOUNT_EMAIL: string;
  GCP_PRIVATE_KEY: string;

  // Storage
  WORKSPACE_KV: KVNamespace;

  // IMAP Configuration
  IMAP_USER: string;
  IMAP_PASS: string;
  IMAP_HOST: string;
  IMAP_PORT: string;
  IMAP_TLS: string;
  GEMINI_API_KEY: string;

  // Email Notifications
  DASHBOARD_URL: string;
}

/**
 * Google Sheets API response structure
 */
export interface SheetsResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

export interface BatchGetResponse {
  spreadsheetId: string;
  valueRanges: SheetsResponse[];
}

/**
 * Transformed data structures
 */
export interface RowObject {
  [key: string]: string | number | null;
}

export interface DashboardData {
  sociedades: RowObject[];
  proyectos: RowObject[];
  finanzas_sociedades: RowObject[];
  finanzas_proyectos: RowObject[];
  fichas: {
    [key: string]: RowObject[];
  };
  ponderados: {
    [key: string]: RowObject[];
  };
  bancos: {
    [key: string]: RowObject[];
  };
}

/**
 * Google OAuth2 token response
 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * JWT header and payload structures
 */
export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface JWTPayload {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
  sub?: string; // For domain-wide delegation (impersonation)
}
