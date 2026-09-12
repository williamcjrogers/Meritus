import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { researchInvestigations, researchRuns } from "./research-schema";
import { researchConversations } from "./research-workflow-schema";

export const researchQuickQuestions = pgTable("research_quick_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().default(QCS_WORKSPACE_ID),
  owner: text("owner").notNull(), requestId: uuid("request_id").notNull(),
  inputHash: text("input_hash").notNull(), question: text("question").notNull(),
  monitoring: boolean("monitoring").notNull().default(false),
  status: text("status").notNull().default("queued"),
  investigationId: uuid("investigation_id").notNull().references(() => researchInvestigations.id),
  runId: uuid("run_id").notNull().references(() => researchRuns.id),
  answerId: uuid("answer_id").references(() => researchConversations.id),
  lastEvidenceHash: text("last_evidence_hash"),
  leaseToken: bigint("lease_token", { mode: "number" }).notNull().default(0),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  cycleDaily: boolean("cycle_daily").notNull().default(false),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }), error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("research_quick_request").on(table.workspaceId, table.owner, table.requestId),
  index("research_quick_due").on(table.workspaceId, table.status, table.nextCheckAt, table.leaseExpiresAt),
  index("research_quick_owner").on(table.workspaceId, table.owner, table.createdAt),
]);
