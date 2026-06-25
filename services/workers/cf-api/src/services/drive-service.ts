/**
 * Google Drive Service
 * 
 * Proxies file uploads through the local sidecar service (port 8788),
 * which uses OAuth2 with the user's personal credentials.
 * This bypasses the Service Account storage quota limitation.
 */

const SIDECAR_URL = 'http://localhost:8788';
const FOLDER_ID = '1yvT5o3DLKVZcpe16n-2750mBI5bbxuYz';

export class DriveService {
    private logs: string[] = [];

    private log(msg: string) {
        this.logs.push(`[DRIVE] ${msg}`);
    }

    getLogs(): string[] {
        return this.logs;
    }

    /**
     * Returns the hardcoded folder ID.
     */
    async findOrCreateFolder(_folderName: string): Promise<string> {
        this.log(`📁 Usando carpeta: ${FOLDER_ID}`);
        return FOLDER_ID;
    }

    /**
     * Upload a file via the sidecar (which uses OAuth2).
     * Files are owned by guille.vila.marcos@gmail.com, not the SA.
     */
    async uploadFile(params: {
        folderId: string;
        fileName: string;
        content: Uint8Array;
        mimeType: string;
    }): Promise<{ id: string; name: string; webViewLink: string }> {
        const { folderId, fileName, content, mimeType } = params;

        // Convert Uint8Array to base64
        const base64 = btoa(String.fromCharCode(...content));

        this.log(`📤 Subiendo via sidecar: ${fileName} (${(content.length / 1024).toFixed(1)} KB)`);

        const resp = await fetch(`${SIDECAR_URL}/upload-to-drive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                content: base64,
                mimeType,
                folderId,
            }),
        });

        const data = await resp.json() as any;

        if (!data.success) {
            this.log(`❌ Error: ${data.error}`);
            throw new Error(`Drive upload failed: ${data.error}`);
        }

        this.log(`✅ Subido: ${fileName} → ${data.webViewLink}`);

        return {
            id: data.id,
            name: data.name,
            webViewLink: data.webViewLink,
        };
    }
}
