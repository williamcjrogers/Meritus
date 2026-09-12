vi.mock('../../db/research-case-law',()=>({listCaseLawRecheckTargets:vi.fn(),getCaseLawRecheckTarget:vi.fn()}));
import {listCaseLawRecheckTargets,getCaseLawRecheckTarget} from '../../db/research-case-law';
// @vitest-environment node
// All responses are synthetic contract regressions, never captured provider evidence.
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../safe-fetch', () => ({ safeFetch: vi.fn(), registerProviderHeaders: vi.fn() }));
vi.mock('../evidence', () => ({ readResearchObject: vi.fn(), readResearchObjectStream: vi.fn(), downloadResearchSnapshot: vi.fn() }));
vi.mock('../../db/research', () => ({ updateResearchJobPayload: vi.fn(),getResearchObjectRegistration:vi.fn() }));
import { safeFetch } from '../safe-fetch';
import { readResearchObjectStream, downloadResearchSnapshot } from '../evidence';
import { updateResearchJobPayload,getResearchObjectRegistration } from '../../db/research';
import { createCompaniesHouseConnector, companyResourceUrl, nextCompanyOffset } from './companies-house';
import { createOcdsConnector, ocdsUrl, releaseIdentity } from './ocds';
import { createCaseLawConnector } from './find-case-law';
import { createPaymentConnector } from './payment-practices';
import { prepareSourceJob } from './prepare';
import { gazetteAllowedAt, classifyInsolvency, gazetteRobotsAllows } from './gazette';
import { ResearchFetchError } from '../errors';
import { extractEnvelope } from '../extract/pipeline';
import type { ConnectorContext } from '../contracts';
const body = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const context = (provider: string, cursor: string | null = null): ConnectorContext => ({ source: { id: 'source', provider, hosts: ['example.test'], status: 'ready', credentialRef: provider === 'companies-house' ? 'RESEARCH_CH_KEY' : null }, cursor, window: { from: '2026-09-10T00:00:00Z', to: '2026-09-11T00:00:00Z' }, signal: new AbortController().signal });
const reply = (value: unknown, status = 200, contentType = 'application/json') => ({ url: 'https://example.test/source', contentType, body: Buffer.from(body(value)), status });
beforeEach(() => vi.resetAllMocks());
it('Companies House retains prefixes and paginates resigned records', async () => { expect(new URL(companyResourceUrl('SC012345', 'officers', 20)).searchParams.get('start_index')).toBe('20'); expect(nextCompanyOffset(20, 3, 23)).toBeNull(); expect(() => nextCompanyOffset(0, 0, 23)).toThrow(); vi.mocked(safeFetch).mockResolvedValue(reply({ items: [{ name: 'Synthetic', resigned_on: '2020-01-01' }], total_results: 2 })); const page = await createCompaniesHouseConnector({ companyNumber: 'SC012345' }).fetchPage(context('companies-house', JSON.stringify({ resource: 'officers', startIndex: 0 }))); expect(JSON.parse(page.nextCursor!)).toEqual({ resource: 'officers', startIndex: 1 }); expect(JSON.parse(new TextDecoder().decode(page.records[0].body)).items[0].resigned_on).toBe('2020-01-01'); });
it('procurement preserves source currencies and rejects changed or malicious next URLs', async () => { const ctx = context('find-a-tender'); expect(new URL(ocdsUrl('contracts-finder', ctx.window)).searchParams.has('publishedFrom')).toBe(true); expect(releaseIdentity({ ocid: 'synthetic', id: 'one' })).toBe('synthetic:one'); vi.mocked(safeFetch).mockResolvedValue(reply({ version: '1.1', releases: [{ ocid: 'synthetic', id: 'one', awards: [{ value: { amount: 1, currency: 'GBP' } }], contracts: [{ value: { amount: 2, currency: 'USD' } }] }], links: { next: 'https://attacker.test/' } })); await expect(createOcdsConnector('find-a-tender').fetchPage(ctx)).rejects.toThrow('pagination'); });
it('a procurement rate-limit leaves retry state to the runner', async () => { vi.mocked(safeFetch).mockRejectedValue(new ResearchFetchError('forbidden', 403)); await expect(createOcdsConnector('contracts-finder').fetchPage(context('contracts-finder'))).rejects.toMatchObject({ retryAfterMs: 300000 }); });
it('Find Case Law 404 produces a tombstone; 429 never does', async () => { const entry = { uri: 'd-synthetic', title: 'Synthetic', identifiers: [], xmlUrl: 'https://example.test/case.xml', pdfUrl: null, publishedAt: null, transformedAt: null, contentHash: null }; const cursor = JSON.stringify({ feedUrl: 'https://caselaw.nationalarchives.gov.uk/atom.xml', entries: [entry], next: null }); vi.mocked(safeFetch).mockResolvedValue(reply('missing', 404, 'text/plain')); const page = await createCaseLawConnector({}).fetchPage(context('find-case-law', cursor)); expect(page.records[0].metadata.withdrawn).toBe(true); expect(page.records[0].metadata.httpStatus).toBe(404); expect((await extractEnvelope(page.records[0])).coverage.complete).toBe(true); vi.mocked(safeFetch).mockRejectedValue(new ResearchFetchError('rate_limited', 429, 1000)); await expect(createCaseLawConnector({}).fetchPage(context('find-case-law', cursor))).rejects.toMatchObject({ status: 429 }); });
it('preparation fences the immutable payment selection', async () => { const ctx = context('payment-practices'); const snapshot = { objectKey: 'prefix/research/snapshots/synthetic', sha256: 'a'.repeat(64), bytes: 12, contentType: 'text/csv' }; vi.mocked(downloadResearchSnapshot).mockResolvedValue(snapshot); vi.mocked(updateResearchJobPayload).mockResolvedValue(false); await expect(prepareSourceJob({ source: ctx.source, jobId: 'job', leaseToken: 2, payload: { window: ctx.window, selection: {} }, signal: ctx.signal })).rejects.toThrow('lease'); vi.mocked(updateResearchJobPayload).mockResolvedValue(true); const result = await prepareSourceJob({ source: ctx.source, jobId: 'job', leaseToken: 3, payload: { window: ctx.window, selection: {} }, signal: ctx.signal }); expect(result.window).toEqual(ctx.window); expect(result.selection).toEqual({ objectKey: snapshot.objectKey, snapshotHash: snapshot.sha256 }); });
it('payment resumes a bounded snapshot and preserves missing measures', async () => { async function* stream() { yield body('Report Id,Company number,Average time to pay\nsynthetic,00001234,\n'); } vi.mocked(readResearchObjectStream).mockResolvedValue(stream()); const page = await createPaymentConnector({ objectKey: 'research/synthetic', snapshotHash: 'a'.repeat(64) }).fetchPage(context('payment-practices')); expect(page.nextCursor).toBeNull(); expect(page.records[0].providerId).toBe('synthetic'); const extracted = await extractEnvelope(page.records[0]); expect(extracted.facts.find(f => f.predicate === 'payment.Average time to pay')?.value).toBeNull(); });
it('Gazette observes London seasons and keeps petitions distinct', () => { expect(gazetteAllowedAt(new Date('2026-09-12T12:00:00Z'))).toBe(false); expect(gazetteAllowedAt(new Date('2026-09-12T20:00:00Z'))).toBe(true); expect(gazetteAllowedAt(new Date('2026-01-12T20:00:00Z'))).toBe(false); expect(classifyInsolvency('2450')).toBe('petition'); expect(gazetteRobotsAllows('User-agent: *\nDisallow: /notice/', '/notice/synthetic/data.xml')).toBe(false); });
it('cancelled selections never acquire a source', async () => { const ctx = context('companies-house'); ctx.signal = AbortSignal.abort(); await expect(createCompaniesHouseConnector({ companyNumber: '00001234' }).fetchPage(ctx)).rejects.toThrow(); expect(safeFetch).not.toHaveBeenCalled(); });

