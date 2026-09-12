export type Treatment = {
    fromDocumentId: string;
    toDocumentId: string;
    kind: 'cites' | 'applies' | 'distinguishes' | 'overrules' | 'appeal';
    passageId: string | null;
    reviewed: boolean;
};
export function verifiedTreatment(items: Treatment[]): Treatment[] { return items.filter(item => item.reviewed && Boolean(item.passageId)); }
