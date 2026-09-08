CREATE TYPE "lead_status" AS ENUM ('new', 'researching', 'conflict_check', 'instructed', 'declined', 'parked');
--> statement-breakpoint
CREATE TYPE "note_source" AS ENUM ('human', 'research', 'chat');
--> statement-breakpoint
CREATE TYPE "document_scope" AS ENUM ('lead', 'library');
--> statement-breakpoint
CREATE TYPE "research_status" AS ENUM ('running', 'complete', 'failed');
--> statement-breakpoint
CREATE TABLE "leads" (
  "id" text PRIMARY KEY NOT NULL,
  "company_name" text NOT NULL,
  "company_number" text,
  "contact_name" text,
  "contact_email" text,
  "source" text,
  "status" "lead_status" DEFAULT 'new' NOT NULL,
  "notes_summary" text,
  "vericase_workspace_id" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
  "id" text PRIMARY KEY NOT NULL,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "author_id" text NOT NULL,
  "body" text NOT NULL,
  "source" "note_source" DEFAULT 'human' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" "document_scope" NOT NULL,
  "lead_id" text REFERENCES "leads"("id") ON DELETE cascade,
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
CREATE TABLE "research_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "status" "research_status" DEFAULT 'running' NOT NULL,
  "dossier_json" jsonb,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
