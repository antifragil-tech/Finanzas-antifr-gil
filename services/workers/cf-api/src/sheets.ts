import type { Env, BatchGetResponse } from './types';
import { getGoogleToken } from './auth';

/**
 * Fetch multiple ranges from Google Sheets in a single batch request.
 * Now dynamically discovers all sheets starting with "Ficha_".
 */
export async function fetchSheetData(env: Env): Promise<BatchGetResponse> {
    const token = await getGoogleToken(env);

    // 1. Fetch spreadsheet metadata to discover sheet names
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}?fields=sheets.properties.title`;
    const metadataResponse = await fetch(metadataUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!metadataResponse.ok) {
        throw new Error(`Failed to fetch spreadsheet metadata: ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json() as any;
    const allSheetNames: string[] = metadata.sheets.map((s: any) => s.properties.title);

    // 2. Identify core ranges and dynamic "Ficha" ranges
    const coreRanges = [
        'Sociedades!A:Z',
        'Proyectos!A:Z',
        'Datos_Financieros_Sociedades!A:Z',
        'Datos_Financieros_Proyectos!A:Z',
    ];

    const ponderadosRanges = allSheetNames
        .filter(name => name.startsWith('Ponderados_'))
        .map(name => `${name}!A:Z`);

    const fichaRanges = allSheetNames
        .filter(name => name.startsWith('Ficha_'))
        .map(name => `${name}!A:Z`);

    const bankRanges = allSheetNames
        .filter(name => name.startsWith('Bancos_') || name.startsWith('Posiciones_'))
        .map(name => `${name}!A:Z`);

    // Order: core → ponderados → fichas → bancos
    const rangesToFetch = [...coreRanges, ...ponderadosRanges, ...fichaRanges, ...bankRanges];

    // 3. Build batch get URL
    const rangeParams = rangesToFetch.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values:batchGet?${rangeParams}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch sheet data: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    data.availableSheets = allSheetNames;
    return data as BatchGetResponse;
}
