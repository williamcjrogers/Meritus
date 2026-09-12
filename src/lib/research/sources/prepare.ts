import type { SourceRecord } from '../contracts';
import { downloadResearchSnapshot } from '../evidence';
import { updateResearchJobPayload, getResearchObjectRegistration } from '../../db/research';
import { validateSourceJobPayload } from './selection';
export async function prepareSourceJob(input: {
    source: SourceRecord;
    jobId: string;
    leaseToken: number;
    payload: Record<string, unknown>;
    signal: AbortSignal;
}): Promise<Record<string, unknown>> { input.signal.throwIfAborted(); const payload = validateSourceJobPayload(input.source.provider, input.payload); if (input.source.provider !== 'payment-practices')
    return payload; const selection = payload.selection as {
    objectKey?: string;
    snapshotHash?: string;
}; if (selection.objectKey && selection.snapshotHash){const registered=await getResearchObjectRegistration(selection.objectKey);if(!registered||registered.sourceId!==input.source.id||registered.sha256!==selection.snapshotHash)throw new Error('Payment snapshot ownership or hash mismatch');return payload;} const snapshot = await downloadResearchSnapshot('https://check-payment-practices.service.gov.uk/export/csv/', { source: input.source, signal: input.signal, maxBytes: 1073741824, lease: { jobId: input.jobId, leaseToken: input.leaseToken } }); const prepared = { ...payload, selection: { objectKey: snapshot.objectKey, snapshotHash: snapshot.sha256 } }; input.signal.throwIfAborted(); if (!await updateResearchJobPayload(input.jobId, input.leaseToken, prepared))
    throw new Error('Research snapshot lease expired'); return prepared; }
