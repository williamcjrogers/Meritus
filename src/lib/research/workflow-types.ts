export type ResearchScope = { kind: 'organisation'|'project'|'legal_issue'|'sector'|'referral'; subject: string; entityId: string|null; jurisdiction: string; from: string|null; to: string|null; sources: string[] };
export type ResearchBudget = { maxRequests:number; maxTokens:number; maxCostPence:number };
export type InvestigationRequest = { requestId:string; question:string; scope:ResearchScope; budget:ResearchBudget };
export type EvidenceRef = { documentId:string; versionId:string; passageId:string };
export type EvidencePassage = EvidenceRef & { sourceId:string; title:string; url:string; locator:unknown; text:string; retrievedAt:string; publishedAt:string|null; eventAt:string|null; attribution:string };
export type CoverageEntry = { sourceId:string; state:'complete'|'partial'|'unavailable'; note:string };
