-- Rebuild of the portal schema for the pursuit desk. The lead-era tables held only test rows
-- (created 08 September 2026) and no documents, so they are dropped rather than migrated.
DROP TABLE IF EXISTS "chat_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chat_threads" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "research_runs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "leads" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "lead_status";--> statement-breakpoint
DROP TYPE IF EXISTS "note_source";--> statement-breakpoint
DROP TYPE IF EXISTS "research_status";--> statement-breakpoint
DROP TYPE IF EXISTS "document_scope";--> statement-breakpoint
CREATE TYPE "public"."activity_kind" AS ENUM('enquiry_received', 'created', 'assigned', 'note', 'stage_changed', 'file_added', 'file_removed', 'brief_generated', 'next_action_set', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."brief_status" AS ENUM('running', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_scope" AS ENUM('pursuit', 'library');--> statement-breakpoint
CREATE TYPE "public"."pursuit_source" AS ENUM('site_form', 'referral', 'introduction', 'existing_client', 'other');--> statement-breakpoint
CREATE TYPE "public"."pursuit_stage" AS ENUM('enquiry', 'scoping', 'proposal', 'instructed', 'declined', 'dormant');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"pursuit_id" text NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"actor_id" text NOT NULL,
	"body" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"pursuit_id" text NOT NULL,
	"status" "brief_status" DEFAULT 'running' NOT NULL,
	"facts" jsonb,
	"analysis" jsonb,
	"summary" text,
	"sources" jsonb,
	"error" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "document_scope" NOT NULL,
	"pursuit_id" text,
	"title" text NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"extracted_text" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiry_throttle" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pursuits" (
	"id" text PRIMARY KEY NOT NULL,
	"firm" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"website" text,
	"company_number" text,
	"party" text,
	"party_company_number" text,
	"counterparty" text,
	"dispute_nature" text,
	"approximate_value" text,
	"forum" text,
	"summary" text,
	"source" "pursuit_source" NOT NULL,
	"source_detail" text,
	"owner_id" text,
	"stage" "pursuit_stage" DEFAULT 'enquiry' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_action" text,
	"next_action_due" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"pursuit_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_pursuit_created_idx" ON "activity" USING btree ("pursuit_id","created_at");--> statement-breakpoint
CREATE INDEX "briefs_pursuit_created_idx" ON "briefs" USING btree ("pursuit_id","created_at");--> statement-breakpoint
CREATE INDEX "pursuits_stage_owner_idx" ON "pursuits" USING btree ("stage","owner_id");--> statement-breakpoint
CREATE INDEX "pursuits_contact_email_idx" ON "pursuits" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "pursuits_updated_at_idx" ON "pursuits" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "questions_pursuit_created_idx" ON "questions" USING btree ("pursuit_id","created_at");