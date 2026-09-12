import {registerSourceAuthentication} from './auth';
import { ResearchFetchError } from '../errors';
import type { SourceConnector } from '../contracts';
import { acquire, envelope, jsonBody } from './common';
const resources = ['profile', 'officers', 'filings', 'charges', 'insolvency'] as const;
type Resource = typeof resources[number];
export function companyResourceUrl(companyNumber: string, resource: Resource, startIndex = 0): string { const number = companyNumber.replace(/\s+/g, '').toUpperCase(); if (!/^[A-Z0-9]{8}$/.test(number) || !Number.isSafeInteger(startIndex) || startIndex < 0)
    throw new Error('Invalid Companies House selection'); const path = resource === 'profile' ? '' : resource === 'filings' ? '/filing-history' : '/' + resource; const url = new URL(`https://api.company-information.service.gov.uk/company/${number}${path}`); if (['officers', 'filings', 'charges'].includes(resource)) {
    url.searchParams.set('start_index', String(startIndex));
    url.searchParams.set('items_per_page', '100');
} return url.href; }
export function nextCompanyOffset(start: number, items: number, total: number): number | null { if (![start, items, total].every(n => Number.isSafeInteger(n) && n >= 0) || start + items > total || (items === 0 && start < total))
    throw new Error('Incomplete Companies House page'); return start + items < total ? start + items : null; }
export function createCompaniesHouseConnector(selection: {
    companyNumber: string;
}): SourceConnector { registerSourceAuthentication();return { provider: 'companies-house', async fetchPage(context) { context.signal.throwIfAborted(); if (!context.source.credentialRef)
        throw new ResearchFetchError('credential_missing', 401); const cursor = context.cursor ? JSON.parse(context.cursor) : { resource: 'profile', startIndex: 0 }; if (!resources.includes(cursor.resource) || !Number.isSafeInteger(cursor.startIndex) || cursor.startIndex < 0)
        throw new Error('Invalid Companies House cursor'); const resource = cursor.resource as Resource; const url = companyResourceUrl(selection.companyNumber, resource, cursor.startIndex); const response = await acquire(context, url); const absent = response.status === 404; const body = absent ? {} : jsonBody(response.body); let next: number | null = null; if (!absent && ['officers', 'filings', 'charges'].includes(resource)) {
        if (!Array.isArray(body.items))
            throw new Error('Missing Companies House items');
        next = nextCompanyOffset(cursor.startIndex, body.items.length, Number(body.total_results ?? body.total_count));
    } const index = resources.indexOf(resource); const nextCursor = next !== null ? JSON.stringify({ resource, startIndex: next }) : index < resources.length - 1 ? JSON.stringify({ resource: resources[index + 1], startIndex: 0 }) : null; return { records: [envelope(context, `${selection.companyNumber}:${resource}:${cursor.startIndex}`, response.url, response.body, response.contentType, { companyNumber: selection.companyNumber, resource, observedAbsence: absent })], nextCursor, coverage: { complete: !absent, notes: absent ? [`No ${resource} resource was available for this request; this is not proof of solvency.`] : [] } }; } }; }
