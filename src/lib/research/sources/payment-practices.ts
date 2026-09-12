import type { SourceConnector, ExtractedEvidence } from '../contracts';
import { readResearchObjectStream } from '../evidence';
import { parseCsvPage } from '../imports/snapshot-page';
import { envelope, encodeJson } from './common';
export function createPaymentConnector(selection: {
    objectKey: string;
    snapshotHash: string;
}): SourceConnector { return { provider: 'payment-practices', async fetchPage(context) { const cursor = context.cursor ? JSON.parse(context.cursor) : { snapshotHash: selection.snapshotHash, objectKey: selection.objectKey, nextByte: 0, columns: null, rowNumber: 0 }; if (cursor.snapshotHash !== selection.snapshotHash || cursor.objectKey !== selection.objectKey || !Number.isSafeInteger(cursor.rowNumber) || cursor.rowNumber < 0)
        throw new Error('Payment snapshot cursor mismatch'); const stream = await readResearchObjectStream(selection.objectKey, context.signal, cursor.nextByte); const page = await parseCsvPage(stream, cursor, 250); const seen = new Set<string>(); const records = page.rows.map((row, i) => { const id = row['Report Id']; if (!id?.trim() || seen.has(id))
        throw new Error('Missing or duplicate Payment Practices Report Id'); seen.add(id); validatePaymentRow(row); const reportUrl = row.URL && /^https:\/\/check-payment-practices\.service\.gov\.uk\//.test(row.URL) ? row.URL : 'https://check-payment-practices.service.gov.uk/export/csv/'; return envelope(context, id, reportUrl, encodeJson(row), 'application/json', { snapshotHash: selection.snapshotHash, rowNumber: cursor.rowNumber + i + 1, sourceObjectKey: selection.objectKey }); }); context.signal.throwIfAborted(); return { records, nextCursor: page.complete ? null : JSON.stringify({ ...cursor, nextByte: page.nextByte, columns: page.columns, rowNumber: cursor.rowNumber + page.rows.length }), coverage: { complete: true, notes: page.complete ? [] : ['Payment snapshot is still being processed; do not reconcile deletions.'] } }; } }; }
export function validatePaymentRow(row: Record<string, string>): void { for (const [key, value] of Object.entries(row)) {
    if (value === '' || value === 'N/A')
        continue;
    if (/date/i.test(key) && !reportedDate(value))
        throw new Error(`Invalid payment date: ${key}`);
    if (/percent|percentage|%/i.test(key)) {
        const n = Number(value.replace('%', ''));
        if (!Number.isFinite(n) || n < 0 || n > 100)
            throw new Error(`Invalid payment percentage: ${key}`);
    }
} }
export function paymentEvidence(row: Record<string, string>): ExtractedEvidence { return { passages: Object.entries(row).map(([value, text]) => ({ locator: { kind: 'field', value }, text })), facts: Object.entries(row).map(([field, value]) => ({ predicate: 'payment.' + field, value: value === '' ? null : value, locator: { kind: 'field', value: field }, status: 'observation' })), coverage: { complete: true, notes: ['Reported measures require compatible policy regimes and report durations before comparison; missing measures are not zero.'] } }; }
export function reportedDate(value: string): string | null { let y: number, m: number, d: number; const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value), uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value); if (iso)
    [y, m, d] = iso.slice(1).map(Number);
else if (uk) {
    [d, m, y] = uk.slice(1).map(Number);
}
else
    return null; const date = new Date(Date.UTC(y, m - 1, d)); return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null; }
export function paymentPeriodsComparable(a: Record<string, string>, b: Record<string, string>): boolean { const duration = (row: Record<string, string>) => { const from = reportedDate(row['Start date'] ?? ''), to = reportedDate(row['End date'] ?? ''); return from && to ? Date.parse(to) - Date.parse(from) : null; }; const x = duration(a), y = duration(b); return Boolean(a['Policy Regime'] && a['Policy Regime'] === b['Policy Regime'] && x !== null && y !== null && x >= 0 && Math.abs(x - y) <= 3 * 86400000); }
