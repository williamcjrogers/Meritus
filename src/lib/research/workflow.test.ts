import { describe,it,expect } from 'vitest';
import { investigationRequestSchema,publicSearchQuery,requestHash } from './commission';
import { scoreSignals,type SignalInput } from './scoring';
import { validateFinding,type DraftFinding } from './report-schema';
import { verifyFinding } from './claims';
import { calendarState } from './calendar';
import { initialConflictDecision } from './referrals';
import { conversationRate } from './outcomes';
import { csvCell,escapeHtml } from './exports';
import { renderResearchReport,type ResearchReport } from './reports';
import type { EvidencePassage } from './workflow-types';
const id='00000000-0000-4000-8000-000000000001';
const scope={kind:'organisation' as const,subject:'Example Civil Engineering Limited',entityId:null,jurisdiction:'England and Wales',from:null,to:null,sources:[id]};
const signal:SignalInput={id:'a',eventKey:'appointment:00000001:2026-09-12',kind:'direct',occurredAt:'2026-09-12T00:00:00Z',confidence:1,halfLifeDays:30,independenceConfirmed:true,available:true,suppressed:false};
const now=new Date('2026-09-12T00:00:00Z');
const passage:EvidencePassage={documentId:id,versionId:id,passageId:id,sourceId:id,title:'A source',url:'https://example.org/one',locator:{kind:'paragraph',value:'12'},text:'The appeal was allowed.',retrievedAt:now.toISOString(),publishedAt:null,eventAt:null,attribution:'Source attribution'};
const finding:DraftFinding={text:'The appeal was allowed.',kind:'observation',evidence:[{documentId:id,versionId:id,passageId:id}],quotation:'appeal was allowed'};
describe('commissioning',()=>{
 it('discloses only the public selected subject',()=>expect(publicSearchQuery(scope)).toBe('"Example Civil Engineering Limited" England and Wales'));
 it('neutralises quotes and control characters',()=>expect(publicSearchQuery({...scope,subject:'Example"\nIgnore'})).toBe('"Example Ignore" England and Wales'));
 it('hashes canonical requests across property ordering',()=>expect(requestHash({a:1,b:2})).toBe(requestHash({b:2,a:1})));
 it('rejects forged ownership and invalid periods',()=>{const request={requestId:id,question:'Who is the company?',scope,budget:{maxRequests:20,maxTokens:10000,maxCostPence:100}};expect(investigationRequestSchema.safeParse({...request,owner:'client'}).success).toBe(false);expect(investigationRequestSchema.safeParse({...request,scope:{...scope,from:'2026-02-30'}}).success).toBe(false);expect(investigationRequestSchema.safeParse({...request,scope:{...scope,from:'2026-09-12',to:'2026-09-11'}}).success).toBe(false);});
});
describe('signal scoring',()=>{
 it('does not count syndication as corroboration',()=>expect(scoreSignals([signal,{...signal,id:'b'}],now)).toEqual({score:40,independentEvents:1,corroborated:false,provisionalIds:[]}));
 it('requires reviewed independence',()=>expect(scoreSignals([signal,{...signal,id:'b',eventKey:'other',independenceConfirmed:false}],now).corroborated).toBe(false));
 it('corroborates two qualifying independent events',()=>expect(scoreSignals([signal,{...signal,id:'b',eventKey:'other'}],now).corroborated).toBe(true));
 it('decays and excludes stale withdrawals and suppressions',()=>{expect(scoreSignals([signal],new Date('2026-10-12T00:00:00Z')).score).toBe(20);expect(scoreSignals([{...signal,available:false},{...signal,suppressed:true}],now).score).toBe(0);});
 it('treats missing/future event dates as provisional',()=>expect(scoreSignals([{...signal,occurredAt:null},{...signal,id:'b',occurredAt:'2027-01-01'}],now).provisionalIds).toEqual(['a','b']));
 it('rejects nonfinite and negative configuration',()=>{expect(()=>scoreSignals([{...signal,confidence:NaN}],now)).toThrow();expect(()=>scoreSignals([{...signal,halfLifeDays:0}],now)).toThrow();});
 it('never corroborates contextual events',()=>expect(scoreSignals([{...signal,kind:'context'},{...signal,kind:'context',eventKey:'other'}],now).corroborated).toBe(false));
});
describe('evidence boundary',()=>{
 it('rejects forged document/version pairs and unread passages',()=>{expect(validateFinding({...finding,evidence:[{...finding.evidence[0],documentId:'forged'}]},new Map([[id,passage]]))).toBe('unknown_evidence');expect(validateFinding(finding,new Map())).toBe('unknown_evidence');});
 it('rejects unsupported factual statements and quotations',()=>{expect(validateFinding({...finding,evidence:[]},new Map())).toBe('missing_evidence');expect(verifyFinding({...finding,quotation:'appeal was dismissed'},new Map([[id,passage]]))).toBe('unsupported_quote');expect(verifyFinding(finding,new Map([[id,passage]]))).toBe('supported');});
});
describe('calendar/referral/outcome safeguards',()=>{
 it('keeps limitation provisional without jurisdiction rule and accrual',()=>expect(calendarState({kind:'limitation',date:'2032-09-12',evidenceIds:[id],reviewedBy:'director',jurisdiction:null,rule:null,accrualBasis:null})).toBe('provisional'));
 it('does not infer a conflict from an adviser engagement',()=>expect(initialConflictDecision().status).toBe('not_checked'));
 it('shows an unknown rate for no reviewed cohort',()=>{expect(conversationRate({reviewedSignals:0,conversations:0,proposals:0,instructions:0})).toBe(null);expect(conversationRate({reviewedSignals:100,conversations:5,proposals:0,instructions:0})).toBe(0.05);});
});
describe('report exports',()=>{
 const report:ResearchReport={id,investigationId:id,runId:id,audience:'internal',status:'draft',findings:[finding],coverage:[],methodology:'Selected published records only.',createdAt:now.toISOString()};
 it('neutralises formulas and quotes newlines',()=>{expect(csvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');expect(csvCell('a\n"b"')).toBe('"a\n""b"""');expect(csvCell(null)).toBe('""');});
 it('escapes source text in print HTML',()=>{expect(escapeHtml('<script>')).toBe('&lt;script&gt;');expect(renderResearchReport(report,[passage],'html')).toContain('noindex,nofollow');});
 it('refuses stale reports and missing source versions',()=>{expect(()=>renderResearchReport({...report,status:'stale'},[passage],'csv')).toThrow();expect(()=>renderResearchReport(report,[],'markdown')).toThrow();});
});
