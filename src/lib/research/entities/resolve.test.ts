// @vitest-environment node
// Synthetic entity names and identifiers only.
import { expect, it } from 'vitest';
import { resolveEntity } from './resolve';
import { validateRelationship } from './relationships';
it('does not match names, different jurisdictions or contradictory identifiers', () => { const input = { kind: 'company' as const, name: 'Synthetic', jurisdiction: 'GB', identifiers: [{ scheme: 'GB-COH', value: 'SC012345' }, { scheme: 'lei', value: 'synthetic-A' }] }; const candidate = { ...input, id: 'one', verified: true, identifiers: [{ scheme: 'uk-company-number', value: 'SC012345' }, { scheme: 'lei', value: 'synthetic-B' }] }; expect(resolveEntity(input, [candidate]).state).toBe('review'); expect(resolveEntity(input, [{ ...candidate, jurisdiction: 'FR' }]).entityId).toBeNull(); expect(resolveEntity({ ...input, identifiers: [] }, [candidate, { ...candidate, id: 'two' }]).candidateIds).toHaveLength(2); });
it('requires traceable relationship evidence and reviewer', () => { expect(() => validateRelationship({ subjectId: 'a', objectId: 'b', predicate: 'engaged' })).toThrow(); expect(() => validateRelationship({ subjectId: 'a', objectId: 'b', subjectKind: 'company', objectKind: 'adviser', predicate: 'observedParticipation', versionId: 'v', passageId: 'p', confidence: 1, validFrom: '2026-01-01', validTo: '2025-01-01', reviewerId: 'r' })).toThrow(); });
