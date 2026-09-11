CREATE TABLE "client_matters" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "clerk_user_id" text,
  "vericase_workspace_id" text NOT NULL,
  "vericase_workspace_name" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "client_matters_email_idx" ON "client_matters" ("email");
--> statement-breakpoint
CREATE INDEX "client_matters_clerk_user_idx" ON "client_matters" ("clerk_user_id");
