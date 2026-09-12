import { createReadStream } from 'node:fs';
import { mkdir, writeFile, open, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { Transform } from 'node:stream';
import { parse } from 'csv-parse';
const validateColumns = (columns: string[]) => { if (columns.some(c => !c.trim()) || new Set(columns).size !== columns.length)
    throw new Error('Invalid CSV headers'); return columns; };
export type CsvManifest = {
    snapshotHash: string;
    parts: {
        filename: string;
        sha256: string;
        rowCount: number;
    }[];
};
const csvRecord = (cells: string[]) => cells.map(cell => /[",\r\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell).join(',') + '\r\n';
export async function splitCsv(inputPath: string, outputDir: string, maxPartBytes: number): Promise<CsvManifest> { if (!Number.isSafeInteger(maxPartBytes) || maxPartBytes < 32 || maxPartBytes > 16 * 1024 * 1024)
    throw new Error('Part size must be between 32 bytes and 16 MiB'); await mkdir(outputDir, { recursive: true }); const hash = createHash('sha256'); const input = createReadStream(inputPath); const hashing = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); callback(null, chunk); } }); const parser = input.pipe(hashing).pipe(parse({ bom: true, max_record_size: 1048576, skip_empty_lines: true })); const parts: CsvManifest['parts'] = []; let header: Buffer | null = null; let file: Awaited<ReturnType<typeof open>> | null = null; let partHash = createHash('sha256'); let size = 0, rowCount = 0, filename = ''; const close = async () => { if (file) {
    await file.close();
    parts.push({ filename, sha256: partHash.digest('hex'), rowCount });
    file = null;
} }; const start = async () => { filename = `part-${String(parts.length + 1).padStart(4, '0')}.csv`; file = await open(join(outputDir, filename), 'wx'); partHash = createHash('sha256'); size = header!.length; rowCount = 0; await file.write(header!); partHash.update(header!); }; try {
    for await (const cells of parser) {
        if (!header) {
            validateColumns(cells);
            header = Buffer.from(csvRecord(cells));
            if (header.length >= maxPartBytes)
                throw new Error('CSV header exceeds part limit');
            continue;
        }
        const row = Buffer.from(csvRecord(cells));
        if (header.length + row.length > maxPartBytes)
            throw new Error('CSV record exceeds part limit');
        if (!file)
            await start();
        if (size + row.length > maxPartBytes) {
            await close();
            await start();
        }
        await file!.write(row);
        partHash.update(row);
        size += row.length;
        rowCount++;
    }
    if (!header)
        throw new Error('CSV header missing');
    if (!file && parts.length === 0)
        await start();
    await close();
    const manifest = { snapshotHash: hash.digest('hex'), parts };
    await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return manifest;
}
finally {
    await (file as Awaited<ReturnType<typeof open>> | null)?.close();
    input.destroy();
    hashing.destroy();
    parser.destroy();
} }
export async function verifyCsvManifest(directory: string, manifest: CsvManifest): Promise<void> { if (!/^[a-f0-9]{64}$/.test(manifest.snapshotHash) || !manifest.parts.length || new Set(manifest.parts.map(p => p.filename)).size !== manifest.parts.length)
    throw new Error('Invalid CSV manifest'); for (const part of manifest.parts) {
    if (basename(part.filename) !== part.filename || !part.filename.endsWith('.csv'))
        throw new Error('Unsafe manifest filename');
    const bytes = await readFile(join(directory, part.filename));
    if (bytes.length > 16 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== part.sha256)
        throw new Error('Missing or tampered CSV part');
} }
