// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionFixture, draftFixture } from './fixtures.test-support';
import type { SaveActionInput } from './types';
const mocks = vi.hoisted(() => ({ requireActionUser: vi.fn(), readResearchActor: vi.fn(), requireResearchDirector: vi.fn(), readAction: vi.fn(), replaySave: vi.fn(), replayCompletion: vi.fn(), conflict: vi.fn(), persist: vi.fn(), operation: vi.fn(), validate: vi.fn(), resolve: vi.fn(), execute: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/portal/auth', () => ({ requireActionUser: mocks.requireActionUser }));
vi.mock('@/lib/research/roles', () => ({ readResearchActor: mocks.readResearchActor, requireResearchDirector: mocks.requireResearchDirector }));
vi.mock('@/lib/db/desk-actions', () => ({ readAction: mocks.readAction, persistDeskAction: mocks.persist, persistActionOperation: mocks.operation, replayDeskAction: mocks.replaySave, replayActionCompletion: mocks.replayCompletion, readActionConflict: mocks.conflict }));
vi.mock('@/lib/db/desk-action-links', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/db/desk-action-links')>(), validateActionLink: mocks.validate, resolveActionLinks: mocks.resolve, linkKey: (l: {
        kind: string;
        id?: string;
    }) => l.kind + ':' + (l.id ?? ''), ActionLinkError: class extends Error {
    } }));
