import type { ConnectorContext, SourceEnvelope } from '../contracts';
import { safeFetch } from '../safe-fetch';
import { decodeUtf8 } from '../extract/xml';
export function envelope(context: ConnectorContext, providerId: string, url: string, body: Uint8Array, contentType: string, metadata: Record<string, unknown> = {}): SourceEnvelope { return { sourceId: context.source.id, providerId, url, body, contentType, retrievedAt: new Date().toISOString(), publishedAt: null, updatedAt: null, eventAt: null, metadata: { provider: context.source.provider, ...metadata } }; }
export async function acquire(context: ConnectorContext, url: string, maxBytes = 10 * 1024 * 1024) { context.signal.throwIfAborted(); return safeFetch(url, { source: context.source, signal: context.signal, maxBytes }); }
export function jsonBody(bytes: Uint8Array): Record<string, unknown> { const value: unknown = JSON.parse(decodeUtf8(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected JSON object'); return value as Record<string, unknown>; }
export const encodeJson = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
export function checkedNext(next: string | null, initial: string, windowKeys: string[] = []): string | null { if (!next)
    return null; const base = new URL(initial), url = new URL(next, base); if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password)
    throw new Error('Untrusted pagination link'); for (const key of windowKeys)
    if (url.searchParams.get(key) !== base.searchParams.get(key))
        throw new Error('Pagination changed the fixed source window'); return url.href; }
