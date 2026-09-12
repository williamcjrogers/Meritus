import { z } from 'zod';
import type { EvidenceRef } from './workflow-types';
export type { EvidenceRef } from './workflow-types';
export const evidenceRefSchema=z.object({documentId:z.uuid(),versionId:z.uuid(),passageId:z.uuid()}).strict();
export const draftFindingSchema=z.object({text:z.string().trim().min(1).max(4000),kind:z.enum(['observation','allegation','inference']),evidence:z.array(evidenceRefSchema).max(30),quotation:z.string().max(4000).optional()}).strict();
export type DraftFinding=z.infer<typeof draftFindingSchema>;
export const answerSchema=z.object({findings:z.array(draftFindingSchema).max(30),limitations:z.array(z.string().max(1000)).max(20)});
export function validateFinding(finding:DraftFinding,permitted:ReadonlyMap<string,EvidenceRef>):'valid'|'missing_evidence'|'unknown_evidence'{
 if(finding.kind!=='inference'&&!finding.evidence.length)return 'missing_evidence';
 return finding.evidence.some(ref=>{const actual=permitted.get(ref.passageId);return !actual||actual.documentId!==ref.documentId||actual.versionId!==ref.versionId;})?'unknown_evidence':'valid';
}
