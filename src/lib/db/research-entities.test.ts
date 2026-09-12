// @vitest-environment node
// Synthetic evidence and actor IDs only.
import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({execute:vi.fn(),director:vi.fn()}));
vi.mock('./index',()=>({requireDb:()=>({execute:mocks.execute})}));
vi.mock('../research/roles',()=>({requireResearchDirector:mocks.director}));
import {PgDialect} from 'drizzle-orm/pg-core';
import {confirmEntityIdentifier,reviewCaseTreatment,searchReviewedEntities} from './research-entities';
const uuid='00000000-0000-4000-8000-000000000001';
const evidence={documentId:uuid,versionId:uuid,passageId:uuid};
beforeEach(()=>{vi.resetAllMocks();mocks.director.mockResolvedValue('synthetic-director');mocks.execute.mockResolvedValue({rows:[{id:uuid}]});});
it('requires a director before every evidence-backed mutation',async()=>{mocks.director.mockRejectedValue(new Error('forbidden'));await expect(confirmEntityIdentifier(uuid,{scheme:'GB-COH',value:'00001234',evidence,reason:'Synthetic director confirmation'})).rejects.toThrow('forbidden');expect(mocks.execute).not.toHaveBeenCalled();});
it('canonicalises procurement identifiers without fabricating identity or actor',async()=>{await confirmEntityIdentifier(uuid,{scheme:'GB-COH',value:'SC 012345',evidence,reason:'Synthetic director confirmation'});const query=new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);expect(query.params).toContain('uk-company-number');expect(query.params).toContain('SC012345');expect(query.params).toContain('synthetic-director');expect(query.sql).toContain('research_confirm_identifier');});
it('returns a friendly conflict when the globally unique identifier wins a concurrent transaction',async()=>{mocks.execute.mockRejectedValue({cause:{code:'23505',message:'research_verified_identifier'}});await expect(confirmEntityIdentifier(uuid,{scheme:'GB-COH',value:'00001234',evidence,reason:'Synthetic director confirmation'})).rejects.toMatchObject({code:'identifier_conflict',status:409});});
it('rejects missing source references and client-supplied reviewer flags',async()=>{await expect(confirmEntityIdentifier(uuid,{scheme:'GB-COH',value:'00001234',reason:'Synthetic director confirmation'})).rejects.toThrow();await expect(reviewCaseTreatment({fromDocumentId:uuid,toDocumentId:uuid,evidence,kind:'overrules',quotation:'Synthetic quote',targetReference:'Synthetic',reason:'Synthetic reviewed treatment',reviewed:true})).rejects.toThrow();expect(mocks.execute).not.toHaveBeenCalled();});
it('identifier searches require currently available evidence and workspace scope',async()=>{mocks.execute.mockResolvedValue({rows:[]});await searchReviewedEntities({scheme:'GB-COH',value:'00001234'});const query=new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);expect(query.sql).toContain('research_available_passages');expect(query.sql).toContain('workspace_id');expect(query.params).toContain('uk-company-number');});
