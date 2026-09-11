DROP TABLE IF EXISTS "prospects";--> statement-breakpoint
DROP TYPE IF EXISTS "prospect_conflict";--> statement-breakpoint
DROP TYPE IF EXISTS "prospect_evidence";--> statement-breakpoint
DROP TYPE IF EXISTS "prospect_outreach";--> statement-breakpoint
DROP TYPE IF EXISTS "prospect_source_list";--> statement-breakpoint
CREATE TYPE "prospect_conflict" AS ENUM (
  'hard_conflict',
  'latent_conflict',
  'competitor',
  'related_party',
  'excluded',
  'other'
);
--> statement-breakpoint
CREATE TYPE "prospect_evidence" AS ENUM ('researched', 'tracker', 'sector_profile');
--> statement-breakpoint
CREATE TYPE "prospect_outreach" AS ENUM (
  'unworked',
  'approaching',
  'contacted',
  'parked',
  'converted',
  'do_not_approach'
);
--> statement-breakpoint
CREATE TYPE "prospect_source_list" AS ENUM ('ranked', 'excluded');
--> statement-breakpoint
CREATE TABLE "prospects" (
  "id" text PRIMARY KEY NOT NULL,
  "organisation" text NOT NULL,
  "organisation_type" text,
  "conflict_tier" "prospect_conflict" NOT NULL,
  "rank" integer,
  "need" integer,
  "gap" integer,
  "capacity" integer,
  "access" integer,
  "value_score" integer,
  "evidence" "prospect_evidence",
  "why_they_need_you" text,
  "route_in_note" text,
  "source_list" "prospect_source_list" NOT NULL,
  "outreach_status" "prospect_outreach" DEFAULT 'unworked' NOT NULL,
  "partner_notes" text,
  "converted_pursuit_id" text REFERENCES "pursuits"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_organisation_unique" ON "prospects" ("organisation");
--> statement-breakpoint
CREATE INDEX "prospects_conflict_rank_idx" ON "prospects" ("conflict_tier", "rank");
