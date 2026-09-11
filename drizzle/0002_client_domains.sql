CREATE TABLE "client_domains" (
  "id" text PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "vericase_workspace_id" text,
  "vericase_workspace_name" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "client_domains_domain_unique" ON "client_domains" ("domain");
--> statement-breakpoint
CREATE INDEX "client_domains_domain_idx" ON "client_domains" ("domain");