vi.mock('@/lib/db/index', () => ({ requireDb: () => ({ execute: mocks.execute }) }));
vi.mock('@/lib/portal/directors', () => ({ listDirectors: async () => [], directorName: () => 'Unassigned' }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
import { saveDeskAction, completeDeskAction, detachDeskAction, selectPrimaryAction } from './server';
const input = (): SaveActionInput => ({ id: actionFixture().id, requestId: '00000000-0000-4000-8000-000000000099', expectedVersion: 1, link: { kind: 'general' }, draft: draftFixture({ ownerId: 'director-1', dueDate: '2026-09-12' }) });
beforeEach(() => { vi.resetAllMocks(); mocks.replaySave.mockResolvedValue(null); mocks.replayCompletion.mockResolvedValue(null); mocks.conflict.mockImplementation(async (id: string) => ({ ok: false, code: "conflict", error: "Changed", current: { ...await mocks.readAction(id), relatedLabel: "General", relatedHref: null, linkAvailable: true, ownerName: "Assigned", isPrimary: false } })); mocks.requireActionUser.mockResolvedValue({ ok: true, userId: 'director-1' }); mocks.readResearchActor.mockResolvedValue({ role: 'director' }); mocks.readAction.mockResolvedValue(actionFixture({ ownerId: 'director-1', dueDate: '2026-09-12' })); mocks.persist.mockResolvedValue({ ok: true, action: actionFixture() }); mocks.operation.mockResolvedValue({ ok: true, action: actionFixture() }); mocks.resolve.mockResolvedValue(new Map([['general:', { relatedLabel: 'General' }]])); });
describe('guarded action mutations', () => {
    it('rejects clients before reading or persisting', async () => { mocks.requireActionUser.mockResolvedValue({ ok: false, error: 'Director access required' }); expect(await saveDeskAction(input())).toMatchObject({ ok: false, code: 'forbidden' }); expect(mocks.readAction).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('rejects a malformed envelope without querying an action', async () => { expect(await saveDeskAction({ ...input(), id: 'invalid' })).toMatchObject({ code: 'validation' }); expect(mocks.readAction).not.toHaveBeenCalled(); });
    it('does not trust a new assignee when exact directory lookup fails', async () => { mocks.readResearchActor.mockRejectedValue(new Error('unavailable')); expect(await saveDeskAction({ ...input(), draft: { ...input().draft, ownerId: 'new-owner' } })).toMatchObject({ code: 'unavailable' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('rejects non-director assignees', async () => { mocks.readResearchActor.mockResolvedValue({ role: 'client' }); expect(await saveDeskAction({ ...input(), draft: { ...input().draft, ownerId: 'client' } })).toMatchObject({ code: 'validation' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('keeps existing assignments during directory outages', async () => { mocks.readResearchActor.mockRejectedValue(new Error('offline')); expect(await saveDeskAction(input())).toMatchObject({ ok: true }); expect(mocks.readResearchActor).not.toHaveBeenCalled(); });
    it('returns conflict with latest view and does not revalidate', async () => { mocks.persist.mockResolvedValue({ ok: false, code: 'conflict', error: 'Changed', current: actionFixture({ version: 3 }) }); expect(await saveDeskAction(input())).toMatchObject({ code: 'conflict', current: { version: 3 } }); expect(mocks.revalidatePath).not.toHaveBeenCalled(); });
    it('refuses ordinary relinking', async () => { expect(await saveDeskAction({ ...input(), link: { kind: 'pursuit', id: 'lead' } })).toMatchObject({ code: 'validation' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('fails closed when linked evidence cannot be validated', async () => { mocks.validate.mockRejectedValue(new Error('source unavailable')); expect(await saveDeskAction(input())).toMatchObject({ code: 'unavailable' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('requires an explanation for deadline changes', async () => { expect(await saveDeskAction({ ...input(), draft: { ...input().draft, dueDate: '2026-09-13' } })).toMatchObject({ code: 'validation' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it('completes with unchanged fields and the supplied concurrency token', async () => { mocks.readResearchActor.mockRejectedValue(new Error('offline')); const v = input(); expect(await completeDeskAction(v.id, 1, v.requestId)).toMatchObject({ ok: true }); expect(mocks.persist).toHaveBeenCalledWith({ ...v, draft: { ...v.draft, state: 'completed', saveUnassigned: false } }, 'complete'); expect(mocks.readResearchActor).not.toHaveBeenCalled(); expect(mocks.revalidatePath).toHaveBeenCalledWith('/portal', 'layout'); });
    it('returns not found for restricted actions without mutation', async () => { mocks.readAction.mockResolvedValue(null); const v = input(); expect(await completeDeskAction(v.id, 1, v.requestId)).toMatchObject({ code: 'not_found' }); expect(mocks.persist).not.toHaveBeenCalled(); });
    it.each([detachDeskAction, selectPrimaryAction])('guards secondary operations before action reads', async (fn) => { mocks.requireActionUser.mockResolvedValue({ ok: false, error: 'Director access required' }); const v = input(); expect(await fn(v.id, 1, v.requestId)).toMatchObject({ code: 'forbidden' }); expect(mocks.readAction).not.toHaveBeenCalled(); expect(mocks.operation).not.toHaveBeenCalled(); });
    it('retains original context when retrying a detached action', async () => { mocks.readAction.mockResolvedValue(actionFixture({ retainedContext: 'Original lead' })); const v = input(); await detachDeskAction(v.id, 1, v.requestId); expect(mocks.operation).toHaveBeenCalledWith('detach', v.id, 1, v.requestId, 'Original lead'); });
});
describe('repository read boundaries', () => {
    it('rejects unauthorised readers before any database access', async () => {
        const repo = await vi.importActual<typeof import('@/lib/db/desk-actions')>('@/lib/db/desk-actions');
        mocks.requireResearchDirector.mockRejectedValue(new Error('forbidden'));
        await expect(repo.readAction(actionFixture().id)).rejects.toThrow('forbidden');
        await expect(repo.readActionHistory(actionFixture().id)).rejects.toThrow('forbidden');
        await expect(repo.readRelatedActions({ kind: 'general' })).rejects.toThrow('forbidden');
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('uses trusted identity and identical visibility/date predicates for page and total', async () => {
        const repo = await vi.importActual<typeof import('@/lib/db/desk-actions')>('@/lib/db/desk-actions');
        const { PgDialect } = await import('drizzle-orm/pg-core');
        const dialect = new PgDialect();
        mocks.requireResearchDirector.mockResolvedValue('trusted-director');
        mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 121 }] });
        const result = await repo.readActionViews({ scope: 'mine', filter: 'completed_recent', page: 2, pageSize: 500 }, 'forged-client', new Date('2026-09-12T23:30:00Z'));
        expect(result).toEqual({ rows: [], total: 121 });
        const [page, count] = mocks.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query));
        expect(page.params).toContain('trusted-director');
        expect(page.params).not.toContain('forged-client');
        expect(count.params).toContain('2026-09-07');
        expect(count.params).toContain('2026-09-13');
        expect(page.sql.split(' where ')[1].split(' order by ')[0]).toBe(count.sql.split(' where ')[1]);
        expect(page.sql).toContain("at time zone 'Europe/London'");
        expect(page.sql).toContain('research_suppressions');
        expect(page.sql).toContain('research_available_passages');
        expect(page.params.slice(-2)).toEqual([50, 50]);
        expect(count.sql).not.toContain('limit');
    });
    it('maps SQL snapshots without exposing request metadata', async () => {
        const repo = await vi.importActual<typeof import('@/lib/db/desk-actions')>('@/lib/db/desk-actions');
        const action = repo.mapDeskAction({ id: 'x', title: 'Call', state: 'todo', version: 2, pursuit_id: 'lead', created_by: 'director', created_at: new Date('2026-09-12T09:00:00Z'), updated_at: '2026-09-12T10:00:00Z', request_hash: 'secret' });
        expect(action).toMatchObject({ link: { kind: 'pursuit', id: 'lead' }, createdAt: '2026-09-12T09:00:00.000Z', ownerId: null });
        expect(action).not.toHaveProperty('request_hash');
    });
});
describe('lost-response and stale version regressions', () => {
    it('replays cancellation before rejecting the resulting closed state', async () => {
        const v = input();
        v.draft.state = 'cancelled';
        v.draft.stateReason = 'No longer required';
        const cancelled = actionFixture({ state: 'cancelled', version: 2, stateReason: v.draft.stateReason });
        mocks.readAction.mockResolvedValue(cancelled);
        mocks.replaySave.mockResolvedValue({ ok: true, action: cancelled });
        expect(await saveDeskAction(v)).toMatchObject({ ok: true, action: { state: 'cancelled' } });
        expect(mocks.persist).not.toHaveBeenCalled();
    });
    it('replays original assignment during an assignee-directory outage', async () => {
        mocks.readAction.mockResolvedValue(actionFixture({ ownerId: 'subsequent-owner', dueDate: '2026-09-12' }));
        mocks.readResearchActor.mockRejectedValue(new Error('offline'));
        mocks.replaySave.mockResolvedValue({ ok: true, action: actionFixture({ ownerId: 'director-1' }) });
        expect(await saveDeskAction(input())).toMatchObject({ ok: true });
        expect(mocks.readResearchActor).not.toHaveBeenCalled();
    });
    it.each([{ dueDate: '2026-09-13' }, { state: 'completed' as const }, { state: 'cancelled' as const }])('returns a serialised latest conflict before changed-date or lifecycle validation: %j', async (change) => {
        mocks.readAction.mockResolvedValue(actionFixture({ ...change, version: 2 }));
        expect(await saveDeskAction(input())).toMatchObject({ code: 'conflict', current: { version: 2, linkAvailable: true } });
        expect(mocks.persist).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
    it('replays completion after reopening and edits without reconstructing the command', async () => {
        const v = input();
        mocks.readAction.mockResolvedValue(actionFixture({ version: 4, title: 'Later edit', ownerId: 'different' }));
        mocks.readResearchActor.mockRejectedValue(new Error('offline'));
        mocks.replayCompletion.mockResolvedValue({ ok: true, action: actionFixture({ state: 'completed', version: 2 }) });
        expect(await completeDeskAction(v.id, 1, v.requestId)).toMatchObject({ ok: true, action: { state: 'completed', version: 2 } });
        expect(mocks.readAction).not.toHaveBeenCalled();
        expect(mocks.persist).not.toHaveBeenCalled();
    });
});
describe('exact replay fingerprint and visibility', () => {
    async function repository() {
        mocks.requireResearchDirector.mockResolvedValue('director-1');
        return vi.importActual<typeof import('@/lib/db/desk-actions')>('@/lib/db/desk-actions');
    }
    it('keeps the completion SQL fingerprint stable across later mutable drafts, while Save changes it', async () => {
        const repo = await repository();
        const { PgDialect } = await import('drizzle-orm/pg-core');
        const dialect = new PgDialect();
        mocks.execute.mockResolvedValue({ rows: [{ result: { ok: false, code: 'validation', error: 'fixture' } }] });
        const first = input(), later = { ...first, draft: { ...first.draft, title: 'Changed after reopening', ownerId: 'another-director', dueDate: '2026-09-20' } };
        await repo.persistDeskAction(first, 'complete');
        await repo.persistDeskAction(later, 'complete');
        await repo.persistDeskAction(first);
        await repo.persistDeskAction(later);
        const hashes = mocks.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query).params[2]);
        expect(hashes[0]).toBe(hashes[1]);
        expect(hashes[2]).not.toBe(hashes[3]);
        expect(hashes[0]).not.toBe(hashes[2]);
    });
    it('refuses replay by another actor before reading the protected action', async () => {
        const repo = await repository();
        mocks.execute.mockResolvedValueOnce({ rows: [{ actor_id: 'another-director', request_hash: 'other', action_id: input().id }] });
        expect(await repo.replayDeskAction(input())).toMatchObject({ code: 'validation' });
        expect(mocks.execute).toHaveBeenCalledTimes(1);
    });
    it('refuses changed payload reuse with the same request ID', async () => {
        const repo = await repository();
        const { PgDialect } = await import('drizzle-orm/pg-core');
        mocks.execute.mockResolvedValueOnce({ rows: [{ result: { ok: false, code: 'validation', error: 'fixture' } }] });
        await repo.persistDeskAction(input());
        const hash = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).params[2];
        mocks.execute.mockClear();
        mocks.execute.mockResolvedValueOnce({ rows: [{ actor_id: 'director-1', request_hash: hash, action_id: input().id }] });
        expect(await repo.replayDeskAction({ ...input(), draft: { ...input().draft, title: 'Different submission' } })).toMatchObject({ code: 'validation' });
        expect(mocks.execute).toHaveBeenCalledTimes(1);
    });
    it('does not replay a correctly fingerprinted request when current action visibility was withdrawn', async () => {
        const repo = await repository();
        const { PgDialect } = await import('drizzle-orm/pg-core');
        mocks.execute.mockResolvedValueOnce({ rows: [{ result: { ok: false, code: 'validation', error: 'fixture' } }] });
        await repo.persistDeskAction(input(), 'complete');
        const hash = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).params[2];
        mocks.execute.mockClear();
        mocks.execute.mockResolvedValueOnce({ rows: [{ actor_id: 'director-1', request_hash: hash, action_id: input().id, after: { title: 'secret' } }] }).mockResolvedValueOnce({ rows: [] });
        expect(await repo.replayActionCompletion(input().id, 1, input().requestId)).toMatchObject({ code: 'not_found' });
        expect(mocks.resolve).not.toHaveBeenCalled();
    });
});
