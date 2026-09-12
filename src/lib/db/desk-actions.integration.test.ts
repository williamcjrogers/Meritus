// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { compileSql, concurrentSql, homeTestEnabled, migrateHomeTest, runSql } from './desk-actions-test-db';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let sequence = 100;
const payload = (actionId: string, changes = {}) => ({ id: actionId, title: 'Contact client', ownerId: 'director', dueDate: '2026-09-15', state: 'todo', stateReason: '', description: '', changeReason: '', saveUnassigned: false, link: { kind: 'general' }, ...changes });
const save = (actionId: string, version: number, changes = {}, request = id(++sequence), hash = request) => compileSql(sql `select desk_save_action('director',${request}::uuid,${hash},${version},${JSON.stringify(payload(actionId, changes))}::jsonb);`);
function createFixtureAction(changes = {}) { const actionId = id(++sequence), request = id(++sequence); const command = save(actionId, 0, changes, request); const result = JSON.parse(runSql(command)); expect(result.ok).toBe(true); return { id: actionId, command }; }
const nominate = (actionId: string, version: number, request = id(++sequence)) => compileSql(sql `select desk_select_primary('director',${request}::uuid,${request},${actionId}::uuid,${version});`);
const detach = (actionId: string, version: number, request = id(++sequence)) => compileSql(sql `select desk_detach_action('director',${request}::uuid,${request},${actionId}::uuid,${version},'Live lead: Synthetic company');`);
const pursuit = () => { const key = `lead-${++sequence}`; runSql(compileSql(sql `insert into pursuits(id,firm,source,created_by) values(${key},'Synthetic company','other','director');`)); return key; };
describe.skipIf(!homeTestEnabled)('isolated accountable action persistence', () => {
    beforeAll(migrateHomeTest, 60000);
    it('creates once and replays the original creation', () => { const a = createFixtureAction(); expect(JSON.parse(runSql(a.command)).ok).toBe(true); expect(runSql(`select count(*) from desk_action_events where action_id='${a.id}';`)).toBe('1'); });
    it('keeps one winner for concurrent edits', async () => { const a = createFixtureAction(); const results = await Promise.all([concurrentSql(save(a.id, 1, { state: 'completed' })), concurrentSql(save(a.id, 1, { title: 'Competing edit' }))]); expect(results.map(r => JSON.parse(r).ok).sort()).toEqual([false, true]); expect(results.map(r => JSON.parse(r)).find(r => !r.ok).code).toBe('conflict'); expect(runSql(`select version from desk_actions where id='${a.id}';`)).toBe('2'); expect(runSql(`select count(*) from desk_action_events where action_id='${a.id}';`)).toBe('2'); });
    it('rejects stale edits and request reuse with another payload or actor', () => {
        const a = createFixtureAction();
        expect(JSON.parse(runSql(save(a.id, 0))).code).toBe('conflict');
        expect(JSON.parse(runSql(a.command.replace(/Contact client/g, 'Altered request')))).toMatchObject({ ok: true, action: { title: 'Contact client' } });
        // The authorised repository hashes the complete command; mismatched hashes cannot replay.
        const request = id(++sequence);
        runSql(save(a.id, 1, {}, request, 'hash-one'));
        expect(JSON.parse(runSql(save(a.id, 2, {}, request, 'hash-two'))).code).toBe('validation');
        expect(JSON.parse(runSql(save(a.id, 2, {}, request, 'hash-one').replace("'director'", "'another-director'"))).code).toBe('validation');
    });
    it('serialises identical concurrent requests and competing creation IDs', async () => {
        const actionId = id(++sequence), request = id(++sequence), command = save(actionId, 0, {}, request);
        const replies = await Promise.all([concurrentSql(command), concurrentSql(command)]);
        expect(replies.map(r => JSON.parse(r).ok)).toEqual([true, true]);
        expect(runSql(`select count(*) from desk_action_events where action_id='${actionId}';`)).toBe('1');
        const second = id(++sequence);
        const competing = await Promise.all([concurrentSql(save(second, 0)), concurrentSql(save(second, 0))]);
        expect(competing.map(r => JSON.parse(r).ok).sort()).toEqual([false, true]);
    });
    it('preserves the original deadline, completion identity and lifecycle history', () => {
        const a = createFixtureAction();
        expect(JSON.parse(runSql(save(a.id, 1, { dueDate: '2026-09-20' }))).code).toBe('validation');
        const changed = JSON.parse(runSql(save(a.id, 1, { dueDate: '2026-09-20', changeReason: 'Client requested later call' })));
        expect(changed.action).toMatchObject({ original_due_date: '2026-09-15', due_date: '2026-09-20', version: 2 });
        const done = JSON.parse(runSql(save(a.id, 2, { state: 'completed', dueDate: '2026-09-20' })));
        expect(done.action.completed_by).toBe('director');
        expect(done.action.completed_at).toBeTruthy();
        expect(JSON.parse(runSql(save(a.id, 3, { state: 'completed', title: 'Must not apply' }))).code).toBe('validation');
        const repeated = JSON.parse(runSql(save(a.id, 3, { state: 'completed', dueDate: '2026-09-20' })));
        expect(repeated.action).toMatchObject({ title: 'Contact client', version: 3, due_date: '2026-09-20' });
        const reopened = JSON.parse(runSql(save(a.id, 3, { state: 'todo', dueDate: '2026-09-20' })));
        expect(reopened.action).toMatchObject({ completed_at: null, completed_by: null, version: 4 });
        const cancelled = JSON.parse(runSql(save(a.id, 4, { state: 'cancelled', stateReason: 'No longer required', dueDate: '2026-09-20' })));
        expect(cancelled.action).toMatchObject({ state: 'cancelled', completed_at: null, version: 5 });
        expect(JSON.parse(runSql(save(a.id, 5, { state: 'cancelled', stateReason: 'No longer required', dueDate: '2026-09-20' }))).code).toBe('validation');
        expect(runSql(`select string_agg(kind,',' order by created_at,id) from desk_action_events where action_id='${a.id}';`)).toBe('created,updated,completed,reopened,cancelled');
    });
    it('enforces NULL-safe waiting reasons, assignment, parent and completion invariants', () => {
        expect(JSON.parse(runSql(save(id(++sequence), 0, { state: 'waiting', stateReason: null }))).ok).toBe(false);
        expect(JSON.parse(runSql(save(id(++sequence), 0, { ownerId: null }))).ok).toBe(false);
        expect(JSON.parse(runSql(save(id(++sequence), 0, { ownerId: null, saveUnassigned: true, state: 'completed' }))).ok).toBe(false);
        expect(JSON.parse(runSql(save(id(++sequence), 0, { link: { kind: 'pursuit', id: 'missing' } }))).ok).toBe(false);
        const a = createFixtureAction();
        expect(() => runSql(`update desk_actions set state='waiting',state_reason=NULL where id='${a.id}';`)).toThrow(/desk_action_waiting/);
        expect(() => runSql(`update desk_actions set state='completed' where id='${a.id}';`)).toThrow(/desk_action_completion/);
        const lead = pursuit();
        expect(() => runSql(`update desk_actions set pursuit_id='${lead}',programme_id='missing' where id='${a.id}';`)).toThrow(/desk_action_single_parent/);
        expect(JSON.parse(runSql(save(a.id, 1, { link: { kind: 'pursuit', id: lead } }))).code).toBe('validation');
    });
    it('nominates only an open action in its own pursuit and detaches with history', () => {
        const lead = pursuit(), other = pursuit();
        const a = createFixtureAction({ link: { kind: 'pursuit', id: lead } });
        const nomination = nominate(a.id, 1);
        expect(JSON.parse(runSql(nomination)).action.version).toBe(2);
        expect(JSON.parse(runSql(nomination)).action.version).toBe(2);
        expect(() => runSql(`insert into desk_action_priorities(pursuit_id,action_id) values('${other}','${a.id}');`)).toThrow(/foreign key/);
        expect(() => runSql(`delete from pursuits where id='${lead}';`)).toThrow(/foreign key/);
        const detached = JSON.parse(runSql(detach(a.id, 2)));
        expect(detached.action).toMatchObject({ pursuit_id: null, retained_context: 'Live lead: Synthetic company', version: 3 });
        expect(runSql(`select count(*) from desk_action_priorities where action_id='${a.id}';`)).toBe('0');
        runSql(`delete from pursuits where id='${lead}';`);
        expect(runSql(`select count(*) from desk_action_events where action_id='${a.id}';`)).toBe('3');
        expect(JSON.parse(runSql(nominate(a.id, 3))).code).toBe('validation');
    });
    it('serialises competing nomination, completion and detachment without deadlock', async () => {
        const lead = pursuit(), link = { kind: 'pursuit', id: lead };
        const a = createFixtureAction({ link });
        const replies = await Promise.all([concurrentSql(nominate(a.id, 1)), concurrentSql(save(a.id, 1, { link, state: 'completed' })), concurrentSql(detach(a.id, 1))]);
        expect(replies.map(r => JSON.parse(r).ok).filter(Boolean)).toHaveLength(1);
        expect(replies.map(r => JSON.parse(r).code).filter(c => c === 'conflict')).toHaveLength(2);
        const b = createFixtureAction({ link }), c = createFixtureAction({ link });
        const nominations = await Promise.all([concurrentSql(nominate(b.id, 1)), concurrentSql(nominate(c.id, 1))]);
        expect(nominations.map(r => JSON.parse(r).ok)).toEqual([true, true]);
        expect(runSql(`select count(*) from desk_action_priorities where pursuit_id='${lead}';`)).toBe('1');
    });
    it('rolls back completion if the append-only event cannot be inserted', () => {
        const a = createFixtureAction();
        runSql(`create function home_test_fail_event() returns trigger language plpgsql as $$ begin if NEW.kind='completed' then raise exception 'synthetic history failure'; end if; return NEW; end $$; create trigger home_test_fail before insert on desk_action_events for each row execute function home_test_fail_event();`);
        try {
            expect(() => runSql(save(a.id, 1, { state: 'completed' }))).toThrow(/synthetic history failure/);
        }
        finally {
            runSql('drop trigger home_test_fail on desk_action_events; drop function home_test_fail_event();');
        }
        expect(runSql(`select state||':'||version from desk_actions where id='${a.id}';`)).toBe('todo:1');
        expect(runSql(`select count(*) from desk_action_events where action_id='${a.id}';`)).toBe('1');
    });
    it('preserves programme-linked actions when deleting their enclosing pursuit', () => {
        const lead = pursuit(), programme = `programme-${++sequence}`;
        runSql(`insert into programmes(id,pursuit_id,file_name,format,content_hash,parse_status,parse_engine,parse_confidence,issues,created_by) values('${programme}','${lead}','test.xer','xer','synthetic','parsed','fixture',100,'[]','director');`);
        const a = createFixtureAction({ link: { kind: 'programme', id: programme } });
        expect(() => runSql(`delete from pursuits where id='${lead}';`)).toThrow(/foreign key/);
        expect(runSql(`select count(*) from desk_actions where id='${a.id}';`)).toBe('1');
    });
    it('allows only a valid outcome for concurrent creation and parent deletion', async () => {
        const lead = pursuit(), actionId = id(++sequence);
        const results = await Promise.allSettled([concurrentSql(save(actionId, 0, { link: { kind: 'pursuit', id: lead } })), concurrentSql(`delete from pursuits where id='${lead}';`)]);
        const first = results[0];
        expect(first.status).toBe('fulfilled');
        const created = first.status === 'fulfilled' && JSON.parse(first.value).ok;
        expect(runSql(`select count(*) from desk_actions where id='${actionId}';`)).toBe(created ? '1' : '0');
        expect(runSql(`select count(*) from pursuits where id='${lead}';`)).toBe(created ? '1' : '0');
    });
    it('imports exact legacy text and dates once while preserving dormant dates without action text', () => {
        const lead = pursuit(), noAction = pursuit();
        runSql(`update pursuits set next_action='  Keep the exact legacy text  ',next_action_due='2026-09-19',owner_id='suggested-director',stage='dormant' where id='${lead}'; update pursuits set next_action_due='2026-10-20',stage='dormant' where id='${noAction}';`);
        const migration = readFileSync('drizzle/0009_portal_dashboard_actions.sql', 'utf8');
        const importSql = migration.split('-- BEGIN LEGACY IMPORT')[1].split('\n').slice(1).join('\n');
        runSql(importSql);
        runSql(importSql);
        expect(runSql(`select json_build_object('title',title,'owner',owner_id,'suggested',suggested_owner_id,'due',due_date,'original',original_due_date,'completed',completed_at)::text from desk_actions where legacy_key='pursuit:${lead}';`)).toBeTruthy();
        expect(JSON.parse(runSql(`select json_build_object('title',title,'owner',owner_id,'suggested',suggested_owner_id,'due',due_date,'original',original_due_date,'completed',completed_at)::text from desk_actions where legacy_key='pursuit:${lead}';`))).toEqual({ title: '  Keep the exact legacy text  ', owner: null, suggested: 'suggested-director', due: '2026-09-19', original: '2026-09-19', completed: null });
        expect(runSql(`select count(*) from desk_action_events where action_id=(select id from desk_actions where legacy_key='pursuit:${lead}');`)).toBe('1');
        expect(runSql(`select review_due from pursuits where id='${noAction}';`)).toBe('2026-10-20');
    });
    it('protects recorded history from direct updates and deletion', () => {
        const a = createFixtureAction();
        expect(() => runSql(`update desk_action_events set reason='Rewritten' where action_id='${a.id}';`)).toThrow(/append-only/);
        expect(() => runSql(`delete from desk_action_events where action_id='${a.id}';`)).toThrow(/append-only/);
    });
    it('requires reopening separately from changes to closed action details', () => {
        const a = createFixtureAction();
        runSql(save(a.id, 1, {state: 'completed'}));
        for (const change of [{title:'New title'}, {description:'New description'}, {stateReason:'A bundled new reason'}, {ownerId:'another-director'}, {dueDate:'2026-09-21',changeReason:'New date'}]) {
            expect(JSON.parse(runSql(save(a.id, 2, {state:'todo', ...change}))).code).toBe('validation');
        }
        expect(JSON.parse(runSql(save(a.id, 2, {state:'todo'}))).action).toMatchObject({state:'todo',version:3,completed_at:null});
    });
});
