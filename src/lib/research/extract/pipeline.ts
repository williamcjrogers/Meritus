import type { SourceEnvelope, ExtractedEvidence } from '../contracts';
import { extractHtml } from './html';
import { extractPdf } from './pdf';
import { parseRemediationOds } from './ods';
import { parseLegalDocMl } from '../case-law/legaldocml';
import { decodeUtf8, xmlTree, descendants, xmlText } from './xml';
import { normaliseListing } from '../sources/court-listings';
import { paymentEvidence } from '../sources/payment-practices';
export const PARSER_VERSION = 'qcs-extract-v1';
async function extractContent(envelope: SourceEnvelope): Promise<ExtractedEvidence> {
    const type = envelope.contentType.split(';')[0].trim().toLowerCase();
    if (envelope.metadata.withdrawn === true)
        return { passages: [], facts: [], coverage: { complete: true, notes: ['Publisher record withdrawn; do not cite or display this document.'] } };
    if (envelope.metadata.provider === 'gazette' && ['application/atom+xml', 'application/xml', 'text/xml'].includes(type)) {
        const entry = descendants(xmlTree(decodeUtf8(envelope.body)), 'entry').find(n => { const id = descendants(n.children, 'id')[0]; return id && xmlText(id) === envelope.metadata.entryId; });
        if (!entry)
            throw new Error('Gazette source entry missing');
        return { passages: [{ locator: { kind: 'field', value: 'entry:' + envelope.metadata.entryId }, text: xmlText(entry) }], facts: [], coverage: { complete: true, notes: ['Notice statements retain their publisher status; a petition is not an order.'] } };
    }
    if (type === 'application/pdf')
        return extractPdf(envelope.body);
    if (type === 'application/vnd.oasis.opendocument.spreadsheet')
        return parseRemediationOds(envelope.body);
    if (type === 'text/html')
        return extractHtml(envelope.body);
    if (['application/akn+xml', 'application/xml', 'text/xml'].includes(type) && envelope.metadata.provider === 'find-case-law')
        return parseLegalDocMl(decodeUtf8(envelope.body));
    if (type === 'application/json') {
        const raw: unknown = JSON.parse(decodeUtf8(envelope.body));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new Error('Evidence JSON object required');
        const row = raw as Record<string, unknown>;
        if (envelope.metadata.provider === 'payment-practices')
            return paymentEvidence(row as Record<string, string>);
        if (envelope.metadata.provider === 'court-listings')
            return normaliseListing((row.mapped ?? row) as Record<string, unknown>);
        const passages: ExtractedEvidence['passages'] = [], facts: ExtractedEvidence['facts'] = [];
        const walk = (v: unknown, path: string, depth: number) => { if (depth > 30 || passages.length > 200000)
            throw new Error('Structured evidence limit exceeded'); if (v !== null && typeof v === 'object') {
            for (const [key, value] of Object.entries(v))
                walk(value, path + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'), depth + 1);
        }
        else {
            const locator = { kind: 'field' as const, value: path || '/' };
            passages.push({ locator, text: v === null ? 'null' : String(v) });
            facts.push({ predicate: 'source.field', value: v, locator, status: 'observation' });
        } };
        walk(raw, '', 0);
        return { passages, facts, coverage: { complete: true, notes: [] } };
    }
    if (type === 'text/plain') {
        const text = decodeUtf8(envelope.body);
        return { passages: text.trim() ? [{ locator: { kind: 'field', value: 'body' }, text }] : [], facts: [], coverage: { complete: !!text.trim(), notes: [] } };
    }
    return { passages: [], facts: [], coverage: { complete: false, notes: [`Unsupported content type ${type}; add a permitted manual passage.`] } };
}
export async function extractEnvelope(envelope: SourceEnvelope): Promise<ExtractedEvidence> { envelope.metadata.parserVersion = PARSER_VERSION; const result = await extractContent(envelope); envelope.metadata.passageOrder = result.passages.map(p => p.locator.kind + ':' + p.locator.value); return result; }
