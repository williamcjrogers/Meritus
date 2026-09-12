export type IdentityInput = {
    kind: 'company' | 'group' | 'person' | 'project' | 'contract' | 'case' | 'adviser';
    name: string;
    jurisdiction: string | null;
    identifiers: {
        scheme: string;
        value: string;
    }[];
};
export type EntityCandidate = IdentityInput & {
    id: string;
    verified: boolean;
};
export type Resolution = {
    entityId: string | null;
    state: 'matched' | 'review' | 'new';
    candidateIds: string[];
};
