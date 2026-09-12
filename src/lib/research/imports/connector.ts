import type { SourceConnector } from '../contracts';
import { readResearchObject } from '../evidence';
import { parseCsvRows, parseJsonRows } from './parse';
import { mapImportRow } from './map';
import { envelope, encodeJson } from '../sources/common';
export type ImportSelection = {
    objectKey: string;
    format: 'csv' | 'json';
    mapping: Record<string, string>;
    snapshotId: string;
    partIndex: number;
    partCount: number;
    agreementId?: string;
};
export function createImportConnector(selection: ImportSelection, provider = 'research-import'): SourceConnector { return { provider, async fetchPage(context) { context.signal.throwIfAborted(); const cursor = context.cursor ? JSON.parse(context.cursor) : { offset: 0, snapshotId: selection.snapshotId }; if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || cursor.snapshotId !== selection.snapshotId)
        throw new Error('Invalid import cursor'); const body = await readResearchObject(selection.objectKey, context.signal); const records = []; let index = 0, more = false, missingIdentity=false;const seen=new Set<string>(); for await (const row of selection.format === 'csv' ? parseCsvRows(body) : parseJsonRows(body)) {
        context.signal.throwIfAborted();
        if (index++ < cursor.offset)
            continue;
        if (records.length === 250) {
            more = true;
            break;
        }
        const mapped = mapImportRow(row, selection.mapping);
        const suppliedId=typeof mapped.id==='string'||typeof mapped.id==='number'?String(mapped.id).trim():'';if(!suppliedId)missingIdentity=true;const providerId=suppliedId||`${selection.snapshotId}:${selection.partIndex}:${index}`;if(seen.has(providerId))throw new Error('Duplicate provider identity in import page');seen.add(providerId);records.push(envelope(context, providerId, `research-object:${selection.objectKey}`, encodeJson({ mapped, original: row }), 'application/json', { import: true, sourceObjectKey:selection.objectKey, agreementId: selection.agreementId ?? null, snapshotId: selection.snapshotId, partIndex: selection.partIndex, partCount: selection.partCount, row: index }));
    } return { records, nextCursor: more ? JSON.stringify({ offset: cursor.offset + records.length, snapshotId: selection.snapshotId }) : null, coverage: { complete: selection.partCount === 1&&!missingIdentity, notes: [...(selection.partCount > 1 ? ['This part is partial coverage until every verified manifest part has committed.'] : []),...(missingIdentity?['A stable provider id mapping is absent; rows are retained but revisions cannot be reconciled across imports.']:[])] } }; } }; }
