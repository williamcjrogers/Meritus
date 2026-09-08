import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "researching",
  "conflict_check",
  "instructed",
  "declined",
  "parked",
]);

export const noteSourceEnum = pgEnum("note_source", ["human", "research", "chat"]);

export const documentScopeEnum = pgEnum("document_scope", ["lead", "library"]);

export const researchStatusEnum = pgEnum("research_status", [
  "running",
  "complete",
  "failed",
]);

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  companyNumber: text("company_number"),
  website: text("website"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  source: text("source"),
  status: leadStatusEnum("status").notNull().default("new"),
  notesSummary: text("notes_summary"),
  vericaseWorkspaceId: text("vericase_workspace_id"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  source: noteSourceEnum("source").notNull().default("human"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  scope: documentScopeEnum("scope").notNull(),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  extractedText: text("extracted_text"),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const researchRuns = pgTable("research_runs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  status: researchStatusEnum("status").notNull().default("running"),
  dossierJson: jsonb("dossier_json").$type<ResearchDossier>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type NoteSource = (typeof noteSourceEnum.enumValues)[number];
export type DocumentScope = (typeof documentScopeEnum.enumValues)[number];
export type ResearchStatus = (typeof researchStatusEnum.enumValues)[number];

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ResearchRun = typeof researchRuns.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type ResearchDossier = {
  company: {
    name: string;
    number?: string;
    status?: string;
    incorporatedOn?: string;
    address?: string;
    sicCodes?: string[];
  };
  officers: Array<{
    name: string;
    role?: string;
    appointedOn?: string;
  }>;
  filingsHint: string;
  newsAndRisks: string[];
  sources: string[];
  summary: string;
};
