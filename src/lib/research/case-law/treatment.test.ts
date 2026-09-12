// @vitest-environment node
// Synthetic authorities and analysis only.
import { expect, it } from 'vitest';
import { verifiedTreatment } from './treatment';
import { validateProposedComparison } from './service';
it('requires reviewed express evidence even for appeal status', () => { expect(verifiedTreatment([{ fromDocumentId: 'a', toDocumentId: 'b', kind: 'overrules', passageId: null, reviewed: false }])).toEqual([]); expect(verifiedTreatment([{ fromDocumentId: 'a', toDocumentId: 'b', kind: 'appeal', passageId: 'p', reviewed: true }])).toHaveLength(1); });
it('rejects model hallucinations, wrong authorities and wrong passage identities', () => { const corpus = [{ documentId: 'a', passages: [{ id: 'p', text: 'Synthetic source words.' }] }]; expect(() => validateProposedComparison([{ documentId: 'a', quotations: [{ passageId: 'p', quotation: 'Invented holding' }] }], corpus)).toThrow(); expect(() => validateProposedComparison([{ documentId: 'b', quotations: [{ passageId: 'p', quotation: 'Synthetic' }] }], corpus)).toThrow(); expect(() => validateProposedComparison([{ documentId: 'a', quotations: [{ passageId: 'wrong', quotation: 'Synthetic' }] }], corpus)).toThrow(); expect(() => validateProposedComparison([{ documentId: 'a', quotations: [{ passageId: 'p', quotation: 'Synthetic source' }] }], corpus)).not.toThrow(); });
