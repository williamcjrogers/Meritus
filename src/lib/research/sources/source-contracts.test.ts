// @vitest-environment node
// All data in this file is constructed synthetic regression data.
import { expect, it } from 'vitest';
import { sourceMode } from './policy';
import { parseSafeXml } from '../extract/xml';
import { parseCsvPage } from '../imports/snapshot-page';
import { getConnector } from './registry';
import { resolveEntity } from '../entities/resolve';
it('keeps independent access and rejects hostile XML', () => { expect(sourceMode('court-listings', false)).toBe('import'); expect(sourceMode('find-case-law', true)).toBe('api'); expect(() => parseSafeXml('<!DOCTYPE a [<!ENTITY b "x">]><a>&b;</a>')).toThrow(); });
it('requires the complete job payload and validates selections', () => { expect(() => getConnector('companies-house', { selection: { companyNumber: '123' } })).toThrow(); expect(getConnector('unknown', {})).toBeNull(); });
async function* chunks(bytes: Uint8Array) { for (let i = 0; i < bytes.length; i += 3)
    yield bytes.slice(i, i + 3); }
it('resumes quoted UTF-8 records at exact source byte offsets', async () => { const prefix = '\uFEFFCompany,Note\r\nQCS,"one\ntwó"\r\n'; const bytes = new TextEncoder().encode(prefix + 'Example,three\r\n'); const first = await parseCsvPage(chunks(bytes), { nextByte: 0, columns: null }, 1); expect(first.nextByte).toBe(new TextEncoder().encode(prefix).length); const second = await parseCsvPage(chunks(bytes.slice(first.nextByte)), { nextByte: first.nextByte, columns: first.columns }, 250); expect(second.rows).toEqual([{ Company: 'Example', Note: 'three' }]); expect(second.nextByte).toBe(bytes.length); expect(second.complete).toBe(true); });
it('resolves only verified canonical identifiers', () => { const input = { kind: 'company' as const, name: 'Synthetic', jurisdiction: 'GB', identifiers: [{ scheme: 'GB-COH', value: '00001234' }] }; expect(resolveEntity(input, [{ ...input, id: 'a', verified: true, identifiers: [{ scheme: 'uk-company-number', value: '00001234' }] }]).entityId).toBe('a'); expect(resolveEntity({ ...input, identifiers: [] }, [{ ...input, id: 'a', verified: true }]).state).toBe('review'); });
