import { expect, it } from 'vitest';
import { directorName } from './director-helpers';
it('distinguishes absent assignments from unresolved assigned identities', () => {
    expect(directorName([], null)).toBe('Unassigned');
    expect(directorName([], 'missing')).toBe('Assigned, name unavailable');
    expect(directorName([{ id: 'found', name: 'William Rogers', email: '', initials: 'WR' }], 'found')).toBe('William Rogers');
});
