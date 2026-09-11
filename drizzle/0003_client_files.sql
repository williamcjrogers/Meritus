CREATE TABLE "client_files" (
  "id" text PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "clerk_user_id" text NOT NULL,
  "email" text NOT NULL,
  "title" text NOT NULL,
  "file_name" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "storage_key" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "client_files_domain_created_idx" ON "client_files" ("domain", "created_at");
--> statement-breakpoint
CREATE INDEX "client_files_clerk_user_idx" ON "client_files" ("clerk_user_id");
