import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { researchSources, researchRuns } from "./research-schema";
import { researchWatchlistMembers } from "./research-workflow-schema";
export const researchWatchlistRefreshes = pgTable("research_watchlist_refreshes", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().default(QCS_WORKSPACE_ID),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  memberId: uuid("member_id").notNull().references(() => researchWatchlistMembers.id, { onDelete: "cascade" }), sourceId: uuid("source_id").notNull().references(() => researchSources.id),
  runId: uuid("run_id").references(() => researchRuns.id), status: text("status").notNull(), reason: text("reason"), checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("research_watchlist_source_refresh").on(table.memberId, table.sourceId), index("research_watchlist_refresh_checked").on(table.workspaceId, table.checkedAt)]);
