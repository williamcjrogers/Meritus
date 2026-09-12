import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { decodeUtf8 } from '../extract/xml';
export function validateColumns(columns: string[]): string[] { if (columns.length === 0 || columns.some(c => !c.trim()) || new Set(columns).size !== columns.length)
    throw new Error('CSV headers must be non-empty and unique'); return columns; }
export async function* parseCsvRows(body: Uint8Array): AsyncIterable<Record<string, string>> {
    if(body.length>32*1024*1024)throw new Error('CSV preview byte limit exceeded');decodeUtf8(body); const parser = Readable.from([body]).pipe(parse({ columns: validateColumns, bom: true, max_record_size: 1048576, skip_empty_lines: true })); let count = 0; for await (const row of parser) {
    if (++count > 500000)
        throw new Error('CSV row limit exceeded');
    yield row;
} }
export function parseJsonRows(body: Uint8Array): Record<string, unknown>[] { if (body.length > 32 * 1024 * 1024)
    throw new Error('JSON byte limit exceeded'); const value: unknown = JSON.parse(decodeUtf8(body)); const guard = (v: unknown, d: number) => { if (d > 30)
    throw new Error('JSON depth limit exceeded'); if (v && typeof v === 'object')
    for (const x of Object.values(v))
        guard(x, d + 1); }; guard(value, 0); if (!Array.isArray(value) || value.length > 500000 || value.some(v => !v || typeof v !== 'object' || Array.isArray(v)))
    throw new Error('JSON must be an array of objects within row limits'); return value; }
