export const REFERRAL_CHANNELS=['funder','insurer','administrator','solicitor','chambers','surveyor','contractor','expert','framework','other'] as const;
export type ConflictDecision={status:'not_checked'|'clear'|'potential'|'conflicted';reviewedBy:string|null;reviewedAt:string|null;rationale:string|null};
export function initialConflictDecision():ConflictDecision{return {status:'not_checked',reviewedBy:null,reviewedAt:null,rationale:null};}
