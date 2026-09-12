import { pgTable, uuid, text, jsonb, timestamp, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { QCS_WORKSPACE_ID } from '@/lib/research/contracts';
import { researchInvestigations } from './research-schema';
import { researchSignals } from './research-workflow-schema';
const base = () => ({ id: uuid('id').primaryKey().defaultRandom(), workspaceId: uuid('workspace_id').notNull().default(QCS_WORKSPACE_ID), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() });
export const researchSignalDecisions = pgTable('research_signal_decisions', {
  ...base(), signalId: uuid('signal_id').notNull().references(() => researchSignals.id), action: text('action').notNull(), actor: text('actor').notNull(), ownerId: text('owner_id'), revisitAt: timestamp('revisit_at', { withTimezone: true }), note: text('note').notNull(), evidence: jsonb('evidence').notNull().default([]), relatedSignalId: uuid('related_signal_id').references(() => researchSignals.id),
}, t => [index('research_signal_decisions_signal').on(t.signalId, t.createdAt)]);
export const researchWeeklyDigests = pgTable('research_weekly_digests', {
  ...base(), weekStart: date('week_start').notNull(), signalIds: jsonb('signal_ids').notNull(), calendarIds: jsonb('calendar_ids').notNull(), sourceCoverage: jsonb('source_coverage').notNull(),
}, t => [uniqueIndex('research_weekly_digests_workspace_id_week_start_key').on(t.workspaceId, t.weekStart)]);
export const researchIndexes = pgTable('research_indexes', {
  ...base(), investigationId: uuid('investigation_id').notNull().references(() => researchInvestigations.id), kind: text('kind').notNull(), specification: jsonb('specification').notNull(), summary: jsonb('summary').notNull(), evidence: jsonb('evidence').notNull(), actor: text('actor').notNull(),
});
