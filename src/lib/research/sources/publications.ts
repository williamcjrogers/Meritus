import type { SourceConnector } from '../contracts';
import { acquire, envelope } from './common';
export type PublicationSelection = {
    url: string;
    kind: 'programme' | 'accounts' | 'rns' | 'news' | 'recruitment';
    subjectId: string;
};
export function publicationEvidenceWeight(kind: PublicationSelection['kind']): 'primary' | 'contextual' { return kind === 'news' || kind === 'recruitment' ? 'contextual' : 'primary'; }
export function createPublicationConnector(selection: PublicationSelection): SourceConnector { return { provider: 'publications', async fetchPage(context) { if (context.cursor)
        throw new Error('Single publication does not accept a cursor'); const response = await acquire(context, selection.url, 32 * 1024 * 1024); if (response.status === 404 || response.status === 410)
        throw new Error('Publication unavailable'); return { records: [envelope(context, selection.url, response.url, response.body, response.contentType, { subjectId: selection.subjectId, publicationKind: selection.kind, evidenceWeight: publicationEvidenceWeight(selection.kind), originalUrl: selection.url })], nextCursor: null, coverage: { complete: true, notes: ['Publication statements remain attributed observations. Recruitment and news are contextual signals.'] } }; } }; }
