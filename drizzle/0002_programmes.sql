CREATE TYPE "programme_parse_status" AS ENUM ('parsed', 'partial', 'failed', 'empty');
--> statement-breakpoint
CREATE TYPE "programme_report_status" AS ENUM ('running', 'complete', 'failed');
--> statement-breakpoint
CREATE TABLE "programmes" (
  "id" text PRIMARY KEY NOT NULL,
  "pursuit_id" text REFERENCES "pursuits"("id") ON DELETE cascade,
  "file_name" text NOT NULL,
  "format" text NOT NULL,
  "content_hash" text NOT NULL,
  "parse_status" "programme_parse_status" NOT NULL,
  "parse_engine" text NOT NULL,
  "parse_confidence" integer NOT NULL,
  "schedule" jsonb,
  "issues" jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "programmes_pursuit_created_idx" ON "programmes" ("pursuit_id", "created_at");
--> statement-breakpoint
CREATE INDEX "programmes_content_hash_idx" ON "programmes" ("content_hash");
--> statement-breakpoint
CREATE TABLE "programme_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "programme_id" text NOT NULL REFERENCES "programmes"("id") ON DELETE cascade,
  "status" "programme_report_status" DEFAULT 'running' NOT NULL,
  "cache_key" text NOT NULL,
  "progress" jsonb,
  "report" jsonb,
  "error" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "programme_reports_programme_created_idx" ON "programme_reports" ("programme_id", "created_at");
--> statement-breakpoint
CREATE INDEX "programme_reports_cache_key_idx" ON "programme_reports" ("cache_key");
