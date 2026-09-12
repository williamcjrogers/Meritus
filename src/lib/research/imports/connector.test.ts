// @vitest-environment node
// Synthetic provider imports; no commercial provider contract is asserted.
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('../evidence',()=>({readResearchObject:vi.fn()}));
import {readResearchObject} from '../evidence';
import {createImportConnector} from './connector';
import {previewImportManifest} from './preview';
import {createHash} from 'node:crypto';
import type {ConnectorContext} from '../contracts';
const context:ConnectorContext={source:{id:'source',provider:'commercial-import',hosts:[],status:'ready',credentialRef:null},window:{from:'2026-01-01T00:00:00Z',to:'2026-09-12T00:00:00Z'},cursor:null,signal:new AbortController().signal};
const selection={objectKey:'prefix/research/synthetic',format:'csv' as const,mapping:{id:'Project ID',company:'Company'},snapshotId:'synthetic-snapshot-a',partIndex:0,partCount:1,agreementId:'synthetic-agreement'};
beforeEach(()=>vi.resetAllMocks());
it('preserves provider identity across successive exports and retains unmapped source fields',async()=>{vi.mocked(readResearchObject).mockResolvedValue(Buffer.from('Project ID,Company,Unknown\n0007,Synthetic,unchanged\n'));const first=await createImportConnector(selection,'commercial-import').fetchPage(context);const second=await createImportConnector({...selection,snapshotId:'synthetic-snapshot-b'},'commercial-import').fetchPage(context);expect(first.records[0].providerId).toBe('0007');expect(second.records[0].providerId).toBe('0007');expect(JSON.parse(new TextDecoder().decode(first.records[0].body)).original.Unknown).toBe('unchanged');expect(first.coverage.complete).toBe(true);});
it('reports missing stable identity and rejects duplicate provider identifiers',async()=>{vi.mocked(readResearchObject).mockResolvedValue(Buffer.from('Project ID,Company\n7,Synthetic\n'));expect((await createImportConnector({...selection,mapping:{company:'Company'}}).fetchPage(context)).coverage.complete).toBe(false);vi.mocked(readResearchObject).mockResolvedValue(Buffer.from('Project ID,Company\n7,Synthetic\n7,Another\n'));await expect(createImportConnector(selection).fetchPage(context)).rejects.toThrow('Duplicate');});
it('requires all manifest parts and verifies hashes plus row counts',async()=>{const body=Buffer.from('id,name\n7,Synthetic\n'),hash=createHash('sha256').update(body).digest('hex');const manifest={snapshotHash:'a'.repeat(64),parts:[{filename:'part-0001.csv',sha256:hash,rowCount:1}]};await expect(previewImportManifest(manifest,[],{id:'id'})).rejects.toThrow();await expect(previewImportManifest(manifest,[{filename:'part-0001.csv',body:Buffer.from('tampered')}],{id:'id'})).rejects.toThrow('tampered');expect((await previewImportManifest(manifest,[{filename:'part-0001.csv',body}],{id:'id'})).complete).toBe(true);});
