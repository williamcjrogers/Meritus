// @vitest-environment node
// Synthetic fixtures only.
import { expect, it } from 'vitest';
import { parseCsvRows, parseJsonRows } from './parse';
import { parseCsvPage } from './snapshot-page';
import { previewImport } from './preview';
const bytes = (s: string) => new TextEncoder().encode(s);
async function all(body: Uint8Array) { const rows = []; for await (const row of parseCsvRows(body))
    rows.push(row); return rows; }
async function* chunks(body: Uint8Array) { for (let i = 0; i < body.length; i += 3)
    yield body.slice(i, i + 3); }
it('preserves leading zeroes, missing values and quoted newlines', async () => expect(await all(bytes('Company number,Average time to pay,Note\r\n00001234,,"line one\nline two"\r\n'))).toEqual([{ 'Company number': '00001234', 'Average time to pay': '', Note: 'line one\nline two' }]));
it('rejects duplicate headers and invalid JSON arrays', async () => { await expect(all(bytes('a,a\n1,2'))).rejects.toThrow(); expect(() => parseJsonRows(bytes('{}'))).toThrow(); expect(() => parseJsonRows(bytes('[1]'))).toThrow(); });
it('resumes at complete UTF-8 records including BOM', async () => { const prefix = '\uFEFFCompany,Note\r\nQCS,"one\ntwó"\r\n', body = bytes(prefix + 'Example,three\r\n'); const first = await parseCsvPage(chunks(body), { nextByte: 0, columns: null }, 1); expect(first.nextByte).toBe(bytes(prefix).length); expect(first.complete).toBe(false); const second = await parseCsvPage(chunks(body.slice(first.nextByte)), { nextByte: first.nextByte, columns: first.columns }, 250); expect(second.rows).toEqual([{ Company: 'Example', Note: 'three' }]); expect(second.complete).toBe(true); expect(second.nextByte).toBe(body.length); });
it('reports exact page termination and rejects truncated quoting', async () => { expect((await parseCsvPage(chunks(bytes('a\n1\n2\n')), { nextByte: 0, columns: null }, 2)).complete).toBe(true); await expect(parseCsvPage(chunks(bytes('a\n"broken')), { nextByte: 0, columns: null }, 2)).rejects.toThrow(); });
it('mapping errors are visible and formula text stays inert', async () => { expect((await previewImport(bytes('id,name\n1,=SUM(A1)'), 'csv', { id: 'absent' })).errors).toHaveLength(1); expect((await previewImport(bytes('id,name\n1,=SUM(A1)'), 'csv', { name: 'name' })).rows).toEqual([{ name: '=SUM(A1)' }]); });
it('propagates interrupted streams and invalid UTF-8 without committing a page',async()=>{async function* interrupted(){yield bytes('a\n');throw new Error('interrupted source');}await expect(parseCsvPage(interrupted(),{nextByte:0,columns:null},250)).rejects.toThrow('interrupted source');async function* invalid(){yield new Uint8Array([97,10,255,10]);}await expect(parseCsvPage(invalid(),{nextByte:0,columns:null},250)).rejects.toThrow();});
it('accounts for a header-only snapshot and trailing empty records',async()=>{const source=bytes('a\n\n');const page=await parseCsvPage(chunks(source),{nextByte:0,columns:null},250);expect(page.rows).toEqual([]);expect(page.nextByte).toBe(source.length);expect(page.complete).toBe(true);});
