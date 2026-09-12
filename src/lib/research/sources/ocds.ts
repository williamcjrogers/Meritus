import type { SourceConnector } from '../contracts';
import { ResearchFetchError } from '../errors';
import { acquire, checkedNext, envelope, jsonBody, encodeJson } from './common';
type Provider = 'find-a-tender' | 'contracts-finder';
export function ocdsUrl(provider: Provider, window: {
    from: string;
    to: string;
}): string { const url = new URL(provider === 'find-a-tender' ? 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages' : 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search'); const clock = provider === 'find-a-tender' ? 'updated' : 'published'; url.searchParams.set(clock + 'From', window.from); url.searchParams.set(clock + 'To', window.to); url.searchParams.set('limit', '100'); return url.href; }
export function releaseIdentity(release: {
    ocid: string;
    id: string;
}): string { if (!release.ocid || !release.id)
    throw new Error('Missing OCDS release identity'); return `${release.ocid}:${release.id}`; }
export function createOcdsConnector(provider: Provider): SourceConnector { return { provider, async fetchPage(context) { const initial = ocdsUrl(provider, context.window); const keys = provider === 'find-a-tender' ? ['updatedFrom', 'updatedTo'] : ['publishedFrom', 'publishedTo']; const url = context.cursor ? checkedNext(context.cursor, initial, keys)! : initial; let response; try {
        response = await acquire(context, url, 20 * 1024 * 1024);
    }
    catch (error) {
        if (provider === 'contracts-finder' && error instanceof ResearchFetchError && error.status === 403)
            throw new ResearchFetchError('rate_limited', 403, 300000);
        throw error;
    } const data = jsonBody(response.body); if (!Array.isArray(data.releases) || typeof data.version !== 'string')
        throw new Error('Invalid OCDS release package'); const records = data.releases.map((raw: unknown) => { if (!raw || typeof raw !== 'object')
        throw new Error('Invalid OCDS release'); const release = raw as Record<string, unknown>; if (typeof release.ocid !== 'string' || typeof release.id !== 'string')
        throw new Error('Missing OCDS identifiers'); return { ...envelope(context, releaseIdentity({ ocid: release.ocid, id: release.id }), url, encodeJson(release), 'application/json', { ocdsVersion: data.version, extensions: data.extensions ?? [], publisher: data.publisher, packageUri: data.uri, performanceSchemaValidated: false }), publishedAt: typeof release.date === 'string' ? release.date : null }; }); const links = data.links as {
        next?: unknown;
    } | undefined; const next = typeof links?.next === 'string' ? links.next : null; return { records, nextCursor: checkedNext(next, initial, keys), coverage: { complete: true, notes: ['Performance and failure extensions are preserved as source observations; publisher schema validation is required before interpreting adverse performance.'] } }; } }; }
