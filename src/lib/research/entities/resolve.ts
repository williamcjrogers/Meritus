import type { IdentityInput, EntityCandidate, Resolution } from './types';
export function canonicalIdentifier(identifier: {
    scheme: string;
    value: string;
}): {
    scheme: string;
    value: string;
} { const scheme = identifier.scheme === 'GB-COH' ? 'uk-company-number' : identifier.scheme; return { scheme, value: scheme === 'uk-company-number' ? identifier.value.replace(/\s+/g, '').toUpperCase() : identifier.value }; }
const uniqueSchemes = new Set(['uk-company-number', 'lei', 'ocid', 'find-case-law-uri']);
export function resolveEntity(input: IdentityInput, candidates: EntityCandidate[]): Resolution { const ids = input.identifiers.map(canonicalIdentifier); const eligible = candidates.filter(c => c.kind === input.kind && c.jurisdiction === input.jurisdiction); const matches = eligible.filter(c => c.verified && ids.some(i => uniqueSchemes.has(i.scheme) && c.identifiers.map(canonicalIdentifier).some(j => j.scheme === i.scheme && j.value === i.value)) && !ids.some(i => c.identifiers.map(canonicalIdentifier).some(j => j.scheme === i.scheme && j.value !== i.value))); if (matches.length === 1)
    return { entityId: matches[0].id, state: 'matched', candidateIds: [matches[0].id] }; const review = eligible.filter(c => c.name.trim().toLocaleLowerCase('en-GB') === input.name.trim().toLocaleLowerCase('en-GB') || matches.includes(c)||ids.some(i=>c.identifiers.map(canonicalIdentifier).some(j=>i.scheme===j.scheme&&i.value===j.value))); return { entityId: null, state: review.length ? 'review' : 'new', candidateIds: review.map(c => c.id) }; }
