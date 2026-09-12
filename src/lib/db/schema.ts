import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { ProgrammeIssue, ProgrammeReport, Schedule } from "@/lib/programme/types";

// Stages a pursuit passes through. There is no conflict-check stage.
export const PURSUIT_STAGES = [
  "enquiry",
  "scoping",
  "proposal",
  "instructed",
  "declined",
  "dormant",
] as const;
export const pursuitStageEnum = pgEnum("pursuit_stage", PURSUIT_STAGES);

export const PURSUIT_SOURCES = [
  "site_form",
  "referral",
  "introduction",
  "existing_client",
  "other",
] as const;
export const pursuitSourceEnum = pgEnum("pursuit_source", PURSUIT_SOURCES);

export const ACTIVITY_KINDS = [
  "enquiry_received",
  "created",
  "assigned",
  "note",
  "stage_changed",
  "file_added",
  "file_removed",
  "brief_generated",
  "next_action_set",
  "reopened",
] as const;
export const activityKindEnum = pgEnum("activity_kind", ACTIVITY_KINDS);

export const briefStatusEnum = pgEnum("brief_status", ["running", "complete", "failed"]);

export const documentScopeEnum = pgEnum("document_scope", ["pursuit", "library", "client"]);

export const pursuits = pgTable(
  "pursuits",
  {
    id: text("id").primaryKey(),
    firm: text("firm").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    website: text("website"),
    companyNumber: text("company_number"),
    party: text("party"),
    partyCompanyNumber: text("party_company_number"),
    counterparty: text("counterparty"),
    disputeNature: text("dispute_nature"),
    approximateValue: text("approximate_value"),
    forum: text("forum"),
    summary: text("summary"),
    source: pursuitSourceEnum("source").notNull(),
    sourceDetail: text("source_detail"),
    ownerId: text("owner_id"),
    stage: pursuitStageEnum("stage").notNull().default("enquiry"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    nextAction: text("next_action"),
    nextActionDue: date("next_action_due"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pursuits_stage_owner_idx").on(t.stage, t.ownerId),
    index("pursuits_contact_email_idx").on(t.contactEmail),
    index("pursuits_updated_at_idx").on(t.updatedAt),
  ]
);

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id, { onDelete: "cascade" }),
    kind: activityKindEnum("kind").notNull(),
    actorId: text("actor_id").notNull(),
    body: text("body"),
    meta: jsonb("meta").$type<ActivityMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_pursuit_created_idx").on(t.pursuitId, t.createdAt)]
);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  scope: documentScopeEnum("scope").notNull(),
  pursuitId: text("pursuit_id").references(() => pursuits.id, { onDelete: "cascade" }),
  clientDomainId: text("client_domain_id").references(() => clientDomains.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  extractedText: text("extracted_text"),
  uploadedBy: text("uploaded_by").notNull(),
  /** The client's address when a client uploaded it; null for director uploads. */
  uploaderEmail: text("uploader_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Company email domains whose people may request a file-upload link. Removal is a timestamp,
 * not a delete, so files keep the domain they came from.
 */
export const clientDomains = pgTable(
  "client_domains",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull().unique(),
    firm: text("firm").notNull(),
    pursuitId: text("pursuit_id").references(() => pursuits.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [index("client_domains_pursuit_idx").on(t.pursuitId)]
);

export const CLIENT_UPLOAD_STATUSES = ["pending", "complete", "aborted"] as const;
export type ClientUploadStatus = (typeof CLIENT_UPLOAD_STATUSES)[number];

/** One S3 multipart upload a client started. Rows outlive the upload so a stale one can be aborted. */
export const clientUploads = pgTable(
  "client_uploads",
  {
    id: text("id").primaryKey(),
    clientDomainId: text("client_domain_id")
      .notNull()
      .references(() => clientDomains.id),
    pursuitId: text("pursuit_id").references(() => pursuits.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    uploaderEmail: text("uploader_email"),
    key: text("key").notNull(),
    uploadId: text("upload_id").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    partSize: integer("part_size").notNull(),
    status: text("status").$type<ClientUploadStatus>().notNull().default("pending"),
    documentId: text("document_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_uploads_status_created_idx").on(t.status, t.createdAt)]
);

export const briefs = pgTable(
  "briefs",
  {
    id: text("id").primaryKey(),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id, { onDelete: "cascade" }),
    status: briefStatusEnum("status").notNull().default("running"),
    facts: jsonb("facts").$type<BriefFacts>(),
    analysis: jsonb("analysis").$type<BriefAnalysisLine[]>(),
    summary: text("summary"),
    sources: jsonb("sources").$type<string[]>(),
    error: text("error"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("briefs_pursuit_created_idx").on(t.pursuitId, t.createdAt)]
);

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<QuestionSource[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questions_pursuit_created_idx").on(t.pursuitId, t.createdAt)]
);

/** Submission counters for the public form. Keys are hashed ("email:<sha256>", "ip:<sha256>", "global"). */
export const enquiryThrottle = pgTable("enquiry_throttle", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const PROSPECT_CONFLICTS = [
  "hard_conflict",
  "latent_conflict",
  "competitor",
  "related_party",
  "excluded",
  "other",
] as const;
export const prospectConflictEnum = pgEnum("prospect_conflict", PROSPECT_CONFLICTS);

export const PROSPECT_EVIDENCE = ["researched", "tracker", "sector_profile"] as const;
export const prospectEvidenceEnum = pgEnum("prospect_evidence", PROSPECT_EVIDENCE);

export const PROSPECT_OUTREACH = [
  "unworked",
  "approaching",
  "contacted",
  "parked",
  "converted",
  "do_not_approach",
] as const;
export const prospectOutreachEnum = pgEnum("prospect_outreach", PROSPECT_OUTREACH);

export const PROSPECT_SOURCE_LISTS = ["ranked", "excluded"] as const;
export const prospectSourceEnum = pgEnum("prospect_source_list", PROSPECT_SOURCE_LISTS);

/** Outbound target firms. Separate from inbound pursuits and from the public enquiry inbox. */
export const prospects = pgTable(
  "prospects",
  {
    id: text("id").primaryKey(),
    organisation: text("organisation").notNull().unique(),
    organisationType: text("organisation_type"),
    conflictTier: prospectConflictEnum("conflict_tier").notNull(),
    rank: integer("rank"),
    need: integer("need"),
    gap: integer("gap"),
    capacity: integer("capacity"),
    access: integer("access"),
    valueScore: integer("value_score"),
    evidence: prospectEvidenceEnum("evidence"),
    whyTheyNeedYou: text("why_they_need_you"),
    routeInNote: text("route_in_note"),
    sourceList: prospectSourceEnum("source_list").notNull(),
    outreachStatus: prospectOutreachEnum("outreach_status").notNull().default("unworked"),
    partnerNotes: text("partner_notes"),
    convertedPursuitId: text("converted_pursuit_id").references(() => pursuits.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prospects_conflict_rank_idx").on(t.conflictTier, t.rank)]
);

export const PROGRAMME_PARSE_STATUSES = ["parsed", "partial", "failed", "empty"] as const;
export const programmeParseStatusEnum = pgEnum("programme_parse_status", PROGRAMME_PARSE_STATUSES);

export const PROGRAMME_REPORT_STATUSES = ["running", "complete", "failed"] as const;
export const programmeReportStatusEnum = pgEnum("programme_report_status", PROGRAMME_REPORT_STATUSES);

export const programmes = pgTable(
  "programmes",
  {
    id: text("id").primaryKey(),
    pursuitId: text("pursuit_id").references(() => pursuits.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    format: text("format").notNull(),
    contentHash: text("content_hash").notNull(),
    parseStatus: programmeParseStatusEnum("parse_status").notNull(),
    parseEngine: text("parse_engine").notNull(),
    parseConfidence: integer("parse_confidence").notNull(),
    schedule: jsonb("schedule").$type<Schedule | null>(),
    issues: jsonb("issues").$type<ProgrammeIssue[]>().notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("programmes_pursuit_created_idx").on(t.pursuitId, t.createdAt),
    index("programmes_content_hash_idx").on(t.contentHash),
  ]
);

export const programmeReports = pgTable(
  "programme_reports",
  {
    id: text("id").primaryKey(),
    programmeId: text("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "cascade" }),
    status: programmeReportStatusEnum("status").notNull().default("running"),
    cacheKey: text("cache_key").notNull(),
    progress: jsonb("progress").$type<{ stage: string; percent: number }>(),
    report: jsonb("report").$type<ProgrammeReport | null>(),
    error: text("error"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("programme_reports_programme_created_idx").on(t.programmeId, t.createdAt),
    index("programme_reports_cache_key_idx").on(t.cacheKey),
  ]
);

export type PursuitStage = (typeof PURSUIT_STAGES)[number];
export type PursuitSource = (typeof PURSUIT_SOURCES)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type BriefStatus = (typeof briefStatusEnum.enumValues)[number];
export type DocumentScope = (typeof documentScopeEnum.enumValues)[number];
export type ProspectConflict = (typeof PROSPECT_CONFLICTS)[number];
export type ProspectEvidence = (typeof PROSPECT_EVIDENCE)[number];
export type ProspectOutreach = (typeof PROSPECT_OUTREACH)[number];
export type ProspectSourceList = (typeof PROSPECT_SOURCE_LISTS)[number];

export type Pursuit = typeof pursuits.$inferSelect;
export type NewPursuit = typeof pursuits.$inferInsert;
export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type ClientDomain = typeof clientDomains.$inferSelect;
export type NewClientDomain = typeof clientDomains.$inferInsert;
export type ClientUpload = typeof clientUploads.$inferSelect;
export type NewClientUpload = typeof clientUploads.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type ProgrammeRow = typeof programmes.$inferSelect;
export type ProgrammeReportRow = typeof programmeReports.$inferSelect;
export type ProgrammeParseStatus = (typeof PROGRAMME_PARSE_STATUSES)[number];
export type ProgrammeReportStatus = (typeof PROGRAMME_REPORT_STATUSES)[number];

/** The public form submission exactly as received, stored on the enquiry_received activity. */
export type EnquirySubmission = {
  name: string;
  firm: string;
  email: string;
  disputeNature: string;
  approximateValue?: string | null;
  forum?: string | null;
  description?: string | null;
  receivedAt: string;
};

export type AlertOutcome =
  | { sentAt: string; recipients: number }
  | { error: string }
  | { skipped: "not_configured" };

export type ActivityMeta = {
  from?: PursuitStage;
  to?: PursuitStage;
  reason?: string | null;
  documentId?: string;
  title?: string;
  submission?: EnquirySubmission;
  /** Other pursuits with the same contact email or firm at the time the enquiry arrived. */
  relatedPursuitIds?: string[];
  alert?: AlertOutcome;
  briefId?: string;
  nextAction?: string | null;
  nextActionDue?: string | null;
  ownerId?: string | null;
};

export type BriefOfficer = { name: string; role?: string | null; appointedOn?: string | null };

export type CompanyCandidate = {
  number: string;
  title: string;
  status?: string | null;
  address?: string | null;
};

export type BriefFacts = {
  /** Which organisation the brief is about: the party when set, otherwise the firm. */
  subject: string;
  /** "confirmed" when the number was supplied or matched exactly; "unconfirmed" when only candidates exist. */
  match: "confirmed" | "unconfirmed" | "none";
  candidates?: CompanyCandidate[];
  companyName?: string | null;
  companyNumber?: string | null;
  status?: string | null;
  incorporatedOn?: string | null;
  registeredAddress?: string | null;
  sicCodes: string[];
  officers: BriefOfficer[];
  chargesCount?: number | null;
  accountsOverdue?: boolean | null;
  fetchedAt: string;
  source: "Companies House";
};

export const ANALYSIS_SOURCES = ["companies_house", "enquiry", "web", "reasoning"] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number];

export type BriefAnalysisLine = {
  text: string;
  kind: "fact" | "inference";
  source: AnalysisSource;
  url: string | null;
};

export type QuestionSource = { label: string; url?: string | null };
