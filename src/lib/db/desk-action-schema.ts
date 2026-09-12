import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, date, timestamp, integer, jsonb, index, unique, check, foreignKey } from 'drizzle-orm/pg-core';
import { pursuits, prospects, programmes } from './schema';
import { researchInvestigations } from './research-schema';
import { researchCalendar } from './research-workflow-schema';
export const deskActions = pgTable('desk_actions', {
    id: uuid('id').primaryKey().defaultRandom(), title: text('title').notNull(), description: text('description'),
    ownerId: text('owner_id'), suggestedOwnerId: text('suggested_owner_id'), dueDate: date('due_date'), originalDueDate: date('original_due_date'),
    state: text('state').notNull().default('todo'), stateReason: text('state_reason'), completedAt: timestamp('completed_at', { withTimezone: true }), completedBy: text('completed_by'),
    createdBy: text('created_by').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(), version: integer('version').notNull().default(1), legacyKey: text('legacy_key').unique(),
    pursuitId: text('pursuit_id').references(() => pursuits.id, { onDelete: 'restrict' }), prospectId: text('prospect_id').references(() => prospects.id, { onDelete: 'restrict' }), programmeId: text('programme_id').references(() => programmes.id, { onDelete: 'restrict' }), investigationId: uuid('investigation_id').references(() => researchInvestigations.id, { onDelete: 'restrict' }), calendarId: uuid('calendar_id').references(() => researchCalendar.id, { onDelete: 'restrict' }), retainedContext: text('retained_context'),
}, t => [
    unique('desk_actions_id_pursuit_unique').on(t.id, t.pursuitId),
    check('desk_action_state', sql `${t.state} in ('todo','in_progress','waiting','completed','cancelled')`),
    check('desk_action_title', sql `length(btrim(${t.title})) between 1 and 240`), check('desk_action_version', sql `${t.version}>0`),
    check('desk_action_single_parent', sql `num_nonnulls(${t.pursuitId},${t.prospectId},${t.programmeId},${t.investigationId},${t.calendarId})<=1`),
    check('desk_action_waiting', sql `${t.state}<>'waiting' or (${t.dueDate} is not null and coalesce(length(btrim(${t.stateReason})),0)>0)`),
    check('desk_action_cancelled', sql `${t.state}<>'cancelled' or coalesce(length(btrim(${t.stateReason})),0)>0`),
    check('desk_action_completion', sql `((${t.state}='completed') = (${t.completedAt} is not null and ${t.completedBy} is not null)) and (${t.state}='completed' or (${t.completedAt} is null and ${t.completedBy} is null)) and (${t.state}<>'completed' or ${t.ownerId} is not null)`),
    index('desk_actions_due_idx').on(t.state, t.dueDate, t.id), index('desk_actions_owner_idx').on(t.ownerId, t.state, t.dueDate),
    index('desk_actions_pursuit_idx').on(t.pursuitId), index('desk_actions_prospect_idx').on(t.prospectId), index('desk_actions_programme_idx').on(t.programmeId), index('desk_actions_investigation_idx').on(t.investigationId), index('desk_actions_calendar_idx').on(t.calendarId),
]);
export const deskActionEvents = pgTable('desk_action_events', {
    id: uuid('id').primaryKey().defaultRandom(), actionId: uuid('action_id').notNull().references(() => deskActions.id, { onDelete: 'restrict' }), requestId: uuid('request_id').notNull().unique(), requestHash: text('request_hash').notNull(), actorId: text('actor_id').notNull(), kind: text('kind').notNull(), before: jsonb('before'), after: jsonb('after').notNull(), reason: text('reason'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('desk_action_events_action_idx').on(t.actionId, t.createdAt, t.id)]);
export const deskActionPriorities = pgTable('desk_action_priorities', {
    pursuitId: text('pursuit_id').primaryKey().references(() => pursuits.id, { onDelete: 'restrict' }), actionId: uuid('action_id').notNull(), version: integer('version').notNull().default(1),
}, t => [foreignKey({ columns: [t.actionId, t.pursuitId], foreignColumns: [deskActions.id, deskActions.pursuitId] }).onDelete('restrict')]);
