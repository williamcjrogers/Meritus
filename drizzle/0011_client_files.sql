ALTER TYPE "document_scope" ADD VALUE IF NOT EXISTS 'client';
--> statement-breakpoint
-- An abandoned draft (PR #7) once created an empty "client_domains" with different columns on the
-- production database and never shipped. It holds no rows, so it is dropped and recreated in this shape.
DROP TABLE IF EXISTS "client_domains";
--> statement-breakpoint
CREATE TABLE "client_domains" (
  "id" text PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "firm" text NOT NULL,
  "pursuit_id" text REFERENCES "pursuits"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at" timestamp with time zone,
  CONSTRAINT "client_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX "client_domains_pursuit_idx" ON "client_domains" ("pursuit_id");
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "client_domain_id" text REFERENCES "client_domains"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "uploader_email" text;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "size" TYPE bigint;
--> statement-breakpoint
CREATE TABLE "client_uploads" (
  "id" text PRIMARY KEY NOT NULL,
  "client_domain_id" text NOT NULL REFERENCES "client_domains"("id"),
  "pursuit_id" text REFERENCES "pursuits"("id") ON DELETE SET NULL,
  "user_id" text NOT NULL,
  "uploader_email" text,
  "key" text NOT NULL,
  "upload_id" text NOT NULL,
  "file_name" text NOT NULL,
  "mime" text NOT NULL,
  "size" bigint NOT NULL,
  "part_size" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "document_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "client_uploads_status_created_idx" ON "client_uploads" ("status", "created_at");
