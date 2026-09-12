import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  doublePrecision,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import {
  researchInvestigations,
  researchRuns,
  researchEntities,
  researchDocuments,
  researchVersions,
  researchPassages,
  researchReviews,
} from "./research-schema";
import { pursuits } from "./schema";
const base = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().default(QCS_WORKSPACE_ID),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const researchWorkflowRequests = pgTable(
  "research_workflow_requests",
  {
    ...base(),
    actor: text("actor").notNull(),
    requestId: uuid("request_id").notNull(),
    requestHash: text("request_hash").notNull(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => researchRuns.id),
  },
  (t) => [
    index("research_workflow_requests_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_workflow_requests_unique_0").on(t.actor, t.requestId),
  ],
);
export const researchWatchlists = pgTable(
  "research_watchlists",
  {
    ...base(),
    label: text("label").notNull(),
    owner: text("owner").notNull(),
    cadenceSeconds: integer("cadence_seconds").notNull(),
    timezone: text("timezone").notNull(),
    sources: jsonb("sources").notNull(),
    signalPreferences: jsonb("signal_preferences").notNull(),
    enabled: boolean("enabled").notNull(),
    revision: integer("revision").notNull(),
  },
  (t) => [index("research_watchlists_updated").on(t.workspaceId, t.updatedAt)],
);
export const researchWatchlistMembers = pgTable(
  "research_watchlist_members",
  {
    ...base(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => researchWatchlists.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => researchEntities.id),
    nextRefreshAt: timestamp("next_refresh_at", {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [
    index("research_watchlist_members_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_watchlist_members_unique_0").on(
      t.watchlistId,
      t.entityId,
    ),
  ],
);
export const researchClaims = pgTable(
  "research_claims",
  {
    ...base(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    entityId: uuid("entity_id").references(() => researchEntities.id),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    availability: text("availability").notNull(),
    quotation: text("quotation"),
    verifiedBy: text("verified_by"),
    revision: integer("revision").notNull(),
  },
  (t) => [index("research_claims_updated").on(t.workspaceId, t.updatedAt)],
);
export const researchClaimEvidence = pgTable(
  "research_claim_evidence",
  {
    ...base(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => researchClaims.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => researchDocuments.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => researchVersions.id),
    passageId: uuid("passage_id")
      .notNull()
      .references(() => researchPassages.id),
    relation: text("relation").notNull(),
  },
  (t) => [
    index("research_claim_evidence_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_claim_evidence_unique_0").on(
      t.claimId,
      t.passageId,
      t.relation,
    ),
  ],
);
export const researchSignals = pgTable(
  "research_signals",
  {
    ...base(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => researchEntities.id),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    kind: text("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    confidence: doublePrecision("confidence").notNull(),
    halfLifeDays: doublePrecision("half_life_days").notNull(),
    independenceConfirmed: boolean("independence_confirmed").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    components: jsonb("components").notNull(),
    score: integer("score").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    stale: boolean("stale").notNull(),
    reviewId: uuid("review_id").references(() => researchReviews.id),
    revision: integer("revision").notNull(),
  },
  (t) => [index("research_signals_updated").on(t.workspaceId, t.updatedAt)],
);
export const researchSignalClaims = pgTable(
  "research_signal_claims",
  {
    ...base(),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => researchSignals.id),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => researchClaims.id),
  },
  (t) => [
    index("research_signal_claims_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_signal_claims_unique_0").on(t.signalId, t.claimId),
  ],
);
export const researchRelationships = pgTable(
  "research_relationships",
  {
    ...base(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => researchEntities.id),
    predicate: text("predicate").notNull(),
    objectId: uuid("object_id")
      .notNull()
      .references(() => researchEntities.id),
    evidence: jsonb("evidence").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    confidence: doublePrecision("confidence").notNull(),
    reviewedBy: text("reviewed_by"),
    channel: text("channel").notNull(),
    serviceOffer: text("service_offer").notNull(),
    owner: text("owner").notNull(),
    stage: text("stage").notNull(),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  },
  (t) => [
    index("research_relationships_updated").on(t.workspaceId, t.updatedAt),
  ],
);
export const researchCalendar = pgTable(
  "research_calendar",
  {
    ...base(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    entityId: uuid("entity_id").references(() => researchEntities.id),
    kind: text("kind").notNull(),
    proposedDate: date("proposed_date").notNull(),
    evidence: jsonb("evidence").notNull(),
    jurisdiction: text("jurisdiction"),
    rule: text("rule"),
    accrualBasis: text("accrual_basis"),
    assumptions: text("assumptions").notNull(),
    reviewedBy: text("reviewed_by"),
    state: text("state").notNull(),
  },
  (t) => [index("research_calendar_updated").on(t.workspaceId, t.updatedAt)],
);
export const researchSuppressions = pgTable(
  "research_suppressions",
  {
    ...base(),
    target: uuid("target").notNull(),
    scope: text("scope").notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    actor: text("actor").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("research_suppressions_updated").on(t.workspaceId, t.updatedAt),
  ],
);
export const researchReports = pgTable(
  "research_reports",
  {
    ...base(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => researchRuns.id),
    audience: text("audience").notNull(),
    status: text("status").notNull(),
    findings: jsonb("findings").notNull(),
    coverage: jsonb("coverage").notNull(),
    methodology: text("methodology").notNull(),
    objectKey: text("object_key"),
    reviewer: text("reviewer"),
  },
  (t) => [index("research_reports_updated").on(t.workspaceId, t.updatedAt)],
);
export const researchReportEvidence = pgTable(
  "research_report_evidence",
  {
    ...base(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => researchReports.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => researchDocuments.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => researchVersions.id),
    passageId: uuid("passage_id")
      .notNull()
      .references(() => researchPassages.id),
  },
  (t) => [
    index("research_report_evidence_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_report_evidence_unique_0").on(
      t.reportId,
      t.passageId,
    ),
  ],
);
export const researchConversations = pgTable(
  "research_conversations",
  {
    ...base(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => researchInvestigations.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => researchRuns.id),
    actor: text("actor").notNull(),
    question: text("question").notNull(),
    answer: jsonb("answer").notNull(),
    evidence: jsonb("evidence").notNull(),
    status: text("status").notNull(),
    modelId: text("model_id").notNull(),
    promptVersion: text("prompt_version").notNull(),
  },
  (t) => [
    index("research_conversations_updated").on(t.workspaceId, t.updatedAt),
  ],
);
export const researchConversions = pgTable(
  "research_conversions",
  {
    ...base(),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => researchSignals.id),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => researchReviews.id),
    createdBy: text("created_by").notNull(),
    summaryHash: text("summary_hash").notNull(),
    needsReview: boolean("needs_review").notNull(),
  },
  (t) => [
    index("research_conversions_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_conversions_unique_0").on(t.signalId),
    uniqueIndex("research_conversions_unique_1").on(t.pursuitId),
  ],
);
export const researchConversionEvidence = pgTable(
  "research_conversion_evidence",
  {
    ...base(),
    conversionId: uuid("conversion_id")
      .notNull()
      .references(() => researchConversions.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => researchVersions.id),
  },
  (t) => [
    index("research_conversion_evidence_updated").on(
      t.workspaceId,
      t.updatedAt,
    ),
    uniqueIndex("research_conversion_evidence_unique_0").on(
      t.conversionId,
      t.versionId,
    ),
  ],
);
export const researchOutcomes = pgTable(
  "research_outcomes",
  {
    ...base(),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => researchSignals.id),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id),
    kind: text("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actor: text("actor").notNull(),
  },
  (t) => [
    index("research_outcomes_updated").on(t.workspaceId, t.updatedAt),
    uniqueIndex("research_outcomes_unique_0").on(t.signalId, t.kind),
  ],
);
