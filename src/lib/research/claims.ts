import type { EvidencePassage } from './workflow-types';
import { validateFinding,type DraftFinding } from './report-schema';
export function verifyFinding(finding:DraftFinding,passages:ReadonlyMap<string,EvidencePassage>):'supported'|'unsupported_quote'|'missing_evidence'|'unknown_evidence'{
 const structural=validateFinding(finding,passages);if(structural!=='valid')return structural;
 const normalise=(value:string)=>value.replace(/\s+/g,' ').trim();
 if(finding.quotation&&!finding.evidence.some(ref=>normalise(passages.get(ref.passageId)?.text??'').includes(normalise(finding.quotation!))))return 'unsupported_quote';
 return 'supported';
}