it('transformation windows stop before old documents and skip updates beyond the frozen upper bound',async()=>{
 const entry={uri:'d-synthetic',title:'Synthetic',identifiers:[],xmlUrl:'https://example.test/case.xml',pdfUrl:null,publishedAt:null,transformedAt:'2026-09-01T00:00:00Z',contentHash:null};
 const cursor=JSON.stringify({feedUrl:'https://caselaw.nationalarchives.gov.uk/atom.xml',entries:[entry],next:'https://caselaw.nationalarchives.gov.uk/atom.xml?page=2'});
 const page=await createCaseLawConnector({}).fetchPage(context('find-case-law',cursor));expect(page.nextCursor).toBeNull();expect(page.records).toEqual([]);expect(safeFetch).not.toHaveBeenCalled();
 const future=JSON.stringify({feedUrl:'https://caselaw.nationalarchives.gov.uk/atom.xml',entries:[{...entry,transformedAt:'2026-09-12T00:00:00Z'}],next:null});
 expect((await createCaseLawConnector({}).fetchPage(context('find-case-law',future))).records).toEqual([]);expect(safeFetch).not.toHaveBeenCalled();
});
it('confirmed 410 withdrawals complete processing',async()=>{
 const entry={uri:'d-synthetic',title:'Synthetic',identifiers:[],xmlUrl:'https://example.test/case.xml',pdfUrl:null,publishedAt:null,transformedAt:null,contentHash:null};
 vi.mocked(safeFetch).mockResolvedValue(reply('gone',410,'text/plain'));
 const page=await createCaseLawConnector({}).fetchPage(context('find-case-law',JSON.stringify({feedUrl:'https://caselaw.nationalarchives.gov.uk/atom.xml',entries:[entry],next:null})));
 expect(page.coverage.complete).toBe(true);expect(page.records[0].metadata.httpStatus).toBe(410);
});
it('reconciles documents missing from the feed and holds restoration for review',async()=>{
 const target={id:'00000000-0000-4000-8000-000000000001',providerId:'d-known',url:'https://example.test/known.xml',status:'available',metadata:{title:'Known synthetic'},publishedAt:null,updatedAt:null};
 vi.mocked(listCaseLawRecheckTargets).mockResolvedValue([target]);vi.mocked(getCaseLawRecheckTarget).mockResolvedValue(target);vi.mocked(safeFetch).mockResolvedValue(reply('missing',404,'text/plain'));
 const connector=createCaseLawConnector({mode:'reconcile'});const absent=await connector.fetchPage(context('find-case-law'));expect(absent.records[0].providerId).toBe('d-known');expect(absent.records[0].metadata.withdrawn).toBe(true);expect(absent.coverage.complete).toBe(false);
 vi.mocked(getCaseLawRecheckTarget).mockResolvedValue({...target,status:'unavailable'});vi.mocked(safeFetch).mockResolvedValue(reply('restored source',200,'text/plain'));
 const restored=await connector.fetchPage(context('find-case-law'));expect(restored.records[0].metadata.requiresRestorationReview).toBe(true);expect(restored.coverage.complete).toBe(false);
 vi.mocked(safeFetch).mockRejectedValue(new ResearchFetchError('rate_limited',429,1000));await expect(connector.fetchPage(context('find-case-law'))).rejects.toMatchObject({status:429});
});
it('rejects a prepared snapshot whose registered hash or owner differs',async()=>{vi.mocked(getResearchObjectRegistration).mockResolvedValue({objectKey:'prefix/research/synthetic',sourceId:'different-source',sha256:'b'.repeat(64),size:10});const ctx=context('payment-practices');await expect(prepareSourceJob({source:ctx.source,jobId:'job',leaseToken:1,payload:{window:ctx.window,selection:{objectKey:'prefix/research/synthetic',snapshotHash:'a'.repeat(64)}},signal:ctx.signal})).rejects.toThrow('ownership or hash');expect(downloadResearchSnapshot).not.toHaveBeenCalled();});
