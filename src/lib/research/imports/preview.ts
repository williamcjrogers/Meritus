import { parseCsvRows, parseJsonRows } from './parse';
import { mapImportRow } from './map';
export async function previewImport(body: Uint8Array, format: 'csv' | 'json', mapping: Record<string, string>): Promise<{
    rows: Record<string, unknown>[];
    errors: {
        row: number;
        field: string;
        message: string;
    }[];
}> { const rows: Record<string, unknown>[] = []; const errors: {
    row: number;
    field: string;
    message: string;
}[] = []; let index = 0; try {
    const input = format === 'csv' ? parseCsvRows(body) : parseJsonRows(body);
    for await (const row of input) {
        index++;
        try {
            const mapped = mapImportRow(row, mapping);
            if (rows.length < 250)
                rows.push(mapped);
        }
        catch (e) {
            errors.push({ row: index, field: 'mapping', message: e instanceof Error ? e.message : 'Invalid row' });
            if (errors.length >= 250)
                break;
        }
    }
}
catch (e) {
    errors.push({ row: index + 1, field: 'file', message: e instanceof Error ? e.message : 'Invalid file' });
} return { rows, errors }; }
/** Validate every supplied immutable manifest part before an import can be labelled complete. */
export async function previewImportManifest(manifest: {
    snapshotHash: string;
    parts: {
        filename: string;
        sha256: string;
        rowCount: number;
    }[];
}, parts: {
    filename: string;
    body: Uint8Array;
}[], mapping: Record<string, string>) {
    const { createHash } = await import('node:crypto');
    if (!/^[a-f0-9]{64}$/.test(manifest.snapshotHash) || !manifest.parts.length || manifest.parts.length !== parts.length || new Set(manifest.parts.map(p => p.filename)).size !== manifest.parts.length || new Set(parts.map(p => p.filename)).size !== parts.length)
        throw new Error('Every unique manifest part is required');
    const previews = [];
    for (const entry of manifest.parts) {
        const part = parts.find(p => p.filename === entry.filename);
        if (!part || part.body.length > 16 * 1024 * 1024 || createHash('sha256').update(part.body).digest('hex') !== entry.sha256)
            throw new Error('Missing or tampered manifest part');
        let rows = 0;
        for await (const row of parseCsvRows(part.body)) {
            mapImportRow(row, mapping);
            rows++;
        }
        if (rows !== entry.rowCount)
            throw new Error('Manifest row count does not match');
        previews.push({ filename: entry.filename, ...await previewImport(part.body, 'csv', mapping) });
    }
    return { snapshotId: manifest.snapshotHash, complete: true as const, parts: previews };
}
