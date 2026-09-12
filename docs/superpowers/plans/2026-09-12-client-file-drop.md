# Client File Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person at an allow-listed client firm type their work email, receive a Resend link, and drop files of up to 50 GB straight into VeriCase's S3 bucket under `meritus/`, with the three directors the only people who can see or fetch them.

**Architecture:** Two Clerk roles (`director`, `client`) carried in `publicMetadata` and enforced in middleware and again in every guard. Clients never see a password: `/api/access` creates or finds a Clerk user, mints a single-use sign-in token, and Resend delivers the link; `/access/continue` exchanges the ticket for a session. Uploads are S3 multipart: the server opens the upload and signs each part, the browser PUTs parts straight to S3, the server completes the upload, verifies the object with HeadObject and writes the `documents` row. Directors fetch small files through a streamed route and large files through a one-minute presigned redirect.

**Tech Stack:** Next.js 15.5 app router, React 19, Clerk 7 (`@clerk/nextjs`, `@clerk/nextjs/legacy` for the ticket sign-in hook), Drizzle 0.45 on Neon (neon-http), `@aws-sdk/client-s3` 3.1131 plus `@aws-sdk/s3-request-presigner` 3.1131 (to add), Resend 6, Zod 4, Vitest 5 with jsdom default and `// @vitest-environment node` for server tests. npm, not pnpm.

**Spec:** `docs/superpowers/specs/2026-09-12-owner-requirements-design.md` (the static document hold spec). The handover `docs/HANDOVER-client-files.md` is background; where they differ the spec wins.

## Global Constraints

- British English in every string a person reads. No em-dashes anywhere, in code comments or copy. Dates render through `src/lib/portal/dates.ts`.
- Directors stay invite-only in Clerk. No public sign-up, no password form for clients, no Clerk `<SignIn>` widget on any client page.
- Files go to the existing VeriCase bucket (`vericase-data`, eu-west-2) under the `meritus/` prefix through `objectKey()` in `src/lib/portal/s3.ts`. No Vercel Blob, no second bucket, no second Vercel project.
- Client files are never parsed, extracted or analysed. `extractedText` is `null` on every client row.
- `blob_url` and `blob_pathname` columns keep their names. `blobPathname` holds the full S3 key including the `meritus/` prefix; never pass it back through `objectKey()`.
- Client upload cap `MAX_CLIENT_UPLOAD_BYTES = 50 * 1024 ** 3`. Part size `32 * 1024 * 1024`. Presigned part URLs expire in 3600 s; presigned downloads in 60 s; direct download threshold `DIRECT_DOWNLOAD_BYTES = 100 * 1024 * 1024`. Access links expire in 1800 s.
- `/access` answers the same way whether or not the domain is listed. Only rate limiting (429) and a missing Resend key (503) may answer differently.
- Never log a name, email address, file name or document text. Log ids and hashed keys only.
- Migrations are hand-written (`drizzle/0003_client_files.sql` plus a journal entry). Do not run `drizzle-kit generate`: the only snapshot is `0000` and it would emit spurious statements. Statements are separated by `--> statement-breakpoint`.
- Every server-side test file starts with `// @vitest-environment node` on line 1. Component tests omit it.
- No WR2.0 changes. No BREE examples in copy or tests; use `example-firm.co.uk` and `Example Firm LLP`.
- Commit after every task. Run `npm test` and `npx tsc --noEmit` before each commit.

## Manual steps (William, outside the code)

Do 1 and 2 before the branch deploys, or the directors lock themselves out.

1. **Clerk, director roles.** Dashboard, Users, each of the three directors, Metadata, Public: `{"role": "director"}`. Save.
2. **Clerk, session claim (optional, faster).** Dashboard, Sessions, Customize session token, Claims: `{"metadata": "{{user.public_metadata}}"}`. Without it the backend looks the role up through the Backend API and caches it for five minutes per user, which also works.
3. **AWS, own IAM principal.** IAM, Users, create `meritus-portal`, programmatic access only, inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::vericase-data/meritus/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::vericase-data",
      "Condition": { "StringLike": { "s3:prefix": ["meritus/*"] } }
    }
  ]
}
```

   Then on the Vercel project `meritus` (team `quantum-commercial-solutions`) set `S3_BUCKET=vericase-data`, `S3_REGION=eu-west-2`, `S3_KEY_PREFIX=meritus`, and the new user's `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Never VeriCase's production keys.
4. **CORS.** Checked on 12 September 2026: `vericase-data` already allows `PUT` from `*` and exposes `ETag`, which browser multipart needs. If VeriCase later narrows `AllowedOrigins`, add `https://www.meritusvia.com` and `https://meritusvia.com`.
5. **Resend.** Already live. The access link is sent from `ENQUIRY_ALERT_FROM` (default `enquiries@meritusvia.com`).
6. **Optional env.** `ACCESS_LINK_ORIGIN` overrides the origin used in the emailed link (default `SITE_CONFIG.url`, `https://meritusvia.com`). Set it on preview deployments if you want links to land on the preview.

## File structure

New files, each with one job:

| Path | Responsibility |
|---|---|
| `src/lib/portal/domains.ts` (+ test) | Parse and validate a company domain; public mailbox deny-list |
| `src/lib/portal/roles.ts` (+ test) | Read `role`, `domain`, `email` from session claims or the Clerk Backend API, cached |
| `src/types/clerk.d.ts` | Type the `metadata` session claim |
| `src/lib/portal/gate.ts` (+ test) | Pure routing decision for middleware: next, redirect or JSON error |
| `src/lib/db/client-domains.ts` | Drizzle CRUD for `client_domains` |
| `src/lib/db/client-uploads.ts` | Drizzle CRUD for `client_uploads` |
| `src/lib/access/link.ts` (+ test) | Find or create the Clerk client user and mint the sign-in token |
| `src/lib/access/mail.ts` (+ test) | Send the link through Resend |
| `src/app/api/access/route.ts` (+ test) | Public POST: throttle, look up the domain, issue and send the link, generic reply |
| `src/app/access/page.tsx`, `src/components/access/AccessForm.tsx` (+ test) | The one-field page |
| `src/app/access/continue/page.tsx`, `src/components/access/AccessContinue.tsx` | Ticket exchange |
| `src/app/access/denied/page.tsx` | Dead end for a signed-in user with no role |
| `src/lib/portal/s3-transfer.ts` (+ test) | Multipart commands, presigned part and download URLs, streamed GetObject, HeadObject |
| `src/lib/client-uploads/rules.ts` (+ test) | Allowed types, size cap, part planning, key layout |
| `src/lib/client-uploads/service.ts` (+ test) | Create, sign, list, complete, abort, sweep; owns the scope checks |
| `src/app/api/client/uploads/route.ts`, `.../[id]/route.ts`, `.../[id]/parts/route.ts`, `.../[id]/complete/route.ts` (+ one test) | Thin JSON handlers over the service |
| `src/lib/client/upload.ts` (+ test) | Browser-side orchestration: plan, sign, PUT parts, complete, resume |
| `src/lib/client/transport.ts` | fetch and XHR calls the orchestration uses |
| `src/components/client/ClientUploadDesk.tsx` | Upload zone with per-file progress |
| `src/app/client/layout.tsx`, `src/app/client/page.tsx` | The client desk |
| `src/lib/portal/client-actions.ts` (+ test) | Server actions: add, remove, link a domain |
| `src/components/portal/ClientDomainForm.tsx`, `ClientDomainList.tsx` | Directors' UI |
| `src/app/(portal)/portal/clients/page.tsx` | Directors' page |
| `drizzle/0003_client_files.sql` (+ journal test) | Migration |

Modified: `src/lib/db/schema.ts`, `src/lib/db/documents.ts`, `src/lib/db/pursuits.ts`, `src/lib/db/throttle.ts` (+ test), `src/lib/portal/intake.ts`, `src/lib/portal/auth.ts` (+ new test), `src/lib/portal/directors.ts` (+ test), `src/lib/portal/actions.test.ts`, `src/lib/portal/files.ts` (+ test), `src/middleware.ts`, `src/app/api/portal/documents/[id]/route.ts` (+ test), `src/app/(portal)/portal/layout.tsx`, `package.json`, `.env.example`, `README.md`.

---

### Task 1: Domain parsing

**Files:**
- Create: `src/lib/portal/domains.ts`
- Test: `src/lib/portal/domains.test.ts`

**Interfaces:**
- Produces: `parseClientDomain(raw: string): DomainParseResult`, `domainFromEmail(email): string | null`, `isReservedDirectorDomain(domain): boolean`, `isPublicMailboxDomain(domain): boolean`, `normaliseDomain(input): string`, `clientDomainErrorMessage(error: DomainParseError): string`, `PUBLIC_MAILBOX_DOMAINS`, `FIRM_DOMAIN`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/portal/domains.test.ts
import { describe, expect, it } from "vitest";
import {
  PUBLIC_MAILBOX_DOMAINS,
  clientDomainErrorMessage,
  domainFromEmail,
  isReservedDirectorDomain,
  normaliseDomain,
  parseClientDomain,
} from "./domains";

describe("normaliseDomain", () => {
  it("trims, lower-cases and strips a leading @", () => {
    expect(normaliseDomain("  @Example-Firm.co.uk  ")).toBe("example-firm.co.uk");
  });
});

describe("domainFromEmail", () => {
  it("returns the host of an address", () => {
    expect(domainFromEmail("Jane@Example-Firm.co.uk")).toBe("example-firm.co.uk");
  });
  it("returns null for nothing, a bare word, or a missing local part", () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("not-an-email")).toBeNull();
    expect(domainFromEmail("@example-firm.co.uk")).toBeNull();
  });
});

describe("parseClientDomain", () => {
  it("accepts a plain domain and an address", () => {
    expect(parseClientDomain("example-firm.co.uk")).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(parseClientDomain("jane@example-firm.co.uk")).toEqual({ ok: true, domain: "example-firm.co.uk" });
  });
  it("refuses every public mailbox on the list", () => {
    for (const host of PUBLIC_MAILBOX_DOMAINS) {
      expect(parseClientDomain(host)).toEqual({ ok: false, error: "public_mailbox" });
    }
  });
  it("refuses the firm's own domain and its subdomains", () => {
    expect(parseClientDomain("meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("mail.meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
  });
  it("refuses empty and malformed input", () => {
    expect(parseClientDomain("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("localhost")).toEqual({ ok: false, error: "invalid" });
    expect(parseClientDomain("not a domain")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("isReservedDirectorDomain", () => {
  it("is true only for meritusvia.com and its subdomains", () => {
    expect(isReservedDirectorDomain("meritusvia.com")).toBe(true);
    expect(isReservedDirectorDomain("x.meritusvia.com")).toBe(true);
    expect(isReservedDirectorDomain("meritusvia.co.uk")).toBe(false);
  });
});

describe("clientDomainErrorMessage", () => {
  it("names the example domain and never mentions BREE", () => {
    const messages = (["empty", "invalid", "public_mailbox", "firm_domain"] as const).map(clientDomainErrorMessage);
    expect(messages.join(" ")).toMatch(/example-firm\.co\.uk/);
    expect(messages.join(" ")).not.toMatch(/bree/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/domains.test.ts`
Expected: FAIL, cannot resolve `./domains`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/portal/domains.ts
/**
 * A client domain is the membership list for the file drop: anyone with a mailbox at a listed
 * company domain may request a link. Public mailbox providers and the firm's own domain can
 * never be listed.
 */

export const PUBLIC_MAILBOX_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.co.uk",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
] as const;

export const FIRM_DOMAIN = "meritusvia.com";

export const DOMAIN_PARSE_ERRORS = ["empty", "invalid", "public_mailbox", "firm_domain"] as const;
export type DomainParseError = (typeof DOMAIN_PARSE_ERRORS)[number];

export type DomainParseResult = { ok: true; domain: string } | { ok: false; error: DomainParseError };

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Trim, lower-case, strip a leading @: `Example.co.uk` and `@example.co.uk` are the same domain. */
export function normaliseDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

export function isPublicMailboxDomain(domain: string): boolean {
  return (PUBLIC_MAILBOX_DOMAINS as readonly string[]).includes(normaliseDomain(domain));
}

/** meritusvia.com and its subdomains belong to the directors and can never be a client domain. */
export function isReservedDirectorDomain(domain: string): boolean {
  const normalised = normaliseDomain(domain);
  return normalised === FIRM_DOMAIN || normalised.endsWith(`.${FIRM_DOMAIN}`);
}

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = normaliseDomain(trimmed.slice(at + 1));
  return domain || null;
}

function domainInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("@") && !trimmed.startsWith("@")) {
    return domainFromEmail(trimmed) ?? normaliseDomain(trimmed);
  }
  return normaliseDomain(trimmed);
}

export function parseClientDomain(raw: string): DomainParseResult {
  const domain = domainInput(raw);
  if (!domain) return { ok: false, error: "empty" };
  if (!HOSTNAME.test(domain)) return { ok: false, error: "invalid" };
  if (isPublicMailboxDomain(domain)) return { ok: false, error: "public_mailbox" };
  if (isReservedDirectorDomain(domain)) return { ok: false, error: "firm_domain" };
  return { ok: true, domain };
}

export function clientDomainErrorMessage(error: DomainParseError): string {
  switch (error) {
    case "empty":
      return "Enter a company domain";
    case "invalid":
      return "Enter a domain such as example-firm.co.uk";
    case "public_mailbox":
      return "Public mailbox domains cannot be added";
    case "firm_domain":
      return "meritusvia.com is reserved for directors";
    default: {
      const exhaustive: never = error;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/portal/domains.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/domains.ts src/lib/portal/domains.test.ts
git commit -m "feat(access): parse and validate client domains

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Schema and migration

**Files:**
- Modify: `src/lib/db/schema.ts` (the working tree already holds an uncommitted sketch of `clientDomains` and `documents.clientDomainId`; replace it with the shape below)
- Create: `drizzle/0003_client_files.sql`
- Modify: `drizzle/meta/_journal.json`
- Test: `drizzle/journal.test.ts` is not picked up (Vitest includes `src/**` only), so create `src/lib/db/migrations.test.ts`

**Interfaces:**
- Produces: `documentScopeEnum` gains `"client"`; `documents.clientDomainId`, `documents.uploaderEmail`, `documents.size` as bigint (number mode); table `clientDomains` with `removedAt`; table `clientUploads`; types `ClientDomain`, `NewClientDomain`, `ClientUpload`, `NewClientUpload`, `ClientUploadStatus`, `CLIENT_UPLOAD_STATUSES`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/db/migrations.test.ts
// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_UPLOAD_STATUSES, documentScopeEnum } from "./schema";

const root = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(root, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
};

describe("migration journal", () => {
  it("has a file for every entry, in ascending order", () => {
    let lastWhen = 0;
    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      expect(entry.when).toBeGreaterThan(lastWhen);
      expect(existsSync(join(root, `${entry.tag}.sql`))).toBe(true);
      lastWhen = entry.when;
    });
  });

  it("includes 0003_client_files with the client tables and the wider size column", () => {
    const entry = journal.entries.find((e) => e.tag === "0003_client_files");
    expect(entry).toBeDefined();
    const sql = readFileSync(join(root, "0003_client_files.sql"), "utf8");
    expect(sql).toMatch(/ALTER TYPE "document_scope" ADD VALUE IF NOT EXISTS 'client'/);
    expect(sql).toMatch(/CREATE TABLE "client_domains"/);
    expect(sql).toMatch(/CREATE TABLE "client_uploads"/);
    expect(sql).toMatch(/ALTER TABLE "documents" ALTER COLUMN "size" TYPE bigint/);
    expect(sql).toMatch(/ADD COLUMN "client_domain_id"/);
    expect(sql).toMatch(/ADD COLUMN "uploader_email"/);
  });
});

describe("schema", () => {
  it("knows the client scope and the upload statuses", () => {
    expect(documentScopeEnum.enumValues).toEqual(["pursuit", "library", "client"]);
    expect(CLIENT_UPLOAD_STATUSES).toEqual(["pending", "complete", "aborted"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/migrations.test.ts`
Expected: FAIL, `CLIENT_UPLOAD_STATUSES` is not exported and the migration file does not exist.

- [ ] **Step 3: Update the schema**

In `src/lib/db/schema.ts`:

Change the import line to add `bigint`:

```ts
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
```

Change the scope enum:

```ts
export const documentScopeEnum = pgEnum("document_scope", ["pursuit", "library", "client"]);
```

Replace the whole `documents` table and the sketched `clientDomains` table with:

```ts
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
```

In the types block near the bottom, keep `ClientDomain` and `NewClientDomain` and add:

```ts
export type ClientUpload = typeof clientUploads.$inferSelect;
export type NewClientUpload = typeof clientUploads.$inferInsert;
```

- [ ] **Step 4: Write the migration**

```sql
-- drizzle/0003_client_files.sql
ALTER TYPE "document_scope" ADD VALUE IF NOT EXISTS 'client';
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
```

The `ALTER TYPE ... ADD VALUE` runs first and the new value is not used anywhere else in this file, which is what Postgres requires inside the migrator's transaction.

Append to `drizzle/meta/_journal.json` `entries`:

```json
{
  "idx": 3,
  "version": "7",
  "when": 1789170000000,
  "tag": "0003_client_files",
  "breakpoints": true
}
```

- [ ] **Step 5: Run the test and the type check**

Run: `npx vitest run src/lib/db/migrations.test.ts && npx tsc --noEmit`
Expected: PASS, 3 tests; tsc clean. If tsc complains that `size` is now `number` somewhere, it is not: `bigint` in number mode infers `number`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0003_client_files.sql drizzle/meta/_journal.json src/lib/db/migrations.test.ts
git commit -m "feat(db): client domains, client uploads, bigint document size

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Database helpers

**Files:**
- Create: `src/lib/db/client-domains.ts`
- Create: `src/lib/db/client-uploads.ts`
- Modify: `src/lib/db/documents.ts`
- Modify: `src/lib/db/pursuits.ts`

The repository does not unit-test its thin Drizzle modules; every consumer mocks them by module path. Follow that: no test file here, `npx tsc --noEmit` is the check. Later tasks test the consumers.

**Interfaces:**
- Produces:
  - `listActiveClientDomains(): Promise<ClientDomain[]>`
  - `findActiveClientDomain(domain: string): Promise<ClientDomain | null>`
  - `findClientDomainByName(domain: string): Promise<ClientDomain | null>` (any state)
  - `findClientDomainForEmail(email: string | null | undefined): Promise<ClientDomain | null>` (active only, never meritusvia.com)
  - `getClientDomain(id: string): Promise<ClientDomain | null>`
  - `insertClientDomain(values: NewClientDomain): Promise<ClientDomain>`
  - `reactivateClientDomain(id: string, patch: { firm: string; pursuitId: string | null }): Promise<ClientDomain | null>`
  - `setClientDomainPursuit(id: string, pursuitId: string | null): Promise<ClientDomain | null>`
  - `removeClientDomain(id: string, now?: Date): Promise<boolean>`
  - `insertClientUpload(values: NewClientUpload): Promise<ClientUpload>`
  - `getClientUpload(id: string): Promise<ClientUpload | null>`
  - `updateClientUpload(id: string, patch: { status?: ClientUploadStatus; documentId?: string | null }): Promise<void>`
  - `listStaleClientUploads(before: Date, limit?: number): Promise<ClientUpload[]>`
  - `listClientDocuments(clientDomainId: string): Promise<DocumentRow[]>`
  - `listPursuitsForLinking(): Promise<Pursuit[]>`

- [ ] **Step 1: Create `src/lib/db/client-domains.ts`**

```ts
import { and, asc, eq, isNull } from "drizzle-orm";
import { domainFromEmail, isReservedDirectorDomain } from "@/lib/portal/domains";
import { requireDb } from "./index";
import { clientDomains, type ClientDomain, type NewClientDomain } from "./schema";

export async function listActiveClientDomains(): Promise<ClientDomain[]> {
  const db = requireDb();
  return db
    .select()
    .from(clientDomains)
    .where(isNull(clientDomains.removedAt))
    .orderBy(asc(clientDomains.domain));
}

export async function findActiveClientDomain(domain: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(clientDomains)
    .where(and(eq(clientDomains.domain, domain), isNull(clientDomains.removedAt)))
    .limit(1);
  return row ?? null;
}

/** Any row for the domain, removed or not, so a re-listed domain reuses its id and keeps its files. */
export async function findClientDomainByName(domain: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.domain, domain)).limit(1);
  return row ?? null;
}

/** The active domain for an address, or null. meritusvia.com never matches. */
export async function findClientDomainForEmail(
  email: string | null | undefined
): Promise<ClientDomain | null> {
  const domain = domainFromEmail(email);
  if (!domain || isReservedDirectorDomain(domain)) return null;
  return findActiveClientDomain(domain);
}

export async function getClientDomain(id: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.id, id)).limit(1);
  return row ?? null;
}

export async function insertClientDomain(values: NewClientDomain): Promise<ClientDomain> {
  const db = requireDb();
  const [row] = await db.insert(clientDomains).values(values).returning();
  return row;
}

export async function reactivateClientDomain(
  id: string,
  patch: { firm: string; pursuitId: string | null }
): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .update(clientDomains)
    .set({ firm: patch.firm, pursuitId: patch.pursuitId, removedAt: null })
    .where(eq(clientDomains.id, id))
    .returning();
  return row ?? null;
}

export async function setClientDomainPursuit(
  id: string,
  pursuitId: string | null
): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .update(clientDomains)
    .set({ pursuitId })
    .where(and(eq(clientDomains.id, id), isNull(clientDomains.removedAt)))
    .returning();
  return row ?? null;
}

/** Marks the domain removed. Files and upload rows keep pointing at it. */
export async function removeClientDomain(id: string, now: Date = new Date()): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .update(clientDomains)
    .set({ removedAt: now })
    .where(and(eq(clientDomains.id, id), isNull(clientDomains.removedAt)))
    .returning({ id: clientDomains.id });
  return rows.length > 0;
}
```

- [ ] **Step 2: Create `src/lib/db/client-uploads.ts`**

```ts
import { and, asc, eq, lt } from "drizzle-orm";
import { requireDb } from "./index";
import { clientUploads, type ClientUpload, type ClientUploadStatus, type NewClientUpload } from "./schema";

export async function insertClientUpload(values: NewClientUpload): Promise<ClientUpload> {
  const db = requireDb();
  const [row] = await db.insert(clientUploads).values(values).returning();
  return row;
}

export async function getClientUpload(id: string): Promise<ClientUpload | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientUploads).where(eq(clientUploads.id, id)).limit(1);
  return row ?? null;
}

export async function updateClientUpload(
  id: string,
  patch: { status?: ClientUploadStatus; documentId?: string | null }
): Promise<void> {
  const db = requireDb();
  await db
    .update(clientUploads)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clientUploads.id, id));
}

/** Pending uploads started before `before`, oldest first, capped so a sweep stays cheap. */
export async function listStaleClientUploads(before: Date, limit = 20): Promise<ClientUpload[]> {
  const db = requireDb();
  return db
    .select()
    .from(clientUploads)
    .where(and(eq(clientUploads.status, "pending"), lt(clientUploads.createdAt, before)))
    .orderBy(asc(clientUploads.createdAt))
    .limit(limit);
}
```

- [ ] **Step 3: Add to `src/lib/db/documents.ts`**

Append:

```ts
/** Every file a client domain has sent, newest first, whether or not it landed on a pursuit. */
export async function listClientDocuments(clientDomainId: string): Promise<DocumentRow[]> {
  const db = requireDb();
  return db
    .select()
    .from(documents)
    .where(eq(documents.clientDomainId, clientDomainId))
    .orderBy(desc(documents.createdAt));
}
```

- [ ] **Step 4: Add to `src/lib/db/pursuits.ts`**

Change the first import line to include `asc` and `ne`:

```ts
import { and, asc, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
```

Append:

```ts
/** Every pursuit a client domain could be linked to: everything but declined, by firm name. */
export async function listPursuitsForLinking(): Promise<Pursuit[]> {
  const db = requireDb();
  return db.select().from(pursuits).where(ne(pursuits.stage, "declined")).orderBy(asc(pursuits.firm));
}
```

- [ ] **Step 5: Type check and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all existing tests pass (nothing consumes the new helpers yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/client-domains.ts src/lib/db/client-uploads.ts src/lib/db/documents.ts src/lib/db/pursuits.ts
git commit -m "feat(db): client domain, client upload and linking queries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Roles and identity

**Files:**
- Create: `src/lib/portal/roles.ts`
- Create: `src/types/clerk.d.ts`
- Test: `src/lib/portal/roles.test.ts`

**Interfaces:**
- Produces: `ROLES`, `type Role = "director" | "client"`, `type Identity = { userId: string; role: Role | null; domain: string | null; email: string | null }`, `roleFromMetadata(value: unknown): Role | null`, `identityFromClaims(userId: string, claims: unknown): Identity | null`, `resolveIdentity(userId: string, claims: unknown): Promise<Identity>`, `__resetIdentityCache(): void`.
- Consumes: `clerkClient` from `@clerk/nextjs/server` (`const client = await clerkClient(); client.users.getUser(userId)`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/portal/roles.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, clerkClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  const clerkClient = vi.fn(async () => ({ users: { getUser } }));
  return { getUser, clerkClient };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient }));

import { __resetIdentityCache, identityFromClaims, resolveIdentity, roleFromMetadata } from "./roles";

beforeEach(() => {
  __resetIdentityCache();
  getUser.mockReset();
  clerkClient.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("roleFromMetadata", () => {
  it("accepts only the two roles", () => {
    expect(roleFromMetadata("director")).toBe("director");
    expect(roleFromMetadata("client")).toBe("client");
    expect(roleFromMetadata("admin")).toBeNull();
    expect(roleFromMetadata(undefined)).toBeNull();
  });
});

describe("identityFromClaims", () => {
  it("reads the metadata claim", () => {
    expect(
      identityFromClaims("user_1", { metadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" } })
    ).toEqual({ userId: "user_1", role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" });
  });
  it("is null without a metadata claim", () => {
    expect(identityFromClaims("user_1", { sub: "user_1" })).toBeNull();
    expect(identityFromClaims("user_1", null)).toBeNull();
  });
});

describe("resolveIdentity", () => {
  it("uses the claim and never calls Clerk when the claim carries a role", async () => {
    const identity = await resolveIdentity("user_1", { metadata: { role: "director" } });
    expect(identity).toEqual({ userId: "user_1", role: "director", domain: null, email: null });
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("falls back to the Backend API, reads public metadata and the primary email, and caches", async () => {
    getUser.mockResolvedValue({
      id: "user_2",
      publicMetadata: { role: "client", domain: "example-firm.co.uk" },
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_0", emailAddress: "old@example-firm.co.uk" },
        { id: "em_1", emailAddress: "jane@example-firm.co.uk" },
      ],
    });
    const first = await resolveIdentity("user_2", { sub: "user_2" });
    const second = await resolveIdentity("user_2", undefined);
    expect(first).toEqual({ userId: "user_2", role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" });
    expect(second).toEqual(first);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("expires the cache after five minutes", async () => {
    vi.useFakeTimers();
    getUser.mockResolvedValue({ id: "user_3", publicMetadata: { role: "director" }, primaryEmailAddressId: null, emailAddresses: [] });
    await resolveIdentity("user_3", null);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await resolveIdentity("user_3", null);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("returns no role when Clerk fails, and does not cache the failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockRejectedValueOnce(new Error("down"));
    expect(await resolveIdentity("user_4", null)).toEqual({ userId: "user_4", role: null, domain: null, email: null });
    getUser.mockResolvedValueOnce({ id: "user_4", publicMetadata: { role: "director" }, primaryEmailAddressId: null, emailAddresses: [] });
    expect((await resolveIdentity("user_4", null)).role).toBe("director");
  });

  it("denies a user whose metadata has no role", async () => {
    getUser.mockResolvedValue({ id: "user_5", publicMetadata: {}, primaryEmailAddressId: null, emailAddresses: [] });
    expect((await resolveIdentity("user_5", null)).role).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/roles.test.ts`
Expected: FAIL, cannot resolve `./roles`.

- [ ] **Step 3: Write the implementation and the claim type**

```ts
// src/lib/portal/roles.ts
/**
 * Who a signed-in user is to the portal. The role lives in Clerk `publicMetadata` (`director`
 * or `client`, set by William for directors and by /api/access for clients). The session token
 * carries it when the dashboard adds the `metadata` claim; otherwise the Backend API is asked
 * and the answer held for five minutes. Anything else is no role, which every gate denies.
 *
 * Server only: this module imports "@clerk/nextjs/server".
 */

import { clerkClient } from "@clerk/nextjs/server";

export const ROLES = ["director", "client"] as const;
export type Role = (typeof ROLES)[number];

export type Identity = {
  userId: string;
  role: Role | null;
  /** The client's company domain; null for directors. */
  domain: string | null;
  email: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { identity: Identity; expiresAt: number }>();

export function roleFromMetadata(value: unknown): Role | null {
  return value === "director" || value === "client" ? value : null;
}

function readMetadata(source: unknown): Pick<Identity, "role" | "domain" | "email"> | null {
  if (!source || typeof source !== "object") return null;
  const meta = source as Record<string, unknown>;
  return {
    role: roleFromMetadata(meta.role),
    domain: typeof meta.domain === "string" && meta.domain ? meta.domain : null,
    email: typeof meta.email === "string" && meta.email ? meta.email : null,
  };
}

/** The `metadata` session claim, when the Clerk dashboard has been told to add it. */
export function identityFromClaims(userId: string, claims: unknown): Identity | null {
  if (!claims || typeof claims !== "object") return null;
  const meta = readMetadata((claims as Record<string, unknown>).metadata);
  if (!meta) return null;
  return { userId, ...meta };
}

async function fetchIdentity(userId: string): Promise<Identity> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = readMetadata(user.publicMetadata) ?? { role: null, domain: null, email: null };
  const primary =
    user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  return { userId, role: meta.role, domain: meta.domain, email: meta.email ?? primary?.emailAddress ?? null };
}

export async function resolveIdentity(userId: string, claims: unknown): Promise<Identity> {
  const fromClaims = identityFromClaims(userId, claims);
  if (fromClaims?.role) return fromClaims;
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  try {
    const identity = await fetchIdentity(userId);
    cache.set(userId, { identity, expiresAt: Date.now() + CACHE_TTL_MS });
    return identity;
  } catch (error) {
    console.warn("Roles: Clerk user lookup unavailable", error);
    return { userId, role: null, domain: null, email: null };
  }
}

/** Test hook. */
export function __resetIdentityCache(): void {
  cache.clear();
}
```

```ts
// src/types/clerk.d.ts
export {};

declare global {
  interface CustomJwtSessionClaims {
    /** Added by the Clerk dashboard claim {"metadata": "{{user.public_metadata}}"}. */
    metadata?: { role?: string; domain?: string; email?: string };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/portal/roles.test.ts && npx tsc --noEmit`
Expected: PASS, 8 tests; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/roles.ts src/lib/portal/roles.test.ts src/types/clerk.d.ts
git commit -m "feat(auth): resolve director or client identity from Clerk metadata

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Gate decision and middleware

**Files:**
- Create: `src/lib/portal/gate.ts`
- Test: `src/lib/portal/gate.test.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Produces: `isPortalPath(pathname): boolean`, `isClientPath(pathname): boolean`, `isApiPath(pathname): boolean`, `type GateDecision = { kind: "next" } | { kind: "redirect"; to: string } | { kind: "json"; status: 401 | 403; error: string }`, `decideGate(input: { pathname: string; signedIn: boolean; role: Role | null }): GateDecision`.
- Consumes: `Role` type from Task 4 (type import only; `gate.ts` has no runtime imports so it stays testable without Clerk).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/portal/gate.test.ts
import { describe, expect, it } from "vitest";
import { decideGate, isClientPath, isPortalPath } from "./gate";

describe("path matchers", () => {
  it("match the portal and its api, and the client desk and its api", () => {
    expect(isPortalPath("/portal")).toBe(true);
    expect(isPortalPath("/portal/clients")).toBe(true);
    expect(isPortalPath("/api/portal/documents/x")).toBe(true);
    expect(isPortalPath("/portfolio")).toBe(false);
    expect(isClientPath("/client")).toBe(true);
    expect(isClientPath("/api/client/uploads")).toBe(true);
    expect(isClientPath("/clients")).toBe(false);
    expect(isClientPath("/access")).toBe(false);
  });
});

describe("decideGate", () => {
  it("lets public paths through whoever asks", () => {
    expect(decideGate({ pathname: "/access", signedIn: false, role: null })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/", signedIn: true, role: "client" })).toEqual({ kind: "next" });
  });

  it("sends signed-out visitors to the right door", () => {
    expect(decideGate({ pathname: "/portal", signedIn: false, role: null })).toEqual({ kind: "redirect", to: "/sign-in" });
    expect(decideGate({ pathname: "/client", signedIn: false, role: null })).toEqual({ kind: "redirect", to: "/access" });
    expect(decideGate({ pathname: "/api/portal/library", signedIn: false, role: null })).toEqual({ kind: "json", status: 401, error: "Unauthorized" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: false, role: null })).toEqual({ kind: "json", status: 401, error: "Unauthorized" });
  });

  it("admits directors everywhere", () => {
    expect(decideGate({ pathname: "/portal/clients", signedIn: true, role: "director" })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: "director" })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: true, role: "director" })).toEqual({ kind: "next" });
  });

  it("keeps clients out of the portal and sends them to their desk", () => {
    expect(decideGate({ pathname: "/portal", signedIn: true, role: "client" })).toEqual({ kind: "redirect", to: "/client" });
    expect(decideGate({ pathname: "/api/portal/library", signedIn: true, role: "client" })).toEqual({ kind: "json", status: 403, error: "Directors only" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: "client" })).toEqual({ kind: "next" });
  });

  it("dead-ends a signed-in user with no role", () => {
    expect(decideGate({ pathname: "/portal", signedIn: true, role: null })).toEqual({ kind: "redirect", to: "/access/denied" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: null })).toEqual({ kind: "redirect", to: "/access/denied" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: true, role: null })).toEqual({ kind: "json", status: 403, error: "No access" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/gate.test.ts`
Expected: FAIL, cannot resolve `./gate`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/portal/gate.ts
/** The middleware's decision, kept pure so every path and role pairing can be tested without Clerk. */
import type { Role } from "./roles";

export type GateDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  | { kind: "json"; status: 401 | 403; error: string };

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isPortalPath(pathname: string): boolean {
  return under(pathname, "/portal") || under(pathname, "/api/portal");
}

export function isClientPath(pathname: string): boolean {
  return under(pathname, "/client") || under(pathname, "/api/client");
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function decideGate(input: { pathname: string; signedIn: boolean; role: Role | null }): GateDecision {
  const { pathname, signedIn, role } = input;
  const portal = isPortalPath(pathname);
  const client = isClientPath(pathname);
  if (!portal && !client) return { kind: "next" };
  const api = isApiPath(pathname);

  if (!signedIn) {
    if (api) return { kind: "json", status: 401, error: "Unauthorized" };
    return { kind: "redirect", to: client ? "/access" : "/sign-in" };
  }

  if (portal) {
    if (role === "director") return { kind: "next" };
    if (api) return { kind: "json", status: 403, error: "Directors only" };
    return { kind: "redirect", to: role === "client" ? "/client" : "/access/denied" };
  }

  if (role === "client" || role === "director") return { kind: "next" };
  if (api) return { kind: "json", status: 403, error: "No access" };
  return { kind: "redirect", to: "/access/denied" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/portal/gate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Rewrite the middleware**

Replace `src/middleware.ts` in full:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { decideGate, isClientPath, isPortalPath } from "@/lib/portal/gate";
import { resolveIdentity } from "@/lib/portal/roles";

/**
 * /portal and /api/portal are for directors; /client and /api/client for clients (directors may
 * look). Every page and route checks the role again in its own guard; this is the outer wall.
 */
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  if (!isPortalPath(pathname) && !isClientPath(pathname)) return;

  const { userId, sessionClaims } = await auth();
  const role = userId ? (await resolveIdentity(userId, sessionClaims)).role : null;
  const decision = decideGate({ pathname, signedIn: Boolean(userId), role });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }
  if (decision.kind === "json") {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }
  return;
});

export default function middleware(request: NextRequest, event: unknown) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  return clerkHandler(request, event as never);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

The `matcher` is unchanged. A signed-out visitor to `/portal` used to be redirected by `auth.protect()` with a return URL; now it is a plain redirect to `/sign-in`, whose `forceRedirectUrl="/portal"` brings them back.

- [ ] **Step 6: Type check and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean and green. There is no middleware test; the gate test covers the decision.

- [ ] **Step 7: Commit**

```bash
git add src/lib/portal/gate.ts src/lib/portal/gate.test.ts src/middleware.ts
git commit -m "feat(auth): role-aware middleware for the portal and the client desk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Guards check the role again

**Files:**
- Modify: `src/lib/portal/auth.ts`
- Test: `src/lib/portal/auth.test.ts` (new)
- Modify: `src/lib/portal/actions.test.ts` (mock `./roles`)

**Interfaces:**
- `requirePortalUser()` keeps its shape; a signed-in non-director now gets `{ error: 403 JSON { error: "Directors only", code: "FORBIDDEN" } }`.
- `requireActionUser()` keeps its shape; a non-director gets `{ ok: false, error: "Directors only" }`.
- New: `type ClientIdentity = Identity & { role: Role }`, `requireClientUser(): Promise<{ identity: ClientIdentity; error?: undefined } | { identity?: undefined; error: NextResponse }>`. Admits `client` and `director`; a director carries `domain: null`, and routes that need a domain answer 403 themselves.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/portal/auth.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { resolveIdentity } from "./roles";
import { requireActionUser, requireClientUser, requirePortalUser } from "./auth";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("./roles", () => ({ resolveIdentity: vi.fn() }));

const director = { userId: "user_wr", role: "director" as const, domain: null, email: "william@meritusvia.com" };
const client = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  process.env.CLERK_SECRET_KEY = "sk_test";
  process.env.DATABASE_URL = "postgres://test";
  vi.mocked(auth).mockResolvedValue({ userId: "user_wr", sessionClaims: { sub: "user_wr" } } as never);
  vi.mocked(resolveIdentity).mockResolvedValue(director);
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.DATABASE_URL;
});

describe("requirePortalUser", () => {
  it("admits a director", async () => {
    expect(await requirePortalUser()).toEqual({ userId: "user_wr" });
    expect(resolveIdentity).toHaveBeenCalledWith("user_wr", { sub: "user_wr" });
  });
  it("answers 401 when nobody is signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(401);
  });
  it("answers 403 to a client and to a user with no role", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect((await requirePortalUser()).error?.status).toBe(403);
    vi.mocked(resolveIdentity).mockResolvedValue({ ...director, role: null });
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(403);
    expect(await result.error?.json()).toEqual({ error: "Directors only", code: "FORBIDDEN" });
  });
  it("answers 503 when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;
    expect((await requirePortalUser()).error?.status).toBe(503);
  });
});

describe("requireActionUser", () => {
  it("admits a director", async () => {
    expect(await requireActionUser()).toEqual({ ok: true, userId: "user_wr" });
  });
  it("refuses a client", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect(await requireActionUser()).toEqual({ ok: false, error: "Directors only" });
  });
  it("asks for a sign-in when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    expect(await requireActionUser()).toEqual({ ok: false, error: "Sign in again" });
  });
});

describe("requireClientUser", () => {
  it("admits a client with their domain", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_c", sessionClaims: null } as never);
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect(await requireClientUser()).toEqual({ identity: client });
  });
  it("admits a director with no domain", async () => {
    expect(await requireClientUser()).toEqual({ identity: director });
  });
  it("answers 403 to a user with no role and 401 to nobody", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue({ ...client, role: null });
    expect((await requireClientUser()).error?.status).toBe(403);
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    expect((await requireClientUser()).error?.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/auth.test.ts`
Expected: FAIL: `requireClientUser` is not exported and the 403 cases return `{ userId }`.

- [ ] **Step 3: Update `src/lib/portal/auth.ts`**

Replace the file in full:

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { resolveIdentity, type Identity, type Role } from "./roles";

function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}

/** A route-handler gate for directors. The middleware has already checked; this checks again. */
export async function requirePortalUser(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Clerk is not configured", code: "SETUP" },
        { status: 503 }
      ),
    };
  }

  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "director") {
    return { error: forbidden("Directors only") };
  }

  return { userId };
}

export type ClientIdentity = Identity & { role: Role };

/** A route-handler gate for the client desk. Clients and directors pass; a director has no domain. */
export async function requireClientUser(): Promise<
  { identity: ClientIdentity; error?: undefined } | { identity?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return { error: setupResponse("Clerk is not configured") };
  }
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "client" && identity.role !== "director") {
    return { error: forbidden("No access") };
  }
  return { identity: { ...identity, role: identity.role } };
}

export function setupResponse(message = "Portal is not fully configured"): NextResponse {
  return NextResponse.json({ error: message, code: "SETUP" }, { status: 503 });
}

export function requireDatabaseOr503(): NextResponse | null {
  if (!isDatabaseConfigured()) {
    return setupResponse("DATABASE_URL is not configured");
  }
  return null;
}

export type ActionUser = { ok: true; userId: string } | { ok: false; error: string };

/**
 * The server-action counterpart of requirePortalUser: a result object rather than a
 * NextResponse, so an action can hand it straight back to the client.
 */
export async function requireActionUser(): Promise<ActionUser> {
  if (!isClerkConfigured()) {
    return { ok: false, error: "Clerk is not configured" };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "DATABASE_URL is not configured" };
  }
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in again" };
  }
  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "director") {
    return { ok: false, error: "Directors only" };
  }
  return { ok: true, userId };
}
```

- [ ] **Step 4: Teach `actions.test.ts` about roles**

In `src/lib/portal/actions.test.ts`, after the line `import { deleteObjects } from "./s3";` add:

```ts
import { resolveIdentity } from "./roles";
```

After `vi.mock("./s3", () => ({ deleteObjects: vi.fn() }));` add:

```ts
vi.mock("./roles", () => ({ resolveIdentity: vi.fn() }));
```

In the `beforeEach` that sets `vi.mocked(auth).mockResolvedValue({ userId: "user_wr" } as never)` (around line 127), add directly after it:

```ts
vi.mocked(resolveIdentity).mockResolvedValue({ userId: "user_wr", role: "director", domain: null, email: null });
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/portal/auth.test.ts src/lib/portal/actions.test.ts && npx tsc --noEmit`
Expected: PASS for both files; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portal/auth.ts src/lib/portal/auth.test.ts src/lib/portal/actions.test.ts
git commit -m "feat(auth): guards require the director role; client guard for the desk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Directors are an explicit list

**Files:**
- Modify: `src/lib/portal/directors.ts`
- Modify: `src/lib/portal/directors.test.ts`

**Interfaces:** `listDirectors()` and `getDirector()` keep their signatures and now return only users whose `publicMetadata.role === "director"`.

- [ ] **Step 1: Write the failing test**

In `src/lib/portal/directors.test.ts`:

Change the `clerkUser` helper so its parameter type gains `publicMetadata?: Record<string, unknown> | null` and its defaults include `publicMetadata: {}`:

```ts
function clerkUser(overrides: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmail[];
  publicMetadata?: Record<string, unknown> | null;
}) {
  return {
    firstName: null,
    lastName: null,
    primaryEmailAddressId: null,
    emailAddresses: [],
    publicMetadata: {},
    ...overrides,
  };
}
```

Add `publicMetadata: { role: "director" }` to both the `william` and `mateo` fixtures. Add a third fixture after `mateo`:

```ts
const clientJane = clerkUser({
  id: "user_jane",
  firstName: "Jane",
  lastName: "Partner",
  primaryEmailAddressId: "em_jane",
  emailAddresses: [{ id: "em_jane", emailAddress: "jane@example-firm.co.uk" }],
  publicMetadata: { role: "client", domain: "example-firm.co.uk" },
});

const noRole = clerkUser({
  id: "user_norole",
  primaryEmailAddressId: "em_norole",
  emailAddresses: [{ id: "em_norole", emailAddress: "someone@example.com" }],
  publicMetadata: {},
});
```

Change the `beforeEach` default to `getUserList.mockResolvedValue({ data: [william, mateo, clientJane, noRole], totalCount: 4 });` and add a test inside the existing `describe("listDirectors", ...)` block (or a new block if the file groups differently):

```ts
it("lists only users whose public metadata role is director", async () => {
  const directors = await listDirectors();
  expect(directors.map((d) => d.id)).toEqual(["user_ma", "user_wr"]);
  expect(await getDirector("user_jane")).toBeNull();
  expect(await getDirector("user_norole")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/directors.test.ts`
Expected: FAIL, the new test sees four directors.

- [ ] **Step 3: Filter by role**

In `src/lib/portal/directors.ts`:

Update the header comment's first sentence to: `The directors are the Clerk users whose publicMetadata.role is "director"; there is no directors table.`

Add to `ClerkUserLike`:

```ts
type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
  publicMetadata?: Record<string, unknown> | null;
};
```

Add a helper above `fetchDirectors`:

```ts
function isDirector(user: ClerkUserLike): boolean {
  return user.publicMetadata?.role === "director";
}
```

Change `fetchDirectors` to filter:

```ts
async function fetchDirectors(): Promise<Director[]> {
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: PAGE_LIMIT });
  return data.filter(isDirector).map((user) => toDirector(user)).sort(byName);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/portal/directors.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean. `PAGE_LIMIT` stays 50: three directors plus clients will not exceed it soon, and clients are filtered out anyway.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/directors.ts src/lib/portal/directors.test.ts
git commit -m "feat(auth): directors are the Clerk users with the director role

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Throttle for access requests

**Files:**
- Modify: `src/lib/db/throttle.ts`
- Modify: `src/lib/db/throttle.test.ts`
- Modify: `src/lib/portal/intake.ts` (`hashKey` prefix type)

**Interfaces:**
- Produces: `ACCESS_EMAIL_CAP = 5`, `ACCESS_IP_CAP = 30`, `ACCESS_GLOBAL_CAP = 200` (all per hour), `ACCESS_GLOBAL_KEY = "access-global"`, `decideAccessThrottle(counts: { email: number; ip: number; global: number }): boolean`, `registerAccessAttempt(keys: { email: string; ip: string }, now?: Date): Promise<boolean>`.
- `hashKey(prefix: "email" | "ip" | "access-email" | "access-ip", value: string): string`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db/throttle.test.ts`:

```ts
import { ACCESS_EMAIL_CAP, ACCESS_GLOBAL_CAP, ACCESS_IP_CAP, decideAccessThrottle } from "./throttle";

describe("decideAccessThrottle", () => {
  it("allows up to the caps and refuses past any one of them", () => {
    expect(decideAccessThrottle({ email: ACCESS_EMAIL_CAP, ip: 1, global: 1 })).toBe(true);
    expect(decideAccessThrottle({ email: ACCESS_EMAIL_CAP + 1, ip: 1, global: 1 })).toBe(false);
    expect(decideAccessThrottle({ email: 1, ip: ACCESS_IP_CAP + 1, global: 1 })).toBe(false);
    expect(decideAccessThrottle({ email: 1, ip: 1, global: ACCESS_GLOBAL_CAP + 1 })).toBe(false);
  });
  it("uses tighter windows than the enquiry form", () => {
    expect(ACCESS_EMAIL_CAP).toBe(5);
    expect(ACCESS_IP_CAP).toBe(30);
    expect(ACCESS_GLOBAL_CAP).toBe(200);
  });
});
```

If the file already imports from `./throttle` at the top, merge the new names into that import instead of adding a second import statement.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/throttle.test.ts`
Expected: FAIL, the names are not exported.

- [ ] **Step 3: Add the access counters**

In `src/lib/db/throttle.ts`, after the `PURGE_AFTER_MS` line add:

```ts
/** Access-link requests: all three counters run over one hour and share the enquiry table. */
export const ACCESS_WINDOW_MS = HOUR_MS;
export const ACCESS_EMAIL_CAP = 5;
export const ACCESS_IP_CAP = 30;
export const ACCESS_GLOBAL_CAP = 200;
export const ACCESS_GLOBAL_KEY = "access-global";

export function decideAccessThrottle(counts: { email: number; ip: number; global: number }): boolean {
  return counts.email <= ACCESS_EMAIL_CAP && counts.ip <= ACCESS_IP_CAP && counts.global <= ACCESS_GLOBAL_CAP;
}
```

After `registerEnquiryAttempt` add:

```ts
/**
 * Counts an access-link request against its hashed email, hashed IP and the access-global key.
 * `keys` are already hashed with the "access-email" and "access-ip" prefixes (intake.hashKey).
 */
export async function registerAccessAttempt(
  keys: { email: string; ip: string },
  now: Date = new Date()
): Promise<boolean> {
  const db = requireDb();
  const [emailRows, ipRows, globalRows] = await db.batch([
    bump(keys.email, ACCESS_WINDOW_MS, now),
    bump(keys.ip, ACCESS_WINDOW_MS, now),
    bump(ACCESS_GLOBAL_KEY, ACCESS_WINDOW_MS, now),
  ]);
  return decideAccessThrottle({
    email: emailRows[0]?.count ?? 1,
    ip: ipRows[0]?.count ?? 1,
    global: globalRows[0]?.count ?? 1,
  });
}
```

In `src/lib/portal/intake.ts` widen `hashKey`:

```ts
/** Throttle keys never hold an address: "<prefix>:<sha256>" of the lower-cased, trimmed value. */
export function hashKey(prefix: "email" | "ip" | "access-email" | "access-ip", value: string): string {
```

The body is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/throttle.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/throttle.ts src/lib/db/throttle.test.ts src/lib/portal/intake.ts
git commit -m "feat(access): rate limit link requests on their own counters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Issue the access link and send it

**Files:**
- Create: `src/lib/access/link.ts`
- Create: `src/lib/access/mail.ts`
- Create: `src/lib/access/request.ts`
- Test: `src/lib/access/link.test.ts`, `src/lib/access/mail.test.ts`

**Interfaces:**
- `link.ts` produces: `ACCESS_LINK_TTL_SECONDS = 1800`, `accessLinkOrigin(): string`, `continueUrl(origin: string, token: string): string`, `randomPassword(): string`, `type IssueResult = { ok: true; url: string; userId: string } | { ok: false; reason: "director" | "clerk_error" }`, `issueAccessLink(input: { email: string; domain: string; origin?: string }): Promise<IssueResult>`.
- `mail.ts` produces: `type AccessMailOutcome = { sentAt: string } | { error: string }`, `accessMailSubject(): string`, `accessMailText(url: string): string`, `sendAccessLink(input: { to: string; url: string }): Promise<AccessMailOutcome>`.
- `request.ts` produces: `parseAccessRequest(body: unknown): { ok: true; email: string } | { ok: false; error: string }`.
- Consumes: `ALERT_TIMEOUT_MS`, `alertFrom()` from `src/lib/portal/alerts.ts`; `isResendConfigured()` from `src/lib/env.ts`; `domainFromEmail` from Task 1; `SITE_CONFIG.url` from `src/lib/constants.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/access/link.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => {
  const getUserList = vi.fn();
  const createUser = vi.fn();
  const updateUserMetadata = vi.fn();
  const createSignInToken = vi.fn();
  const clerkClient = vi.fn(async () => ({
    users: { getUserList, createUser, updateUserMetadata },
    signInTokens: { createSignInToken },
  }));
  return { getUserList, createUser, updateUserMetadata, createSignInToken, clerkClient };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: clerk.clerkClient }));

import { ACCESS_LINK_TTL_SECONDS, accessLinkOrigin, continueUrl, issueAccessLink, randomPassword } from "./link";

beforeEach(() => {
  vi.clearAllMocks();
  clerk.getUserList.mockResolvedValue({ data: [], totalCount: 0 });
  clerk.createUser.mockResolvedValue({ id: "user_new" });
  clerk.updateUserMetadata.mockResolvedValue({ id: "user_old" });
  clerk.createSignInToken.mockResolvedValue({ id: "sit_1", token: "tok.abc/=", status: "pending", url: "https://clerk.example/x" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("accessLinkOrigin and continueUrl", () => {
  it("defaults to the site url and honours ACCESS_LINK_ORIGIN without a trailing slash", () => {
    expect(accessLinkOrigin()).toBe("https://meritusvia.com");
    vi.stubEnv("ACCESS_LINK_ORIGIN", "https://preview.example.com/");
    expect(accessLinkOrigin()).toBe("https://preview.example.com");
  });
  it("encodes the ticket", () => {
    expect(continueUrl("https://meritusvia.com", "tok.abc/=")).toBe("https://meritusvia.com/access/continue?ticket=tok.abc%2F%3D");
  });
});

describe("randomPassword", () => {
  it("is long and never repeats", () => {
    const a = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(randomPassword());
  });
});

describe("issueAccessLink", () => {
  it("creates a client user with the role, domain and address, then mints a 30-minute token", async () => {
    const result = await issueAccessLink({ email: "Jane@Example-Firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.getUserList).toHaveBeenCalledWith({ emailAddress: ["jane@example-firm.co.uk"], limit: 1 });
    expect(clerk.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: ["jane@example-firm.co.uk"],
        skipPasswordChecks: true,
        publicMetadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" },
      })
    );
    expect(clerk.createUser.mock.calls[0][0].password.length).toBeGreaterThanOrEqual(40);
    expect(clerk.createSignInToken).toHaveBeenCalledWith({ userId: "user_new", expiresInSeconds: ACCESS_LINK_TTL_SECONDS });
    expect(result).toEqual({ ok: true, url: "https://meritusvia.com/access/continue?ticket=tok.abc%2F%3D", userId: "user_new" });
  });

  it("reuses an existing client user without touching their metadata", async () => {
    clerk.getUserList.mockResolvedValue({
      data: [{ id: "user_old", publicMetadata: { role: "client", domain: "example-firm.co.uk" } }],
      totalCount: 1,
    });
    const result = await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.createUser).not.toHaveBeenCalled();
    expect(clerk.updateUserMetadata).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, userId: "user_old" });
  });

  it("stamps the client role on an existing user who has none", async () => {
    clerk.getUserList.mockResolvedValue({ data: [{ id: "user_old", publicMetadata: {} }], totalCount: 1 });
    await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.updateUserMetadata).toHaveBeenCalledWith("user_old", {
      publicMetadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" },
    });
  });

  it("never issues a client link to a director", async () => {
    clerk.getUserList.mockResolvedValue({ data: [{ id: "user_wr", publicMetadata: { role: "director" } }], totalCount: 1 });
    expect(await issueAccessLink({ email: "w@example-firm.co.uk", domain: "example-firm.co.uk" })).toEqual({ ok: false, reason: "director" });
    expect(clerk.createSignInToken).not.toHaveBeenCalled();
  });

  it("reports a Clerk failure without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    clerk.createSignInToken.mockRejectedValue(new Error("boom"));
    expect(await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" })).toEqual({ ok: false, reason: "clerk_error" });
  });
});
```

```ts
// src/lib/access/mail.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { ALERT_TIMEOUT_MS } from "@/lib/portal/alerts";
import { accessMailSubject, accessMailText, sendAccessLink } from "./mail";

const url = "https://meritusvia.com/access/continue?ticket=abc";

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ENQUIRY_ALERT_FROM", "enquiries@meritusvia.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("accessMailText", () => {
  it("carries the link, the 30-minute rule and the re-request address", () => {
    const text = accessMailText(url);
    expect(text).toContain(url);
    expect(text).toMatch(/30 minutes/);
    expect(text).toContain("https://meritusvia.com/access");
  });
  it("has the agreed subject", () => {
    expect(accessMailSubject()).toBe("Your Meritus file link");
  });
});

describe("sendAccessLink", () => {
  it("sends plain text from the enquiry sender with a timeout signal", async () => {
    const outcome = await sendAccessLink({ to: "jane@example-firm.co.uk", url });
    expect(send).toHaveBeenCalledTimes(1);
    const [payload, options] = send.mock.calls[0];
    expect(payload).toEqual({ from: "enquiries@meritusvia.com", to: ["jane@example-firm.co.uk"], subject: "Your Meritus file link", text: accessMailText(url) });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(outcome).toHaveProperty("sentAt");
  });
  it("reports the Resend error", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad", statusCode: 422 } });
    expect(await sendAccessLink({ to: "jane@example-firm.co.uk", url })).toEqual({ error: "validation_error: bad" });
  });
  it("fails clearly when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendAccessLink({ to: "jane@example-firm.co.uk", url })).toEqual({ error: "Resend is not configured" });
    expect(send).not.toHaveBeenCalled();
  });
  it("times out", async () => {
    vi.useFakeTimers();
    send.mockReturnValue(new Promise(() => {}));
    const pending = sendAccessLink({ to: "jane@example-firm.co.uk", url });
    await vi.advanceTimersByTimeAsync(ALERT_TIMEOUT_MS + 1);
    expect(await pending).toEqual({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/access`
Expected: FAIL, modules missing.

- [ ] **Step 3: Write the three modules**

```ts
// src/lib/access/link.ts
/**
 * A client gets in with a Clerk sign-in token: single use, thirty minutes, delivered by Resend.
 * The Clerk user is created on first request with a password nobody sees, so the instance's
 * password requirement is met without a form. Server only.
 */

import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { SITE_CONFIG } from "@/lib/constants";

export const ACCESS_LINK_TTL_SECONDS = 30 * 60;

export type IssueResult =
  | { ok: true; url: string; userId: string }
  | { ok: false; reason: "director" | "clerk_error" };

export function accessLinkOrigin(): string {
  const raw = process.env.ACCESS_LINK_ORIGIN?.trim() || SITE_CONFIG.url;
  return raw.replace(/\/+$/, "");
}

export function continueUrl(origin: string, token: string): string {
  return `${origin}/access/continue?ticket=${encodeURIComponent(token)}`;
}

export function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueAccessLink(input: {
  email: string;
  domain: string;
  origin?: string;
}): Promise<IssueResult> {
  const email = input.email.trim().toLowerCase();
  const origin = input.origin ?? accessLinkOrigin();
  const metadata = { role: "client", domain: input.domain, email };
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const existing = data[0];
    let userId: string;
    if (existing) {
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      if (meta.role === "director") return { ok: false, reason: "director" };
      if (meta.role !== "client" || meta.domain !== input.domain) {
        await client.users.updateUserMetadata(existing.id, { publicMetadata: metadata });
      }
      userId = existing.id;
    } else {
      const created = await client.users.createUser({
        emailAddress: [email],
        password: randomPassword(),
        skipPasswordChecks: true,
        publicMetadata: metadata,
      });
      userId = created.id;
    }
    const token = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: ACCESS_LINK_TTL_SECONDS,
    });
    return { ok: true, url: continueUrl(origin, token.token), userId };
  } catch (error) {
    // Clerk error bodies can quote the address, so only the error name is logged.
    console.warn("Access: Clerk unavailable", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "clerk_error" };
  }
}
```

```ts
// src/lib/access/mail.ts
import { Resend, type CreateEmailRequestOptions } from "resend";
import { isResendConfigured } from "@/lib/env";
import { ALERT_TIMEOUT_MS, alertFrom } from "@/lib/portal/alerts";

export type AccessMailOutcome = { sentAt: string } | { error: string };

export function accessMailSubject(): string {
  return "Your Meritus file link";
}

export function accessMailText(url: string): string {
  const origin = url.split("/access/")[0];
  return [
    "Use this link within 30 minutes to open your Meritus upload desk:",
    "",
    url,
    "",
    `The link works once. If it has expired, request another at ${origin}/access.`,
    "",
    "If you did not request it, ignore this email.",
    "",
    "Meritus Via",
  ].join("\n");
}

/** Same client, sender, timeout and outcome style as the enquiry alert. Never throws. */
export async function sendAccessLink(input: { to: string; url: string }): Promise<AccessMailOutcome> {
  if (!isResendConfigured()) return { error: "Resend is not configured" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AccessMailOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` }),
      ALERT_TIMEOUT_MS
    );
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const options = { signal: AbortSignal.timeout(ALERT_TIMEOUT_MS) } as CreateEmailRequestOptions;
    const request = resend.emails
      .send(
        { from: alertFrom(), to: [input.to], subject: accessMailSubject(), text: accessMailText(input.url) },
        options
      )
      .then(({ error }): AccessMailOutcome => {
        if (error) return { error: `${error.name}: ${error.message}` };
        return { sentAt: new Date().toISOString() };
      });
    return await Promise.race([request, timeout]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```

```ts
// src/lib/access/request.ts
import { domainFromEmail } from "@/lib/portal/domains";

/** The one field on /access. Anything that is not a plausible address is refused before any lookup. */
export function parseAccessRequest(body: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).email : null;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || /\s/.test(email) || !domainFromEmail(email)) {
    return { ok: false, error: "Enter your work email address" };
  }
  return { ok: true, email };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/access && npx tsc --noEmit`
Expected: PASS, 12 tests; tsc clean. If tsc rejects `skipPasswordChecks` or `publicMetadata` on `createUser`, check `node_modules/@clerk/backend/dist/api/endpoints/UserApi.d.ts`: both are in `CreateUserParams`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access
git commit -m "feat(access): mint a single-use Clerk sign-in link and send it through Resend

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The access route and pages

**Files:**
- Create: `src/app/api/access/route.ts`
- Test: `src/app/api/access/route.test.ts`
- Create: `src/app/access/page.tsx`, `src/components/access/AccessForm.tsx`, `src/components/access/AccessForm.test.tsx`
- Create: `src/app/access/continue/page.tsx`, `src/components/access/AccessContinue.tsx`
- Create: `src/app/access/denied/page.tsx`
- Modify: `.env.example` (add `ACCESS_LINK_ORIGIN`)

**Interfaces:**
- `POST /api/access` accepts JSON `{ email: string; company_website?: string }`. Replies: 200 `{ ok: true }` (always the same body whether or not the domain is listed), 400 `{ error }`, 429 `{ error }`, 502 `{ error }` when the link could not be prepared or sent, 503 `{ error, code: "SETUP" }` when Resend or the database is missing.
- Consumes: `isHoneypotFilled`, `firstHop`, `hashKey` from `src/lib/portal/intake.ts`; `registerAccessAttempt` (Task 8); `findClientDomainForEmail` (Task 3); `issueAccessLink`, `sendAccessLink`, `parseAccessRequest` (Task 9); `requireDatabaseOr503` (auth.ts).

- [ ] **Step 1: Write the failing route test**

```ts
// src/app/api/access/route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { registerAccessAttempt } from "@/lib/db/throttle";
import { issueAccessLink } from "@/lib/access/link";
import { sendAccessLink } from "@/lib/access/mail";
import { POST } from "./route";

vi.mock("@/lib/db/client-domains", () => ({ findClientDomainForEmail: vi.fn() }));
vi.mock("@/lib/db/throttle", () => ({ registerAccessAttempt: vi.fn() }));
vi.mock("@/lib/access/link", () => ({ issueAccessLink: vi.fn() }));
vi.mock("@/lib/access/mail", () => ({ sendAccessLink: vi.fn() }));

const domainRow = {
  id: "cd_1",
  domain: "example-firm.co.uk",
  firm: "Example Firm LLP",
  pursuitId: null,
  createdBy: "user_wr",
  createdAt: new Date("2026-09-12T09:00:00Z"),
  removedAt: null,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/access", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.mocked(registerAccessAttempt).mockResolvedValue(true);
  vi.mocked(findClientDomainForEmail).mockResolvedValue(domainRow);
  vi.mocked(issueAccessLink).mockResolvedValue({ ok: true, url: "https://meritusvia.com/access/continue?ticket=t", userId: "user_c" });
  vi.mocked(sendAccessLink).mockResolvedValue({ sentAt: "2026-09-12T09:00:00.000Z" });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/access", () => {
  it("issues and sends a link for a listed domain and answers generically", async () => {
    const res = await post({ email: "Jane@Example-Firm.co.uk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(registerAccessAttempt).toHaveBeenCalledWith({
      email: expect.stringMatching(/^access-email:[0-9a-f]{64}$/),
      ip: expect.stringMatching(/^access-ip:[0-9a-f]{64}$/),
    });
    expect(issueAccessLink).toHaveBeenCalledWith({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(sendAccessLink).toHaveBeenCalledWith({ to: "jane@example-firm.co.uk", url: "https://meritusvia.com/access/continue?ticket=t" });
  });

  it("answers the same way for an unlisted domain and sends nothing", async () => {
    vi.mocked(findClientDomainForEmail).mockResolvedValue(null);
    const res = await post({ email: "someone@unlisted.co.uk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(issueAccessLink).not.toHaveBeenCalled();
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it("answers the same way for a director's address", async () => {
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: false, reason: "director" });
    const res = await post({ email: "jane@example-firm.co.uk" });
    expect(res.status).toBe(200);
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it("refuses a bad address, bad JSON and a filled honeypot without any lookup", async () => {
    expect((await post({ email: "not an email" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    const trap = await post({ email: "jane@example-firm.co.uk", company_website: "http://spam" });
    expect(trap.status).toBe(200);
    expect(registerAccessAttempt).not.toHaveBeenCalled();
    expect(findClientDomainForEmail).not.toHaveBeenCalled();
  });

  it("answers 429 when throttled, before any lookup", async () => {
    vi.mocked(registerAccessAttempt).mockResolvedValue(false);
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(429);
    expect(findClientDomainForEmail).not.toHaveBeenCalled();
  });

  it("answers 503 when Resend or the database is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(503);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("DATABASE_URL", "");
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(503);
  });

  it("answers 502 when the link cannot be prepared or sent", async () => {
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: false, reason: "clerk_error" });
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(502);
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: true, url: "u", userId: "user_c" });
    vi.mocked(sendAccessLink).mockResolvedValue({ error: "boom" });
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/access/route.test.ts`
Expected: FAIL, cannot resolve `./route`.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/access/route.ts
import { NextResponse } from "next/server";
import { issueAccessLink } from "@/lib/access/link";
import { sendAccessLink } from "@/lib/access/mail";
import { parseAccessRequest } from "@/lib/access/request";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { registerAccessAttempt } from "@/lib/db/throttle";
import { isResendConfigured } from "@/lib/env";
import { requireDatabaseOr503, setupResponse } from "@/lib/portal/auth";
import { firstHop, hashKey, isHoneypotFilled } from "@/lib/portal/intake";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The same body for listed and unlisted domains, so nobody can learn who Meritus's clients are. */
function generic() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (isHoneypotFilled(body)) return generic();

  const parsed = parseAccessRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const email = parsed.email;

  const allowed = await registerAccessAttempt({
    email: hashKey("access-email", email),
    ip: hashKey("access-ip", firstHop(request.headers.get("x-forwarded-for"))),
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 });
  }
  if (!isResendConfigured()) return setupResponse("Email delivery is not configured");

  const domain = await findClientDomainForEmail(email);
  if (!domain) return generic();

  const issued = await issueAccessLink({ email, domain: domain.domain });
  if (!issued.ok) {
    if (issued.reason === "director") return generic();
    return NextResponse.json({ error: "We could not prepare your link. Try again in a minute." }, { status: 502 });
  }

  const mail = await sendAccessLink({ to: email, url: issued.url });
  if ("error" in mail) {
    console.warn("Access: link not sent", { domainId: domain.id, error: mail.error });
    return NextResponse.json({ error: "We could not send your link. Try again in a minute." }, { status: 502 });
  }
  return generic();
}
```

- [ ] **Step 4: Run the route test**

Run: `npx vitest run src/app/api/access/route.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the form component test**

```tsx
// src/components/access/AccessForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("AccessForm", () => {
  it("posts the address and shows the generic confirmation", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: /send my link/i }));
    expect(await screen.findByText(/if that organisation has been given access/i)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access");
    expect(JSON.parse(init.body)).toEqual({ email: "jane@example-firm.co.uk", company_website: "" });
  });

  it("shows the server's error and keeps the address", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Too many requests. Try again in an hour." }), { status: 429 }));
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: /send my link/i }));
    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toHaveValue("jane@example-firm.co.uk");
  });

  it("carries an empty honeypot the visitor cannot see", () => {
    render(<AccessForm />);
    const trap = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    expect(trap).not.toBeNull();
    expect(trap.tabIndex).toBe(-1);
    expect(trap.value).toBe("");
  });
});
```

- [ ] **Step 6: Run the component test to verify it fails**

Run: `npx vitest run src/components/access/AccessForm.test.tsx`
Expected: FAIL, cannot resolve `./AccessForm`.

- [ ] **Step 7: Write the form, the pages and the continue component**

```tsx
// src/components/access/AccessForm.tsx
"use client";

import { useState } from "react";

type State = { status: "idle" | "sending" | "sent" | "error"; error: string | null };

export const ACCESS_SENT_COPY = "If that organisation has been given access, a link is on its way. It works once and expires in 30 minutes.";

export function AccessForm() {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<State>({ status: "idle", error: null });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending", error: null });
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), company_website: trap }),
      });
      if (res.ok) {
        setState({ status: "sent", error: null });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState({ status: "error", error: body.error ?? "We could not send your link. Please try again." });
    } catch {
      setState({ status: "error", error: "We could not send your link. Please try again." });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="max-w-sm text-center text-[14px] leading-relaxed text-cream/85">
        {ACCESS_SENT_COPY}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
      <label className="block">
        <span className="portal-label text-brass">Work email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="portal-field text-cream placeholder:text-cream/40 border-cream/30"
          placeholder="you@yourfirm.co.uk"
        />
      </label>
      <input
        type="text"
        name="company_website"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px opacity-0"
      />
      <button type="submit" className="btn-brass text-[12px]" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Sending…" : "Send my link"}
      </button>
      {state.error ? <p className="text-[12px] text-brass">{state.error}</p> : null}
    </form>
  );
}
```

```tsx
// src/app/access/page.tsx
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { AccessForm } from "@/components/access/AccessForm";

export const metadata = {
  title: "Send documents to Meritus",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccessPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <h1 className="mb-3 font-serif text-3xl text-cream">Send documents to Meritus</h1>
      <p className="mb-8 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        Enter your work email. If your organisation has been given access, we will email you a
        link to a private upload desk. No password, nothing to install.
      </p>
      <AccessForm />
      <p className="mt-10 text-[12px] text-cream/50">
        Meritus directors sign in <Link href="/sign-in" className="text-brass hover:underline">here</Link>.
      </p>
    </main>
  );
}
```

```tsx
// src/components/access/AccessContinue.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Exchanges the ticket in the emailed link for a session. The legacy hook is used on purpose:
 * it exposes signIn.create({ strategy: "ticket" }) and setActive, which the ticket flow needs.
 */
export function AccessContinue() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const ticket = params.get("ticket");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (isSignedIn) {
      router.replace("/client");
      return;
    }
    if (!ticket) {
      setError("This link is missing its ticket. Request a new one.");
      return;
    }
    (async () => {
      try {
        const result = await signIn.create({ strategy: "ticket", ticket });
        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          router.replace("/client");
          return;
        }
        setError("This link could not be used. Request a new one.");
      } catch {
        setError("This link has expired or was already used. Request a new one.");
      }
    })();
  }, [isLoaded, isSignedIn, ticket, signIn, setActive, router]);

  if (error) {
    return (
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-cream/85">{error}</p>
        <Link href="/access" className="btn-brass mt-6 inline-flex text-[12px]">
          Request a new link
        </Link>
      </div>
    );
  }
  return (
    <p role="status" className="text-[14px] text-cream/70">
      Opening your upload desk…
    </p>
  );
}
```

```tsx
// src/app/access/continue/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import { AccessContinue } from "@/components/access/AccessContinue";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Opening your upload desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccessContinuePage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      {isClerkConfigured() ? (
        <Suspense fallback={null}>
          <AccessContinue />
        </Suspense>
      ) : (
        <div className="w-full max-w-lg">
          <SetupNotice title="Client access is not configured yet" />
        </div>
      )}
    </main>
  );
}
```

```tsx
// src/app/access/denied/page.tsx
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** A signed-in account with no role lands here instead of looping between sign-in and the portal. */
export default function AccessDeniedPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <h1 className="mb-3 font-serif text-3xl text-cream">This account has no access yet</h1>
      <p className="mb-8 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        Clients get in with an emailed link from the access page. Directors are set up by Meritus.
        If you expected access, contact enquiries@meritusvia.com.
      </p>
      <div className="flex items-center gap-6">
        <Link href="/access" className="btn-brass text-[12px]">Request a link</Link>
        {isClerkConfigured() ? (
          <SignOutButton redirectUrl="/access">
            <button type="button" className="text-[12px] text-cream/70 hover:text-brass">Sign out</button>
          </SignOutButton>
        ) : null}
      </div>
    </main>
  );
}
```

Add to `.env.example` under the Resend block:

```
# Optional: origin used in the emailed client access link (default https://meritusvia.com)
ACCESS_LINK_ORIGIN=
```

- [ ] **Step 8: Run the tests, the type check and the lint**

Run: `npx vitest run src/components/access src/app/api/access && npx tsc --noEmit && npm run lint`
Expected: PASS; clean. If tsc says `@clerk/nextjs/legacy` has no `useSignIn`, open `node_modules/@clerk/nextjs/dist/types/legacy.d.ts`; it re-exports the legacy hooks. If `SignOutButton` lacks `redirectUrl`, pass `signOutOptions={{ redirectUrl: "/access" }}` instead; check `node_modules/@clerk/react/dist` for the prop.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/access src/app/access src/components/access .env.example
git commit -m "feat(access): work-email page, link route, ticket exchange and a dead end for no-role accounts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: S3 transfer helpers

**Files:**
- Modify: `package.json` (add `@aws-sdk/s3-request-presigner`)
- Create: `src/lib/portal/s3-transfer.ts`
- Test: `src/lib/portal/s3-transfer.test.ts`
- Modify: `src/lib/portal/files.ts` (add `contentDisposition`) and create `src/lib/portal/files.test.ts`

**Interfaces:**
- Produces from `s3-transfer.ts`: `PART_URL_TTL_SECONDS = 3600`, `DOWNLOAD_URL_TTL_SECONDS = 60`, `s3Url(key: string): string`, `createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string }>`, `presignUploadPart(key: string, uploadId: string, partNumber: number): Promise<string>`, `type UploadedPart = { partNumber: number; etag: string; size: number }`, `listUploadedParts(key: string, uploadId: string): Promise<UploadedPart[]>`, `completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>`, `abortMultipartUpload(key: string, uploadId: string): Promise<void>`, `headObject(key: string): Promise<{ size: number; contentType: string | null } | null>`, `getObjectStream(key: string): Promise<{ body: ReadableStream; size: number | null; contentType: string | null } | null>`, `presignDownload(key: string, fileName: string): Promise<string>`.
- Produces from `files.ts`: `contentDisposition(fileName: string): string`.
- Consumes: `readS3Config`, `VericaseS3Config` from `src/lib/portal/s3.ts`.

- [ ] **Step 1: Install the presigner**

Run: `npm install @aws-sdk/s3-request-presigner@^3.1131.0`
Expected: `package.json` gains the dependency next to `@aws-sdk/client-s3`; `package-lock.json` updates. Confirm `ls node_modules/@aws-sdk/s3-request-presigner/dist-types/getSignedUrl.d.ts`.

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/portal/s3-transfer.test.ts
// @vitest-environment node
import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  PART_URL_TTL_SECONDS,
  abortMultipartUpload,
  completeMultipartUpload,
  headObject,
  listUploadedParts,
  presignDownload,
  presignUploadPart,
  s3Url,
} from "./s3-transfer";

beforeEach(() => {
  vi.stubEnv("S3_BUCKET", "vericase-test");
  vi.stubEnv("S3_REGION", "eu-west-2");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("S3_KEY_PREFIX", "meritus");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("presigned urls", () => {
  it("signs an upload part for one key, one upload id and one part number, for an hour", async () => {
    const url = new URL(await presignUploadPart("meritus/clients/example-firm.co.uk/abc-bundle.pdf", "up-1", 7));
    expect(url.host).toBe("vericase-test.s3.eu-west-2.amazonaws.com");
    expect(url.pathname).toBe("/meritus/clients/example-firm.co.uk/abc-bundle.pdf");
    expect(url.searchParams.get("partNumber")).toBe("7");
    expect(url.searchParams.get("uploadId")).toBe("up-1");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(PART_URL_TTL_SECONDS));
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs a download for one minute as an attachment", async () => {
    const url = new URL(await presignDownload("meritus/clients/example-firm.co.uk/abc-bundle.pdf", "Trial bundle.pdf"));
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(DOWNLOAD_URL_TTL_SECONDS));
    expect(url.searchParams.get("response-content-disposition")).toContain("attachment");
    expect(url.searchParams.get("response-content-disposition")).toContain("Trial bundle.pdf");
  });

  it("builds the s3 url", () => {
    expect(s3Url("meritus/clients/x/f.pdf")).toBe("s3://vericase-test/meritus/clients/x/f.pdf");
  });
});

describe("multipart control", () => {
  it("completes with the parts in order and the ETag, PartNumber shape S3 expects", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    await completeMultipartUpload("k", "up-1", [
      { partNumber: 2, etag: '"b"' },
      { partNumber: 1, etag: '"a"' },
    ]);
    const command = send.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(command.input).toEqual({
      Bucket: "vericase-test",
      Key: "k",
      UploadId: "up-1",
      MultipartUpload: { Parts: [{ PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' }] },
    });
  });

  it("lists parts across pages", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 1, ETag: '"a"', Size: 5 }], IsTruncated: true, NextPartNumberMarker: 1 } as never)
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 2, ETag: '"b"', Size: 3 }], IsTruncated: false } as never);
    expect(await listUploadedParts("k", "up-1")).toEqual([
      { partNumber: 1, etag: '"a"', size: 5 },
      { partNumber: 2, etag: '"b"', size: 3 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("swallows NoSuchUpload on abort and NotFound on head", async () => {
    const gone = Object.assign(new Error("gone"), { name: "NoSuchUpload" });
    const missing = Object.assign(new Error("missing"), { name: "NotFound" });
    vi.spyOn(S3Client.prototype, "send").mockRejectedValueOnce(gone as never).mockRejectedValueOnce(missing as never);
    await expect(abortMultipartUpload("k", "up-1")).resolves.toBeUndefined();
    expect(await headObject("k")).toBeNull();
  });

  it("returns size and type from head", async () => {
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({ ContentLength: 42, ContentType: "application/pdf" } as never);
    expect(await headObject("k")).toEqual({ size: 42, contentType: "application/pdf" });
  });
});
```

```ts
// src/lib/portal/files.test.ts
import { describe, expect, it } from "vitest";
import { contentDisposition } from "./files";

describe("contentDisposition", () => {
  it("quotes an ASCII name and adds the UTF-8 form", () => {
    expect(contentDisposition("Letter of claim.pdf")).toBe(
      `attachment; filename="Letter of claim.pdf"; filename*=UTF-8''Letter%20of%20claim.pdf`
    );
  });
  it("replaces quotes and non-ASCII in the plain name but keeps them in the encoded one", () => {
    expect(contentDisposition('Café "final".pdf')).toBe(
      `attachment; filename="Caf_ _final_.pdf"; filename*=UTF-8''Caf%C3%A9%20%22final%22.pdf`
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/portal/s3-transfer.test.ts src/lib/portal/files.test.ts`
Expected: FAIL, modules and helper missing.

- [ ] **Step 4: Write the module and the helper**

```ts
// src/lib/portal/s3-transfer.ts
/**
 * Everything the client file drop needs from S3 beyond putObject: multipart control, presigned
 * part and download URLs, HeadObject and a streamed GetObject. Its own client is built with
 * checksum calculation off, because the browser sends the parts and would not know the headers.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition } from "./files";
import { readS3Config, type VericaseS3Config } from "./s3";

export const PART_URL_TTL_SECONDS = 3600;
export const DOWNLOAD_URL_TTL_SECONDS = 60;

export type UploadedPart = { partNumber: number; etag: string; size: number };

function requireConfig(): VericaseS3Config {
  const config = readS3Config();
  if (!config) throw new Error("VeriCase S3 is not configured");
  return config;
}

function transferClient(config: VericaseS3Config): S3Client {
  return new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

export function s3Url(key: string): string {
  return `s3://${requireConfig().bucket}/${key}`;
}

export async function createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string }> {
  const config = requireConfig();
  const response = await transferClient(config).send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );
  if (!response.UploadId) throw new Error("S3 returned no upload id");
  return { uploadId: response.UploadId };
}

export async function presignUploadPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  const config = requireConfig();
  return getSignedUrl(
    transferClient(config),
    new UploadPartCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: PART_URL_TTL_SECONDS }
  );
}

export async function listUploadedParts(key: string, uploadId: string): Promise<UploadedPart[]> {
  const config = requireConfig();
  const client = transferClient(config);
  const parts: UploadedPart[] = [];
  let marker: number | undefined;
  do {
    const page = await client.send(
      new ListPartsCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker?.toString() })
    );
    for (const part of page.Parts ?? []) {
      if (part.PartNumber && part.ETag) {
        parts.push({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size ?? 0 });
      }
    }
    marker = page.IsTruncated && page.NextPartNumberMarker ? Number(page.NextPartNumberMarker) : undefined;
  } while (marker !== undefined);
  return parts;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  const config = requireConfig();
  const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await transferClient(config).send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: ordered.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    })
  );
}

/** Idempotent: an upload S3 no longer knows about is treated as already aborted. */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const config = requireConfig();
  try {
    await transferClient(config).send(
      new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId })
    );
  } catch (error) {
    if (errorName(error) === "NoSuchUpload") return;
    throw error;
  }
}

export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const config = requireConfig();
  try {
    const response = await transferClient(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { size: response.ContentLength ?? 0, contentType: response.ContentType ?? null };
  } catch (error) {
    const name = errorName(error);
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

/** The object as a web stream, so a route can hand it to `new Response()` without buffering. */
export async function getObjectStream(
  key: string
): Promise<{ body: ReadableStream; size: number | null; contentType: string | null } | null> {
  const config = requireConfig();
  try {
    const response = await transferClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!response.Body) return null;
    return {
      body: response.Body.transformToWebStream(),
      size: response.ContentLength ?? null,
      contentType: response.ContentType ?? null,
    };
  } catch (error) {
    const name = errorName(error);
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function presignDownload(key: string, fileName: string): Promise<string> {
  const config = requireConfig();
  return getSignedUrl(
    transferClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(fileName),
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}
```

Append to `src/lib/portal/files.ts`:

```ts
/** RFC 6266: a plain ASCII filename for old agents and the UTF-8 form for everyone else. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/portal/s3-transfer.test.ts src/lib/portal/files.test.ts && npx tsc --noEmit`
Expected: PASS, 8 tests; tsc clean. If the presigner test fails on `partNumber`, print the URL: the SDK writes the query keys `partNumber` and `uploadId` exactly so.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/portal/s3-transfer.ts src/lib/portal/s3-transfer.test.ts src/lib/portal/files.ts src/lib/portal/files.test.ts
git commit -m "feat(storage): multipart control, presigned urls and streamed reads for VeriCase S3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Upload rules and the upload service

**Files:**
- Create: `src/lib/client-uploads/rules.ts`
- Create: `src/lib/client-uploads/service.ts`
- Test: `src/lib/client-uploads/rules.test.ts`, `src/lib/client-uploads/service.test.ts`
- Modify: `src/lib/portal/files.ts` (add `formatBytes`)

**Interfaces:**
- `rules.ts` produces: `MAX_CLIENT_UPLOAD_BYTES = 50 * 1024 ** 3`, `MAX_CLIENT_UPLOAD_LABEL = "50 GB"`, `PART_SIZE = 32 * 1024 * 1024`, `MAX_PARTS = 10_000`, `MAX_SIGN_BATCH = 200`, `STALE_UPLOAD_MS = 24 * 60 * 60 * 1000`, `CLIENT_ALLOWED_LABEL: string`, `isAllowedClientUpload(fileName: string): boolean`, `planParts(size: number, partSize?: number): { partSize: number; partCount: number }`, `clientObjectPath(domain: string, id: string, fileName: string): string`, `type CreateInput = { fileName: string; size: number; mime: string }`, `parseCreateInput(body: unknown): { ok: true; input: CreateInput } | { ok: false; error: string }`, `parsePartNumbers(body: unknown, partCount: number): { ok: true; partNumbers: number[] } | { ok: false; error: string }`, `type CompletedPart = { partNumber: number; etag: string }`, `parseCompletedParts(body: unknown, partCount: number): { ok: true; parts: CompletedPart[] } | { ok: false; error: string }`.
- `service.ts` produces: `type ServiceError = { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string }`, `createUpload(identity: ClientIdentity, input: CreateInput, now?: Date): Promise<{ ok: true; id: string; key: string; partSize: number; partCount: number } | ServiceError>`, `signParts(identity, id: string, partNumbers: number[]): Promise<{ ok: true; urls: Record<string, string> } | ServiceError>`, `describeUpload(identity, id): Promise<{ ok: true; id: string; status: ClientUploadStatus; partSize: number; partCount: number; parts: UploadedPart[] } | ServiceError>`, `completeUpload(identity, id, parts: CompletedPart[]): Promise<{ ok: true; document: DocumentSummary } | ServiceError>`, `abortUpload(identity, id): Promise<{ ok: true } | ServiceError>`, `sweepStaleUploads(now?: Date): Promise<number>`.
- `files.ts` produces: `formatBytes(bytes: number): string`.
- Consumes: Task 3 db helpers, Task 6 `ClientIdentity`, Task 11 transfer helpers, `objectKey` and `deleteObjects` from `src/lib/portal/s3.ts`, `sanitizeFileName`, `extensionOf`, `summariseDocument` from `files.ts`, `isStorageConfigured` from `src/lib/env.ts`.

- [ ] **Step 1: Write the failing rules test**

```ts
// src/lib/client-uploads/rules.test.ts
import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_UPLOAD_BYTES,
  MAX_PARTS,
  PART_SIZE,
  clientObjectPath,
  isAllowedClientUpload,
  parseCompletedParts,
  parseCreateInput,
  parsePartNumbers,
  planParts,
} from "./rules";

describe("isAllowedClientUpload", () => {
  it("accepts documents, spreadsheets, email, archives, images and programmes", () => {
    for (const name of ["bundle.PDF", "notes.docx", "old.doc", "costs.xlsx", "chain.msg", "mailbox.pst", "site.zip", "photo.heic", "prog.pp", "prog.xer", "plan.mpp", "drawing.dwg"]) {
      expect(isAllowedClientUpload(name)).toBe(true);
    }
  });
  it("refuses executables, scripts and names without an extension", () => {
    for (const name of ["setup.exe", "run.bat", "tool.js", "app.dmg", "noext"]) {
      expect(isAllowedClientUpload(name)).toBe(false);
    }
  });
});

describe("planParts", () => {
  it("uses 32 MiB parts and rounds up", () => {
    expect(planParts(1)).toEqual({ partSize: PART_SIZE, partCount: 1 });
    expect(planParts(PART_SIZE)).toEqual({ partSize: PART_SIZE, partCount: 1 });
    expect(planParts(PART_SIZE + 1)).toEqual({ partSize: PART_SIZE, partCount: 2 });
    expect(planParts(100 * 1000 * 1000).partCount).toBe(3);
  });
  it("stays inside the S3 part limit at the cap", () => {
    expect(planParts(MAX_CLIENT_UPLOAD_BYTES).partCount).toBeLessThanOrEqual(MAX_PARTS);
  });
});

describe("clientObjectPath", () => {
  it("puts the file under the domain with a uuid prefix and a sanitised name", () => {
    expect(clientObjectPath("example-firm.co.uk", "abc", 'Trial "bundle" v2.pdf')).toBe("clients/example-firm.co.uk/abc-Trial _bundle_ v2.pdf");
  });
});

describe("parseCreateInput", () => {
  it("accepts a plausible file", () => {
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 10, mime: "application/pdf" })).toEqual({
      ok: true,
      input: { fileName: "bundle.pdf", size: 10, mime: "application/pdf" },
    });
  });
  it("defaults a missing type and refuses bad input", () => {
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 10 })).toEqual({ ok: true, input: { fileName: "bundle.pdf", size: 10, mime: "application/octet-stream" } });
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 0 })).toEqual({ ok: false, error: "The file is empty" });
    expect(parseCreateInput({ fileName: "bundle.pdf", size: MAX_CLIENT_UPLOAD_BYTES + 1 })).toEqual({ ok: false, error: "Files are limited to 50 GB" });
    expect(parseCreateInput({ fileName: "tool.exe", size: 5 })).toEqual({ ok: false, error: "That file type is not accepted" });
    expect(parseCreateInput(null)).toEqual({ ok: false, error: "A file name and size are required" });
  });
});

describe("parsePartNumbers", () => {
  it("accepts up to 200 distinct integers inside the plan", () => {
    expect(parsePartNumbers({ partNumbers: [1, 3] }, 3)).toEqual({ ok: true, partNumbers: [1, 3] });
    expect(parsePartNumbers({ partNumbers: [0] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: [4] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: [1, 1] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: Array.from({ length: 201 }, (_, i) => i + 1) }, 300).ok).toBe(false);
  });
});

describe("parseCompletedParts", () => {
  it("needs every part once with an etag", () => {
    expect(parseCompletedParts({ parts: [{ partNumber: 2, etag: "b" }, { partNumber: 1, etag: "a" }] }, 2)).toEqual({
      ok: true,
      parts: [{ partNumber: 1, etag: "a" }, { partNumber: 2, etag: "b" }],
    });
    expect(parseCompletedParts({ parts: [{ partNumber: 1, etag: "a" }] }, 2)).toEqual({ ok: false, error: "Expected 2 parts" });
    expect(parseCompletedParts({ parts: [{ partNumber: 1, etag: "" }, { partNumber: 2, etag: "b" }] }, 2).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/client-uploads/rules.test.ts`
Expected: FAIL, cannot resolve `./rules`.

- [ ] **Step 3: Write `rules.ts` and `formatBytes`**

```ts
// src/lib/client-uploads/rules.ts
/** What a client may send and how it is cut into S3 parts. Pure: safe in the browser and in tests. */
import { extensionOf, sanitizeFileName } from "@/lib/portal/files";

export const MAX_CLIENT_UPLOAD_BYTES = 50 * 1024 ** 3;
export const MAX_CLIENT_UPLOAD_LABEL = "50 GB";
export const PART_SIZE = 32 * 1024 * 1024;
export const MAX_PARTS = 10_000;
export const MAX_SIGN_BATCH = 200;
export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const CLIENT_ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".rtf", ".odt", ".txt", ".md",
  ".xls", ".xlsx", ".csv", ".ods",
  ".ppt", ".pptx",
  ".eml", ".msg", ".pst", ".mbox",
  ".zip", ".7z", ".rar",
  ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".gif",
  ".mp4", ".mov", ".m4a", ".mp3",
  ".pp", ".xer", ".mpp", ".xml", ".json",
  ".dwg", ".dxf", ".ifc",
]);

export const CLIENT_ALLOWED_LABEL =
  "Documents, spreadsheets, presentations, email files, archives, images, recordings, programmes and drawings";

export function isAllowedClientUpload(fileName: string): boolean {
  return CLIENT_ALLOWED_EXT.has(extensionOf(fileName));
}

export function planParts(size: number, partSize: number = PART_SIZE): { partSize: number; partCount: number } {
  const partCount = Math.max(1, Math.ceil(size / partSize));
  if (partCount > MAX_PARTS) throw new Error("Too many parts");
  return { partSize, partCount };
}

export function clientObjectPath(domain: string, id: string, fileName: string): string {
  return `clients/${domain}/${id}-${sanitizeFileName(fileName)}`;
}

export type CreateInput = { fileName: string; size: number; mime: string };

export function parseCreateInput(body: unknown): { ok: true; input: CreateInput } | { ok: false; error: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const fileName = typeof record?.fileName === "string" ? record.fileName.trim() : "";
  const size = typeof record?.size === "number" && Number.isFinite(record.size) ? Math.floor(record.size) : NaN;
  if (!fileName || Number.isNaN(size)) return { ok: false, error: "A file name and size are required" };
  if (size <= 0) return { ok: false, error: "The file is empty" };
  if (size > MAX_CLIENT_UPLOAD_BYTES) return { ok: false, error: `Files are limited to ${MAX_CLIENT_UPLOAD_LABEL}` };
  if (!isAllowedClientUpload(fileName)) return { ok: false, error: "That file type is not accepted" };
  const mime = typeof record?.mime === "string" && record.mime ? record.mime.slice(0, 120) : "application/octet-stream";
  return { ok: true, input: { fileName, size, mime } };
}

function isPartNumber(value: unknown, partCount: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= partCount;
}

export function parsePartNumbers(
  body: unknown,
  partCount: number
): { ok: true; partNumbers: number[] } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).partNumbers : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SIGN_BATCH) {
    return { ok: false, error: `Ask for between 1 and ${MAX_SIGN_BATCH} parts` };
  }
  const partNumbers = raw.filter((n) => isPartNumber(n, partCount)) as number[];
  if (partNumbers.length !== raw.length || new Set(partNumbers).size !== partNumbers.length) {
    return { ok: false, error: "Part numbers must be distinct and inside the plan" };
  }
  return { ok: true, partNumbers };
}

export type CompletedPart = { partNumber: number; etag: string };

export function parseCompletedParts(
  body: unknown,
  partCount: number
): { ok: true; parts: CompletedPart[] } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).parts : null;
  if (!Array.isArray(raw) || raw.length !== partCount) return { ok: false, error: `Expected ${partCount} parts` };
  const parts: CompletedPart[] = [];
  for (const entry of raw) {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const partNumber = record?.partNumber;
    const etag = typeof record?.etag === "string" ? record.etag.trim() : "";
    if (!isPartNumber(partNumber, partCount) || !etag) return { ok: false, error: "Every part needs a number and an etag" };
    parts.push({ partNumber, etag });
  }
  parts.sort((a, b) => a.partNumber - b.partNumber);
  if (parts.some((part, index) => part.partNumber !== index + 1)) return { ok: false, error: "Every part must appear exactly once" };
  return { ok: true, parts };
}
```

Append to `src/lib/portal/files.ts`:

```ts
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
```

Add to `src/lib/portal/files.test.ts`:

```ts
import { formatBytes } from "./files";

describe("formatBytes", () => {
  it("scales to GB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 ** 2)).toBe("3.0 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.50 GB");
  });
});
```

(Merge the import with the existing one from Task 11.)

- [ ] **Step 4: Run the rules and files tests**

Run: `npx vitest run src/lib/client-uploads/rules.test.ts src/lib/portal/files.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write the failing service test**

```ts
// src/lib/client-uploads/service.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveClientDomain } from "@/lib/db/client-domains";
import { getClientUpload, insertClientUpload, listStaleClientUploads, updateClientUpload } from "@/lib/db/client-uploads";
import { insertDocument } from "@/lib/db/documents";
import type { ClientUpload, DocumentRow } from "@/lib/db/schema";
import { deleteObjects } from "@/lib/portal/s3";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  listUploadedParts,
  presignUploadPart,
} from "@/lib/portal/s3-transfer";
import { PART_SIZE } from "./rules";
import { abortUpload, completeUpload, createUpload, describeUpload, signParts, sweepStaleUploads } from "./service";

vi.mock("@/lib/db/client-domains", () => ({ findActiveClientDomain: vi.fn() }));
vi.mock("@/lib/db/client-uploads", () => ({
  insertClientUpload: vi.fn(),
  getClientUpload: vi.fn(),
  updateClientUpload: vi.fn(),
  listStaleClientUploads: vi.fn(),
}));
vi.mock("@/lib/db/documents", () => ({ insertDocument: vi.fn() }));
vi.mock("@/lib/portal/s3", () => ({
  objectKey: (pathname: string) => `meritus/${pathname}`,
  deleteObjects: vi.fn(),
}));
vi.mock("@/lib/portal/s3-transfer", () => ({
  createMultipartUpload: vi.fn(),
  presignUploadPart: vi.fn(),
  listUploadedParts: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
  headObject: vi.fn(),
  s3Url: (key: string) => `s3://vericase-test/${key}`,
}));

const NOW = new Date("2026-09-12T10:00:00Z");
const client = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };
const director = { userId: "user_wr", role: "director" as const, domain: null, email: "w@meritusvia.com" };
const domainRow = { id: "cd_1", domain: "example-firm.co.uk", firm: "Example Firm LLP", pursuitId: "p1", createdBy: "user_wr", createdAt: NOW, removedAt: null };

function upload(overrides: Partial<ClientUpload> = {}): ClientUpload {
  return {
    id: "up_1",
    clientDomainId: "cd_1",
    pursuitId: "p1",
    userId: "user_c",
    uploaderEmail: "jane@example-firm.co.uk",
    key: "meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
    uploadId: "s3up",
    fileName: "bundle.pdf",
    mime: "application/pdf",
    size: PART_SIZE + 10,
    partSize: PART_SIZE,
    status: "pending",
    documentId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("S3_BUCKET", "vericase-test");
  vi.stubEnv("S3_REGION", "eu-west-2");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret");
  vi.mocked(findActiveClientDomain).mockResolvedValue(domainRow);
  vi.mocked(listStaleClientUploads).mockResolvedValue([]);
  vi.mocked(createMultipartUpload).mockResolvedValue({ uploadId: "s3up" });
  vi.mocked(insertClientUpload).mockImplementation(async (values) => upload(values as Partial<ClientUpload>));
  vi.mocked(getClientUpload).mockResolvedValue(upload());
  vi.mocked(presignUploadPart).mockImplementation(async (_k, _u, n) => `https://s3/part/${n}`);
  vi.mocked(listUploadedParts).mockResolvedValue([]);
  vi.mocked(headObject).mockResolvedValue({ size: PART_SIZE + 10, contentType: "application/pdf" });
  vi.mocked(insertDocument).mockImplementation(async (values) => ({ extractedText: null, createdAt: NOW, ...values }) as DocumentRow);
});

afterEach(() => vi.unstubAllEnvs());

describe("createUpload", () => {
  it("opens a multipart upload under the domain and records it", async () => {
    const result = await createUpload(client, { fileName: "Trial bundle.pdf", size: PART_SIZE + 10, mime: "application/pdf" }, NOW);
    expect(result).toMatchObject({ ok: true, partSize: PART_SIZE, partCount: 2 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.key).toMatch(/^meritus\/clients\/example-firm\.co\.uk\/[0-9a-f-]{36}-Trial bundle\.pdf$/);
    expect(createMultipartUpload).toHaveBeenCalledWith(result.key, "application/pdf");
    expect(insertClientUpload).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id, clientDomainId: "cd_1", pursuitId: "p1", userId: "user_c", uploaderEmail: "jane@example-firm.co.uk", key: result.key, uploadId: "s3up", size: PART_SIZE + 10, partSize: PART_SIZE, status: "pending" })
    );
  });

  it("refuses a director, a removed domain, a bad type and an oversized file", async () => {
    expect(await createUpload(director, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 403, error: "No client domain" });
    vi.mocked(findActiveClientDomain).mockResolvedValue(null);
    expect(await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 403, error: "Access for this domain has ended" });
    vi.mocked(findActiveClientDomain).mockResolvedValue(domainRow);
    expect((await createUpload(client, { fileName: "a.exe", size: 5, mime: "" }, NOW))).toMatchObject({ ok: false, status: 400 });
    expect((await createUpload(client, { fileName: "a.pdf", size: 51 * 1024 ** 3, mime: "" }, NOW))).toMatchObject({ ok: false, status: 400 });
    expect(createMultipartUpload).not.toHaveBeenCalled();
  });

  it("answers 503 without storage", async () => {
    vi.stubEnv("S3_BUCKET", "");
    expect(await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 503, error: "VeriCase S3 is not configured" });
  });

  it("sweeps stale uploads first, best effort", async () => {
    vi.mocked(listStaleClientUploads).mockResolvedValue([upload({ id: "old", key: "k-old", uploadId: "u-old" })]);
    await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW);
    expect(abortMultipartUpload).toHaveBeenCalledWith("k-old", "u-old");
    expect(updateClientUpload).toHaveBeenCalledWith("old", { status: "aborted" });
  });
});

describe("signParts", () => {
  it("signs the asked parts of the caller's own upload", async () => {
    expect(await signParts(client, "up_1", [1, 2])).toEqual({ ok: true, urls: { "1": "https://s3/part/1", "2": "https://s3/part/2" } });
  });
  it("hides another domain's upload and refuses parts outside the plan", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ clientDomainId: "cd_other" }));
    expect(await signParts(client, "up_1", [1])).toEqual({ ok: false, status: 404, error: "Upload not found" });
    vi.mocked(getClientUpload).mockResolvedValue(upload());
    expect((await signParts(client, "up_1", [3])).ok).toBe(false);
  });
  it("refuses a finished upload", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ status: "complete" }));
    expect(await signParts(client, "up_1", [1])).toEqual({ ok: false, status: 409, error: "Upload already finished" });
  });
});

describe("describeUpload", () => {
  it("returns the plan and the parts S3 already holds", async () => {
    vi.mocked(listUploadedParts).mockResolvedValue([{ partNumber: 1, etag: '"a"', size: PART_SIZE }]);
    expect(await describeUpload(client, "up_1")).toEqual({ ok: true, id: "up_1", status: "pending", partSize: PART_SIZE, partCount: 2, parts: [{ partNumber: 1, etag: '"a"', size: PART_SIZE }] });
  });
});

describe("completeUpload", () => {
  const parts = [{ partNumber: 1, etag: '"a"' }, { partNumber: 2, etag: '"b"' }];

  it("completes, verifies the size and writes the document on the linked pursuit", async () => {
    const result = await completeUpload(client, "up_1", parts);
    expect(completeMultipartUpload).toHaveBeenCalledWith("meritus/clients/example-firm.co.uk/up_1-bundle.pdf", "s3up", parts);
    expect(insertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "pursuit",
        pursuitId: "p1",
        clientDomainId: "cd_1",
        title: "bundle.pdf",
        blobUrl: "s3://vericase-test/meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
        blobPathname: "meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
        fileName: "bundle.pdf",
        mime: "application/pdf",
        size: PART_SIZE + 10,
        extractedText: null,
        uploadedBy: "user_c",
        uploaderEmail: "jane@example-firm.co.uk",
      })
    );
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "complete", documentId: expect.any(String) });
    expect(result).toMatchObject({ ok: true, document: { title: "bundle.pdf", size: PART_SIZE + 10, hasText: false } });
  });

  it("uses the client scope when the domain has no pursuit", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ pursuitId: null }));
    await completeUpload(client, "up_1", parts);
    expect(insertDocument).toHaveBeenCalledWith(expect.objectContaining({ scope: "client", pursuitId: null }));
  });

  it("refuses the wrong number of parts before touching S3", async () => {
    expect((await completeUpload(client, "up_1", [parts[0]])).ok).toBe(false);
    expect(completeMultipartUpload).not.toHaveBeenCalled();
  });

  it("removes the object and marks the upload aborted when the size does not match", async () => {
    vi.mocked(headObject).mockResolvedValue({ size: 5, contentType: null });
    expect(await completeUpload(client, "up_1", parts)).toEqual({ ok: false, status: 409, error: "The uploaded size does not match the file" });
    expect(deleteObjects).toHaveBeenCalledWith(["meritus/clients/example-firm.co.uk/up_1-bundle.pdf"]);
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "aborted" });
    expect(insertDocument).not.toHaveBeenCalled();
  });
});

describe("abortUpload and sweepStaleUploads", () => {
  it("aborts the caller's own pending upload", async () => {
    expect(await abortUpload(client, "up_1")).toEqual({ ok: true });
    expect(abortMultipartUpload).toHaveBeenCalledWith("meritus/clients/example-firm.co.uk/up_1-bundle.pdf", "s3up");
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "aborted" });
  });
  it("sweeps every stale upload and keeps going past a failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(listStaleClientUploads).mockResolvedValue([upload({ id: "a" }), upload({ id: "b" })]);
    vi.mocked(abortMultipartUpload).mockRejectedValueOnce(new Error("boom"));
    expect(await sweepStaleUploads(NOW)).toBe(1);
    expect(listStaleClientUploads).toHaveBeenCalledWith(new Date(NOW.getTime() - 24 * 60 * 60 * 1000));
    expect(updateClientUpload).toHaveBeenCalledWith("b", { status: "aborted" });
  });
});
```

- [ ] **Step 6: Run the service test to verify it fails**

Run: `npx vitest run src/lib/client-uploads/service.test.ts`
Expected: FAIL, cannot resolve `./service`.

- [ ] **Step 7: Write `service.ts`**

```ts
// src/lib/client-uploads/service.ts
/**
 * The client file drop, server side. Every entry point resolves the caller's active domain and
 * touches only uploads that belong to it. Nothing here reads a file's contents.
 */

import { findActiveClientDomain } from "@/lib/db/client-domains";
import { getClientUpload, insertClientUpload, listStaleClientUploads, updateClientUpload } from "@/lib/db/client-uploads";
import { insertDocument } from "@/lib/db/documents";
import type { ClientDomain, ClientUpload, ClientUploadStatus } from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/env";
import type { ClientIdentity } from "@/lib/portal/auth";
import { sanitizeFileName, summariseDocument, type DocumentSummary } from "@/lib/portal/files";
import { deleteObjects, objectKey } from "@/lib/portal/s3";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  listUploadedParts,
  presignUploadPart,
  s3Url,
  type UploadedPart,
} from "@/lib/portal/s3-transfer";
import {
  MAX_CLIENT_UPLOAD_BYTES,
  MAX_CLIENT_UPLOAD_LABEL,
  STALE_UPLOAD_MS,
  clientObjectPath,
  isAllowedClientUpload,
  parseCompletedParts,
  parsePartNumbers,
  planParts,
  type CompletedPart,
  type CreateInput,
} from "./rules";

export type ServiceError = { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

function fail(status: ServiceError["status"], error: string): ServiceError {
  return { ok: false, status, error };
}

async function activeDomain(identity: ClientIdentity): Promise<ClientDomain | ServiceError> {
  if (!identity.domain) return fail(403, "No client domain");
  const domain = await findActiveClientDomain(identity.domain);
  if (!domain) return fail(403, "Access for this domain has ended");
  return domain;
}

async function ownedUpload(
  identity: ClientIdentity,
  id: string
): Promise<{ upload: ClientUpload; domain: ClientDomain } | ServiceError> {
  const domain = await activeDomain(identity);
  if ("ok" in domain) return domain;
  const upload = await getClientUpload(id);
  if (!upload || upload.clientDomainId !== domain.id) return fail(404, "Upload not found");
  if (upload.status !== "pending") return fail(409, "Upload already finished");
  return { upload, domain };
}

export async function createUpload(
  identity: ClientIdentity,
  input: CreateInput,
  now: Date = new Date()
): Promise<{ ok: true; id: string; key: string; partSize: number; partCount: number } | ServiceError> {
  if (!isStorageConfigured()) return fail(503, "VeriCase S3 is not configured");
  const domain = await activeDomain(identity);
  if ("ok" in domain) return domain;
  if (input.size <= 0) return fail(400, "The file is empty");
  if (input.size > MAX_CLIENT_UPLOAD_BYTES) return fail(400, `Files are limited to ${MAX_CLIENT_UPLOAD_LABEL}`);
  if (!isAllowedClientUpload(input.fileName)) return fail(400, "That file type is not accepted");

  await sweepStaleUploads(now).catch(() => 0);

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(input.fileName);
  const key = objectKey(clientObjectPath(domain.domain, id, fileName));
  const mime = input.mime || "application/octet-stream";
  const plan = planParts(input.size);
  const { uploadId } = await createMultipartUpload(key, mime);
  await insertClientUpload({
    id,
    clientDomainId: domain.id,
    pursuitId: domain.pursuitId,
    userId: identity.userId,
    uploaderEmail: identity.email,
    key,
    uploadId,
    fileName,
    mime,
    size: input.size,
    partSize: plan.partSize,
    status: "pending",
  });
  return { ok: true, id, key, partSize: plan.partSize, partCount: plan.partCount };
}

export async function signParts(
  identity: ClientIdentity,
  id: string,
  partNumbers: number[]
): Promise<{ ok: true; urls: Record<string, string> } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { partCount } = planParts(owned.upload.size, owned.upload.partSize);
  const parsed = parsePartNumbers({ partNumbers }, partCount);
  if (!parsed.ok) return fail(400, parsed.error);
  const urls: Record<string, string> = {};
  await Promise.all(
    parsed.partNumbers.map(async (n) => {
      urls[String(n)] = await presignUploadPart(owned.upload.key, owned.upload.uploadId, n);
    })
  );
  return { ok: true, urls };
}

export async function describeUpload(
  identity: ClientIdentity,
  id: string
): Promise<
  | { ok: true; id: string; status: ClientUploadStatus; partSize: number; partCount: number; parts: UploadedPart[] }
  | ServiceError
> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { partCount } = planParts(owned.upload.size, owned.upload.partSize);
  const parts = await listUploadedParts(owned.upload.key, owned.upload.uploadId);
  return { ok: true, id, status: owned.upload.status, partSize: owned.upload.partSize, partCount, parts };
}

export async function completeUpload(
  identity: ClientIdentity,
  id: string,
  parts: CompletedPart[]
): Promise<{ ok: true; document: DocumentSummary } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { upload, domain } = owned;
  const { partCount } = planParts(upload.size, upload.partSize);
  const parsed = parseCompletedParts({ parts }, partCount);
  if (!parsed.ok) return fail(400, parsed.error);
  const ordered = parsed.parts;

  await completeMultipartUpload(upload.key, upload.uploadId, ordered);
  const head = await headObject(upload.key);
  if (!head || head.size !== upload.size) {
    await deleteObjects([upload.key]).catch(() => undefined);
    await updateClientUpload(upload.id, { status: "aborted" });
    return fail(409, "The uploaded size does not match the file");
  }

  const documentId = crypto.randomUUID();
  const row = await insertDocument({
    id: documentId,
    scope: upload.pursuitId ? "pursuit" : "client",
    pursuitId: upload.pursuitId,
    clientDomainId: domain.id,
    title: upload.fileName,
    blobUrl: s3Url(upload.key),
    blobPathname: upload.key,
    fileName: upload.fileName,
    mime: upload.mime,
    size: upload.size,
    extractedText: null,
    uploadedBy: upload.userId,
    uploaderEmail: upload.uploaderEmail,
  });
  await updateClientUpload(upload.id, { status: "complete", documentId });
  return { ok: true, document: summariseDocument(row) };
}

export async function abortUpload(identity: ClientIdentity, id: string): Promise<{ ok: true } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  await abortMultipartUpload(owned.upload.key, owned.upload.uploadId);
  await updateClientUpload(owned.upload.id, { status: "aborted" });
  return { ok: true };
}

/** Aborts uploads left pending for a day, so abandoned parts stop costing money. Returns how many. */
export async function sweepStaleUploads(now: Date = new Date()): Promise<number> {
  const stale = await listStaleClientUploads(new Date(now.getTime() - STALE_UPLOAD_MS));
  let swept = 0;
  for (const upload of stale) {
    try {
      await abortMultipartUpload(upload.key, upload.uploadId);
      await updateClientUpload(upload.id, { status: "aborted" });
      swept += 1;
    } catch (error) {
      console.warn("Client uploads: sweep failed", { uploadId: upload.id, error: error instanceof Error ? error.name : "unknown" });
    }
  }
  return swept;
}
```

`sanitizeFileName` is idempotent, so the name stored on the row is exactly the tail of the key after `${id}-`. Part validation lives in the rules parsers (Task 12, Step 3), so the routes only shape JSON and the service is the single place that decides.

- [ ] **Step 8: Run the service test**

Run: `npx vitest run src/lib/client-uploads && npx tsc --noEmit`
Expected: PASS, 24 tests across the two files; tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/client-uploads src/lib/portal/files.ts src/lib/portal/files.test.ts
git commit -m "feat(client): upload rules and the multipart upload service

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Client upload routes

**Files:**
- Create: `src/app/api/client/uploads/route.ts` (POST create)
- Create: `src/app/api/client/uploads/[id]/route.ts` (GET describe, DELETE abort)
- Create: `src/app/api/client/uploads/[id]/parts/route.ts` (POST sign)
- Create: `src/app/api/client/uploads/[id]/complete/route.ts` (POST complete)
- Test: `src/app/api/client/uploads/route.test.ts`

**Interfaces:**
- `POST /api/client/uploads` body `{ fileName, size, mime? }` → 201 `{ ok: true, id, key, partSize, partCount }`.
- `GET /api/client/uploads/[id]` → 200 `{ ok: true, id, status, partSize, partCount, parts: [{ partNumber, etag, size }] }`.
- `DELETE /api/client/uploads/[id]` → 200 `{ ok: true }`.
- `POST /api/client/uploads/[id]/parts` body `{ partNumbers: number[] }` → 200 `{ ok: true, urls: { "1": url } }`.
- `POST /api/client/uploads/[id]/complete` body `{ parts: [{ partNumber, etag }] }` → 201 `{ ok: true, document: DocumentSummary }`.
- Service errors pass through as `{ error }` with the service's status. Guard errors come from `requireClientUser` (Task 6) and `requireDatabaseOr503`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/client/uploads/route.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";
import { createUpload } from "@/lib/client-uploads/service";
import { POST } from "./route";

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requireClientUser: vi.fn(), requireDatabaseOr503: vi.fn() };
});
vi.mock("@/lib/client-uploads/service", () => ({ createUpload: vi.fn() }));

const identity = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/client/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireClientUser).mockResolvedValue({ identity });
  vi.mocked(requireDatabaseOr503).mockReturnValue(null);
  vi.mocked(createUpload).mockResolvedValue({ ok: true, id: "up_1", key: "meritus/clients/example-firm.co.uk/up_1-a.pdf", partSize: 32 * 1024 * 1024, partCount: 1 });
});

describe("POST /api/client/uploads", () => {
  it("opens an upload for the caller", async () => {
    const res = await post({ fileName: "a.pdf", size: 10, mime: "application/pdf" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, id: "up_1", partCount: 1 });
    expect(createUpload).toHaveBeenCalledWith(identity, { fileName: "a.pdf", size: 10, mime: "application/pdf" });
  });
  it("passes guard failures through", async () => {
    vi.mocked(requireClientUser).mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await post({ fileName: "a.pdf", size: 10 })).status).toBe(401);
    expect(createUpload).not.toHaveBeenCalled();
  });
  it("answers 400 to bad JSON or a bad file, and relays the service's status", async () => {
    expect((await post("{")).status).toBe(400);
    expect((await post({ fileName: "a.exe", size: 10 })).status).toBe(400);
    vi.mocked(createUpload).mockResolvedValue({ ok: false, status: 403, error: "No client domain" });
    const res = await post({ fileName: "a.pdf", size: 10 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No client domain" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/client/uploads/route.test.ts`
Expected: FAIL, cannot resolve `./route`.

- [ ] **Step 3: Write the four route files**

```ts
// src/app/api/client/uploads/route.ts
import { NextResponse } from "next/server";
import { parseCreateInput } from "@/lib/client-uploads/rules";
import { createUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const parsed = parseCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createUpload(gate.identity, parsed.input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
```

```ts
// src/app/api/client/uploads/[id]/route.ts
import { NextResponse } from "next/server";
import { abortUpload, describeUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  const { id } = await context.params;
  const result = await describeUpload(gate.identity, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, context: Context) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  const { id } = await context.params;
  const result = await abortUpload(gate.identity, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```

```ts
// src/app/api/client/uploads/[id]/parts/route.ts
import { NextResponse } from "next/server";
import { MAX_SIGN_BATCH } from "@/lib/client-uploads/rules";
import { signParts } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).partNumbers : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SIGN_BATCH || !raw.every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: `Ask for between 1 and ${MAX_SIGN_BATCH} parts` }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await signParts(gate.identity, id, raw as number[]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
```

```ts
// src/app/api/client/uploads/[id]/complete/route.ts
import { NextResponse } from "next/server";
import { completeUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).parts : null;
  if (!Array.isArray(raw)) return NextResponse.json({ error: "Expected parts" }, { status: 400 });
  const parts = raw
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({ partNumber: Number(entry.partNumber), etag: typeof entry.etag === "string" ? entry.etag : "" }));

  const { id } = await context.params;
  const result = await completeUpload(gate.identity, id, parts);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
```

The service re-validates part numbers and etags (Task 12), so the handlers only shape the JSON.

- [ ] **Step 4: Run the test, type check and lint**

Run: `npx vitest run src/app/api/client && npx tsc --noEmit && npm run lint`
Expected: PASS, 3 tests; clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/client
git commit -m "feat(client): upload routes over the multipart service

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Browser upload and the client desk

**Files:**
- Create: `src/lib/client/upload.ts`
- Test: `src/lib/client/upload.test.ts`
- Create: `src/lib/client/transport.ts`
- Create: `src/components/client/ClientUploadDesk.tsx`
- Create: `src/app/client/layout.tsx`, `src/app/client/page.tsx`

**Interfaces:**
- `upload.ts` produces: `type CreateResponse = { id: string; key: string; partSize: number; partCount: number }`, `type CompletedPart = { partNumber: number; etag: string }`, `type UploadDescription = { id: string; status: string; partSize: number; partCount: number; parts: { partNumber: number; etag: string; size: number }[] }`, `type UploadedDocument = { id: string; title: string; size: number }`, `type UploadTransport = { create(file: { name: string; size: number; type: string }): Promise<CreateResponse>; describe(id: string): Promise<UploadDescription>; sign(id: string, partNumbers: number[]): Promise<Record<string, string>>; putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<string>; complete(id: string, parts: CompletedPart[]): Promise<{ document: UploadedDocument }>; abort(id: string): Promise<void> }`, `type UploadOptions = { concurrency?: number; signBatch?: number; resumeId?: string | null; onProgress?: (fraction: number) => void; onSession?: (id: string) => void }`, `uploadFile(file: File, transport: UploadTransport, options?: UploadOptions): Promise<UploadedDocument>`.
- `transport.ts` produces: `browserTransport: UploadTransport` talking to the Task 13 routes.
- Consumes on the page: `resolveIdentity` (Task 4), `findActiveClientDomain`, `listClientDocuments` (Task 3), `formatBytes`, `summariseDocument` (Task 12), `CLIENT_ALLOWED_LABEL`, `MAX_CLIENT_UPLOAD_LABEL` (Task 12), `shortDate` from `src/lib/portal/dates.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/client/upload.test.ts
import { describe, expect, it, vi } from "vitest";
import { uploadFile, type UploadTransport } from "./upload";

function fakeTransport(partSize: number, opts: { described?: { partNumber: number; etag: string; size: number }[]; failFirstPut?: boolean } = {}) {
  const calls = { create: 0, describe: 0, sign: [] as number[][], puts: [] as { url: string; size: number }[], complete: [] as unknown[], abort: 0 };
  let failed = false;
  const transport: UploadTransport = {
    async create(file) {
      calls.create += 1;
      return { id: "up_1", key: "k", partSize, partCount: Math.max(1, Math.ceil(file.size / partSize)) };
    },
    async describe() {
      calls.describe += 1;
      if (!opts.described) throw new Error("not found");
      return { id: "up_1", status: "pending", partSize, partCount: 3, parts: opts.described };
    },
    async sign(_id, partNumbers) {
      calls.sign.push(partNumbers);
      return Object.fromEntries(partNumbers.map((n) => [String(n), `https://s3/part/${n}`]));
    },
    async putPart(url, blob, onProgress) {
      if (opts.failFirstPut && !failed) {
        failed = true;
        throw new Error("flaky");
      }
      calls.puts.push({ url, size: blob.size });
      onProgress(blob.size);
      return `"etag-${url.split("/").pop()}"`;
    },
    async complete(_id, parts) {
      calls.complete.push(parts);
      return { document: { id: "doc_1", title: "bundle.pdf", size: 10 } };
    },
    async abort() {
      calls.abort += 1;
    },
  };
  return { transport, calls };
}

const file = new File([new Uint8Array(10)], "bundle.pdf", { type: "application/pdf" });

describe("uploadFile", () => {
  it("creates, signs lazily, puts every part in order and completes with the etags", async () => {
    const { transport, calls } = fakeTransport(4);
    const progress: number[] = [];
    const sessions: string[] = [];
    const result = await uploadFile(file, transport, { concurrency: 1, signBatch: 2, onProgress: (f) => progress.push(f), onSession: (id) => sessions.push(id) });
    expect(result).toEqual({ id: "doc_1", title: "bundle.pdf", size: 10 });
    expect(calls.create).toBe(1);
    expect(sessions).toEqual(["up_1"]);
    expect(calls.sign).toEqual([[1, 2], [3]]);
    expect(calls.puts.map((p) => p.size)).toEqual([4, 4, 2]);
    expect(calls.complete[0]).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
      { partNumber: 3, etag: '"etag-3"' },
    ]);
    expect(progress.at(-1)).toBe(1);
  });

  it("resumes: keeps the parts S3 already holds and uploads the rest", async () => {
    const { transport, calls } = fakeTransport(4, { described: [{ partNumber: 1, etag: '"kept"', size: 4 }] });
    await uploadFile(file, transport, { concurrency: 1, resumeId: "up_1" });
    expect(calls.create).toBe(0);
    expect(calls.puts.map((p) => p.url)).toEqual(["https://s3/part/2", "https://s3/part/3"]);
    expect(calls.complete[0]).toEqual([
      { partNumber: 1, etag: '"kept"' },
      { partNumber: 2, etag: '"etag-2"' },
      { partNumber: 3, etag: '"etag-3"' },
    ]);
  });

  it("starts fresh when the old session is gone", async () => {
    const { transport, calls } = fakeTransport(4);
    await uploadFile(file, transport, { concurrency: 1, resumeId: "stale" });
    expect(calls.describe).toBe(1);
    expect(calls.create).toBe(1);
  });

  it("retries a failed part once with a fresh url", async () => {
    const { transport, calls } = fakeTransport(4, { failFirstPut: true });
    await uploadFile(file, transport, { concurrency: 1 });
    expect(calls.puts.length).toBe(3);
    expect(calls.sign.length).toBeGreaterThanOrEqual(2);
  });

  it("finishes with several workers", async () => {
    const { transport, calls } = fakeTransport(4);
    await uploadFile(file, transport, { concurrency: 3 });
    expect(calls.puts.map((p) => p.size).sort()).toEqual([2, 4, 4]);
    expect(calls.complete.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/client/upload.test.ts`
Expected: FAIL, cannot resolve `./upload`.

- [ ] **Step 3: Write `upload.ts` and `transport.ts`**

```ts
// src/lib/client/upload.ts
/**
 * Runs one multipart upload from the browser: open (or resume) a session, sign part urls a batch
 * at a time so they cannot expire mid-file, PUT parts with a small worker pool, then complete.
 * No server imports: this file runs in the browser and in jsdom.
 */

export type CreateResponse = { id: string; key: string; partSize: number; partCount: number };
export type CompletedPart = { partNumber: number; etag: string };
export type UploadDescription = {
  id: string;
  status: string;
  partSize: number;
  partCount: number;
  parts: { partNumber: number; etag: string; size: number }[];
};
export type UploadedDocument = { id: string; title: string; size: number };

export type UploadTransport = {
  create(file: { name: string; size: number; type: string }): Promise<CreateResponse>;
  describe(id: string): Promise<UploadDescription>;
  sign(id: string, partNumbers: number[]): Promise<Record<string, string>>;
  putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<string>;
  complete(id: string, parts: CompletedPart[]): Promise<{ document: UploadedDocument }>;
  abort(id: string): Promise<void>;
};

export type UploadOptions = {
  concurrency?: number;
  signBatch?: number;
  resumeId?: string | null;
  onProgress?: (fraction: number) => void;
  onSession?: (id: string) => void;
};

type Plan = { id: string; partSize: number; partCount: number };

export async function uploadFile(file: File, transport: UploadTransport, options: UploadOptions = {}): Promise<UploadedDocument> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const signBatch = Math.max(1, options.signBatch ?? 50);
  const done = new Map<number, string>();
  let plan: Plan | null = null;

  if (options.resumeId) {
    try {
      const described = await transport.describe(options.resumeId);
      if (described.status === "pending") {
        plan = { id: described.id, partSize: described.partSize, partCount: described.partCount };
        for (const part of described.parts) done.set(part.partNumber, part.etag);
      }
    } catch {
      plan = null;
    }
  }
  if (!plan) {
    const created = await transport.create({ name: file.name, size: file.size, type: file.type });
    plan = { id: created.id, partSize: created.partSize, partCount: created.partCount };
  }
  const session = plan;
  options.onSession?.(session.id);

  const bytesOf = (n: number) => Math.min(session.partSize, file.size - (n - 1) * session.partSize);
  let doneBytes = [...done.keys()].reduce((sum, n) => sum + bytesOf(n), 0);
  const inFlight = new Map<number, number>();
  const report = () => {
    const loaded = doneBytes + [...inFlight.values()].reduce((a, b) => a + b, 0);
    options.onProgress?.(file.size === 0 ? 1 : Math.min(1, loaded / file.size));
  };
  report();

  const pending = Array.from({ length: session.partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
  const urls = new Map<number, string>();
  let next = 0;

  async function urlFor(n: number, fresh = false): Promise<string> {
    if (!fresh && urls.has(n)) return urls.get(n)!;
    const start = pending.indexOf(n);
    const batch = fresh ? [n] : pending.slice(start, start + signBatch);
    const signed = await transport.sign(session.id, batch);
    for (const [key, value] of Object.entries(signed)) urls.set(Number(key), value);
    const url = urls.get(n);
    if (!url) throw new Error(`No url for part ${n}`);
    return url;
  }

  async function putWithRetry(n: number, blob: Blob): Promise<string> {
    const onProgress = (loaded: number) => {
      inFlight.set(n, loaded);
      report();
    };
    try {
      return await transport.putPart(await urlFor(n), blob, onProgress);
    } catch {
      inFlight.set(n, 0);
      return transport.putPart(await urlFor(n, true), blob, onProgress);
    }
  }

  async function worker(): Promise<void> {
    while (next < pending.length) {
      const n = pending[next++];
      const start = (n - 1) * session.partSize;
      const blob = file.slice(start, Math.min(start + session.partSize, file.size));
      const etag = await putWithRetry(n, blob);
      inFlight.delete(n);
      done.set(n, etag);
      doneBytes += blob.size;
      report();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

  const parts = [...done.entries()].map(([partNumber, etag]) => ({ partNumber, etag })).sort((a, b) => a.partNumber - b.partNumber);
  const { document } = await transport.complete(session.id, parts);
  return document;
}
```

```ts
// src/lib/client/transport.ts
import type { UploadTransport } from "./upload";

const BASE = "/api/client/uploads";

async function json<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

function post(url: string, body: unknown, method = "POST"): Promise<Response> {
  return fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** The real transport: JSON to the Meritus routes, and an XMLHttpRequest PUT to S3 for byte-level progress. */
export const browserTransport: UploadTransport = {
  async create(file) {
    return json(await post(BASE, { fileName: file.name, size: file.size, mime: file.type }));
  },
  async describe(id) {
    return json(await fetch(`${BASE}/${encodeURIComponent(id)}`));
  },
  async sign(id, partNumbers) {
    const data = await json<{ urls: Record<string, string> }>(await post(`${BASE}/${encodeURIComponent(id)}/parts`, { partNumbers }));
    return data.urls;
  },
  putPart(url, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (event) => onProgress(event.loaded);
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Storage answered ${xhr.status}`));
          return;
        }
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("Storage did not return an ETag; the bucket must expose it"));
          return;
        }
        resolve(etag);
      };
      xhr.onerror = () => reject(new Error("The connection dropped while uploading"));
      xhr.send(blob);
    });
  },
  async complete(id, parts) {
    return json(await post(`${BASE}/${encodeURIComponent(id)}/complete`, { parts }));
  },
  async abort(id) {
    await json(await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/client/upload.test.ts && npx tsc --noEmit`
Expected: PASS, 5 tests; tsc clean.

- [ ] **Step 5: Write the desk component and pages**

```tsx
// src/components/client/ClientUploadDesk.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLIENT_ALLOWED_LABEL, MAX_CLIENT_UPLOAD_LABEL } from "@/lib/client-uploads/rules";
import { browserTransport } from "@/lib/client/transport";
import { uploadFile } from "@/lib/client/upload";
import { formatBytes } from "@/lib/portal/files";

type Row = {
  key: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error: string | null;
};

const STORE_PREFIX = "meritus-upload:";

function fingerprint(file: File): string {
  return `${STORE_PREFIX}${file.name}:${file.size}:${file.lastModified}`;
}

function readSession(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, id: string | null): void {
  try {
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the upload still works, it just cannot resume.
  }
}

export function ClientUploadDesk() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  async function run(queue: Row[]) {
    setBusy(true);
    for (const row of queue) {
      patch(row.key, { status: "uploading", error: null });
      try {
        await uploadFile(row.file, browserTransport, {
          resumeId: readSession(row.key),
          onSession: (id) => writeSession(row.key, id),
          onProgress: (fraction) => patch(row.key, { progress: fraction }),
        });
        writeSession(row.key, null);
        patch(row.key, { status: "done", progress: 1 });
        router.refresh();
      } catch (error) {
        patch(row.key, { status: "error", error: error instanceof Error ? error.message : "Upload failed" });
      }
    }
    setBusy(false);
  }

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const queue: Row[] = files.map((file) => ({ key: fingerprint(file), file, progress: 0, status: "queued", error: null }));
    setRows((current) => [...current.filter((row) => !queue.some((q) => q.key === row.key)), ...queue]);
    void run(queue);
  }

  function retry(row: Row) {
    void run([row]);
  }

  return (
    <div>
      <label className="btn-brass cursor-pointer text-[12px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-green has-[:focus-visible]:outline-offset-2">
        <input type="file" multiple className="sr-only" onChange={onSelect} disabled={busy} />
        {busy ? "Uploading…" : "Choose files"}
      </label>
      <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-ink/70">
        {CLIENT_ALLOWED_LABEL} · up to {MAX_CLIENT_UPLOAD_LABEL} each. Large files resume if the connection drops: choose the same file again.
      </p>
      {rows.length > 0 ? (
        <ul className="mt-5 divide-y divide-green/10" aria-live="polite">
          {rows.map((row) => (
            <li key={row.key} className="py-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 truncate text-green">{row.file.name}</span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                  {formatBytes(row.file.size)} ·{" "}
                  {row.status === "done" ? "received" : row.status === "error" ? "failed" : `${Math.round(row.progress * 100)}%`}
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-green/10" aria-hidden="true">
                <div className="h-1 bg-brass" style={{ width: `${Math.round(row.progress * 100)}%` }} />
              </div>
              {row.status === "error" ? (
                <p className="mt-2 text-[12px] text-oxblood">
                  {row.error}{" "}
                  <button type="button" className="btn-quiet ml-2" onClick={() => retry(row)} disabled={busy}>
                    Try again
                  </button>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

```tsx
// src/app/client/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

export const metadata: Metadata = {
  title: "Meritus upload desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <header className="bg-green grain px-6 py-5">
        <Link href="/" className="inline-flex">
          <HallmarkLogo size="standalone" variant="light" showDescriptor />
        </Link>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
```

```tsx
// src/app/client/page.tsx
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientUploadDesk } from "@/components/client/ClientUploadDesk";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Panel } from "@/components/portal/Panel";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { findActiveClientDomain } from "@/lib/db/client-domains";
import { listClientDocuments } from "@/lib/db/documents";
import { isClerkConfigured, isDatabaseConfigured, isStorageConfigured } from "@/lib/env";
import { shortDate } from "@/lib/portal/dates";
import { formatBytes } from "@/lib/portal/files";
import { resolveIdentity } from "@/lib/portal/roles";

export const dynamic = "force-dynamic";

function signOut() {
  return (
    <SignOutButton redirectUrl="/access">
      <button type="button" className="btn-quiet text-[12px]">Sign out</button>
    </SignOutButton>
  );
}

export default async function ClientDeskPage() {
  if (!isClerkConfigured() || !isDatabaseConfigured() || !isStorageConfigured()) return <SetupNotice />;

  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/access");
  const identity = await resolveIdentity(userId, sessionClaims);

  if (identity.role === "director") {
    return (
      <div className="max-w-xl">
        <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
        <h1 className="font-serif text-3xl text-green">This is the clients' desk</h1>
        <p className="mt-3 text-[14px] text-ink/70">
          Directors manage client domains and see what has arrived at{" "}
          <Link href="/portal/clients" className="text-green underline hover:text-brass">Clients</Link> on the pursuit desk.
        </p>
      </div>
    );
  }
  if (!identity.domain) redirect("/access/denied");

  const domain = await findActiveClientDomain(identity.domain);
  if (!domain) {
    return (
      <div className="max-w-xl">
        <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
        <h1 className="font-serif text-3xl text-green">Access for {identity.domain} has ended</h1>
        <p className="mt-3 text-[14px] text-ink/70">If you still need to send documents, contact Meritus at enquiries@meritusvia.com.</p>
        <div className="mt-6">{signOut()}</div>
      </div>
    );
  }

  const files = await listClientDocuments(domain.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
          <h1 className="font-serif text-3xl text-green">{domain.firm}</h1>
          <p className="mt-2 font-mono text-[11px] tracking-[0.12em] text-ink/70">
            {identity.email ?? identity.domain} · files go straight to Meritus
          </p>
        </div>
        {signOut()}
      </div>

      <Panel eyebrow="Send documents">
        <ClientUploadDesk />
      </Panel>

      <Panel eyebrow="What your firm has sent">
        {files.length === 0 ? (
          <p className="text-[14px] text-ink/70">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-green/10">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-4 py-3 text-[13px]">
                <span className="min-w-0 truncate text-green">{file.title}</span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                  {formatBytes(file.size)} · {shortDate(file.createdAt)}
                  {file.uploaderEmail ? ` · ${file.uploaderEmail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 6: Type check, lint and run the suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean and green. The `.portal` wrapper class on the layout makes the portal button and field styles apply.

- [ ] **Step 7: Commit**

```bash
git add src/lib/client src/components/client src/app/client
git commit -m "feat(client): resumable multipart uploads from the browser and the client desk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Directors manage client domains

**Files:**
- Create: `src/lib/portal/client-actions.ts`
- Test: `src/lib/portal/client-actions.test.ts`
- Create: `src/components/portal/ClientDomainForm.tsx`, `src/components/portal/ClientDomainList.tsx`
- Create: `src/app/(portal)/portal/clients/page.tsx`
- Modify: `src/app/(portal)/portal/layout.tsx` (nav link)

**Interfaces:**
- `client-actions.ts` produces (`"use server"`): `type AddClientDomainState = { ok: true; domain: string } | { ok: false; error: string } | null`, `addClientDomainAction(prev: AddClientDomainState, formData: FormData): Promise<AddClientDomainState>` (fields `domain`, `firm`, `pursuitId`), `removeClientDomainAction(id: string): Promise<ActionResult>`, `linkClientDomainAction(id: string, pursuitId: string | null): Promise<ActionResult>`.
- `ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] })`, `ClientDomainList({ domains, pursuits, files }: { domains: ClientDomain[]; pursuits: PursuitOption[]; files: Record<string, ClientFileSummary[]> })` where `type PursuitOption = { id: string; firm: string; stage: string }` and `type ClientFileSummary = { id: string; title: string; size: number; createdAt: Date; uploaderEmail: string | null }`, both exported from `ClientDomainList.tsx`.
- Consumes: Task 1 parsing, Task 3 helpers, `requireActionUser` (Task 6), `ActionResult` from `src/lib/portal/types.ts`, `getPursuit`, `listPursuitsForLinking`, `fullDate` and `shortDate` from `dates.ts`, `formatBytes` (Task 12).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/portal/client-actions.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  findClientDomainByName,
  insertClientDomain,
  reactivateClientDomain,
  removeClientDomain,
  setClientDomainPursuit,
} from "@/lib/db/client-domains";
import { getPursuit } from "@/lib/db/pursuits";
import { requireActionUser } from "./auth";
import { addClientDomainAction, linkClientDomainAction, removeClientDomainAction } from "./client-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./auth", () => ({ requireActionUser: vi.fn() }));
vi.mock("@/lib/db/client-domains", () => ({
  findClientDomainByName: vi.fn(),
  insertClientDomain: vi.fn(),
  reactivateClientDomain: vi.fn(),
  removeClientDomain: vi.fn(),
  setClientDomainPursuit: vi.fn(),
}));
vi.mock("@/lib/db/pursuits", () => ({ getPursuit: vi.fn() }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const removed = { id: "cd_old", domain: "example-firm.co.uk", firm: "Old name", pursuitId: null, createdBy: "user_wr", createdAt: new Date(), removedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActionUser).mockResolvedValue({ ok: true, userId: "user_wr" });
  vi.mocked(findClientDomainByName).mockResolvedValue(null);
  vi.mocked(getPursuit).mockResolvedValue({ id: "p1" } as never);
  vi.mocked(insertClientDomain).mockImplementation(async (values) => ({ ...removed, ...values, removedAt: null }) as never);
  vi.mocked(removeClientDomain).mockResolvedValue(true);
  vi.mocked(setClientDomainPursuit).mockResolvedValue({ ...removed, removedAt: null, pursuitId: "p1" });
});

describe("addClientDomainAction", () => {
  it("lists a domain with its firm and pursuit", async () => {
    const result = await addClientDomainAction(null, form({ domain: "Jane@Example-Firm.co.uk", firm: " Example Firm LLP ", pursuitId: "p1" }));
    expect(result).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(insertClientDomain).toHaveBeenCalledWith(expect.objectContaining({ domain: "example-firm.co.uk", firm: "Example Firm LLP", pursuitId: "p1", createdBy: "user_wr" }));
    expect(revalidatePath).toHaveBeenCalledWith("/portal", "layout");
  });
  it("refuses public mailboxes, the firm's own domain, a missing firm name and a dead pursuit", async () => {
    expect(await addClientDomainAction(null, form({ domain: "gmail.com", firm: "X" }))).toEqual({ ok: false, error: "Public mailbox domains cannot be added" });
    expect(await addClientDomainAction(null, form({ domain: "meritusvia.com", firm: "X" }))).toEqual({ ok: false, error: "meritusvia.com is reserved for directors" });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: " " }))).toEqual({ ok: false, error: "Enter the firm's name" });
    vi.mocked(getPursuit).mockResolvedValue(null);
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X", pursuitId: "gone" }))).toEqual({ ok: false, error: "That pursuit no longer exists" });
    expect(insertClientDomain).not.toHaveBeenCalled();
  });
  it("refuses a domain that is already listed and re-lists a removed one", async () => {
    vi.mocked(findClientDomainByName).mockResolvedValue({ ...removed, removedAt: null });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X" }))).toEqual({ ok: false, error: "That domain is already listed" });
    vi.mocked(findClientDomainByName).mockResolvedValue(removed);
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "New name" }))).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(reactivateClientDomain).toHaveBeenCalledWith("cd_old", { firm: "New name", pursuitId: null });
    expect(insertClientDomain).not.toHaveBeenCalled();
  });
  it("refuses anyone who is not a director", async () => {
    vi.mocked(requireActionUser).mockResolvedValue({ ok: false, error: "Directors only" });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X" }))).toEqual({ ok: false, error: "Directors only" });
  });
});

describe("removeClientDomainAction and linkClientDomainAction", () => {
  it("removes and links", async () => {
    expect(await removeClientDomainAction("cd_old")).toEqual({ ok: true });
    expect(removeClientDomain).toHaveBeenCalledWith("cd_old");
    expect(await linkClientDomainAction("cd_old", "p1")).toEqual({ ok: true });
    expect(setClientDomainPursuit).toHaveBeenCalledWith("cd_old", "p1");
    expect(await linkClientDomainAction("cd_old", null)).toEqual({ ok: true });
  });
  it("reports a domain that is no longer listed", async () => {
    vi.mocked(removeClientDomain).mockResolvedValue(false);
    expect(await removeClientDomainAction("cd_old")).toEqual({ ok: false, error: "That domain is no longer listed" });
    vi.mocked(setClientDomainPursuit).mockResolvedValue(null);
    expect(await linkClientDomainAction("cd_old", "p1")).toEqual({ ok: false, error: "That domain is no longer listed" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portal/client-actions.test.ts`
Expected: FAIL, cannot resolve `./client-actions`.

- [ ] **Step 3: Write the actions**

```ts
// src/lib/portal/client-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  findClientDomainByName,
  insertClientDomain,
  reactivateClientDomain,
  removeClientDomain,
  setClientDomainPursuit,
} from "@/lib/db/client-domains";
import { getPursuit } from "@/lib/db/pursuits";
import { requireActionUser } from "./auth";
import { clientDomainErrorMessage, parseClientDomain } from "./domains";
import type { ActionResult } from "./types";

export type AddClientDomainState = { ok: true; domain: string } | { ok: false; error: string } | null;

const GONE = "That domain is no longer listed";

function refresh(): void {
  revalidatePath("/portal", "layout");
  revalidatePath("/client");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

export async function addClientDomainAction(_prev: AddClientDomainState, formData: FormData): Promise<AddClientDomainState> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return { ok: false, error: user.error };

    const parsed = parseClientDomain(String(formData.get("domain") ?? ""));
    if (!parsed.ok) return { ok: false, error: clientDomainErrorMessage(parsed.error) };
    const firm = String(formData.get("firm") ?? "").trim().slice(0, 200);
    if (!firm) return { ok: false, error: "Enter the firm's name" };
    const pursuitRaw = String(formData.get("pursuitId") ?? "").trim();
    const pursuitId = pursuitRaw ? pursuitRaw : null;
    if (pursuitId && !(await getPursuit(pursuitId))) return { ok: false, error: "That pursuit no longer exists" };

    const existing = await findClientDomainByName(parsed.domain);
    if (existing && !existing.removedAt) return { ok: false, error: "That domain is already listed" };
    if (existing) {
      await reactivateClientDomain(existing.id, { firm, pursuitId });
    } else {
      await insertClientDomain({ id: crypto.randomUUID(), domain: parsed.domain, firm, pursuitId, createdBy: user.userId });
    }
    return { ok: true, domain: parsed.domain };
  } catch (error) {
    console.error("[portal] addClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}

export async function removeClientDomainAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    if (!isId(id)) return { ok: false, error: GONE };
    return (await removeClientDomain(id)) ? { ok: true } : { ok: false, error: GONE };
  } catch (error) {
    console.error("[portal] removeClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}

export async function linkClientDomainAction(id: string, pursuitId: string | null): Promise<ActionResult> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    if (!isId(id)) return { ok: false, error: GONE };
    if (pursuitId !== null && (!isId(pursuitId) || !(await getPursuit(pursuitId)))) {
      return { ok: false, error: "That pursuit no longer exists" };
    }
    const row = await setClientDomainPursuit(id, pursuitId);
    return row ? { ok: true } : { ok: false, error: GONE };
  } catch (error) {
    console.error("[portal] linkClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/portal/client-actions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the components, the page and the nav link**

```tsx
// src/components/portal/ClientDomainForm.tsx
"use client";

import { useActionState } from "react";
import { addClientDomainAction, type AddClientDomainState } from "@/lib/portal/client-actions";
import type { PursuitOption } from "./ClientDomainList";

export function ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] }) {
  const [state, action, pending] = useActionState<AddClientDomainState, FormData>(addClientDomainAction, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="portal-label">Company email domain<span className="text-brass"> *</span></span>
        <input name="domain" type="text" required className="portal-field" placeholder="example-firm.co.uk" autoComplete="off" />
      </label>
      <label className="block">
        <span className="portal-label">Firm<span className="text-brass"> *</span></span>
        <input name="firm" type="text" required className="portal-field" placeholder="Example Firm LLP" autoComplete="organization" />
      </label>
      <label className="block">
        <span className="portal-label">Pursuit (files land on its dossier)</span>
        <select name="pursuitId" className="portal-field" defaultValue="">
          <option value="">Not linked yet</option>
          {pursuits.map((pursuit) => (
            <option key={pursuit.id} value={pursuit.id}>
              {pursuit.firm} · {pursuit.stage}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-brass text-[12px]" disabled={pending}>
        {pending ? "Adding…" : "Add domain"}
      </button>
      {state?.ok ? <p className="text-[12px] text-ink/70">{state.domain} can now request links at meritusvia.com/access.</p> : null}
      {state && !state.ok ? <p className="text-[12px] text-oxblood">{state.error}</p> : null}
    </form>
  );
}
```

```tsx
// src/components/portal/ClientDomainList.tsx
"use client";

import { useState, useTransition } from "react";
import type { ClientDomain } from "@/lib/db/schema";
import { linkClientDomainAction, removeClientDomainAction } from "@/lib/portal/client-actions";
import { fullDate, shortDate } from "@/lib/portal/dates";
import { formatBytes } from "@/lib/portal/files";

export type PursuitOption = { id: string; firm: string; stage: string };
export type ClientFileSummary = { id: string; title: string; size: number; createdAt: Date; uploaderEmail: string | null };

export function ClientDomainList({
  domains,
  pursuits,
  files,
}: {
  domains: ClientDomain[];
  pursuits: PursuitOption[];
  files: Record<string, ClientFileSummary[]>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return <p className="text-[14px] text-ink/70">No client domains yet. Add one above and the firm can start sending files.</p>;
  }

  function act(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? "Something went wrong"));
    });
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-[12px] text-oxblood">{error}</p> : null}
      {domains.map((row) => {
        const rowFiles = files[row.id] ?? [];
        return (
          <article key={row.id} className="border border-green/10 bg-parchment p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl text-green">{row.firm}</h3>
                <p className="font-mono text-[10px] tracking-[0.12em] text-ink/70">@{row.domain} · added {fullDate(row.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-[12px] text-ink/70">
                  <span className="portal-label">Pursuit</span>
                  <select
                    className="portal-field"
                    value={row.pursuitId ?? ""}
                    disabled={pending}
                    onChange={(event) => {
                      const value = event.target.value;
                      act(() => linkClientDomainAction(row.id, value ? value : null));
                    }}
                  >
                    <option value="">Not linked</option>
                    {pursuits.map((pursuit) => (
                      <option key={pursuit.id} value={pursuit.id}>
                        {pursuit.firm} · {pursuit.stage}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-quiet text-[12px] hover:text-oxblood"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove @${row.domain}? People there can no longer request links. Files already sent stay.`)) {
                      act(() => removeClientDomainAction(row.id));
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            {rowFiles.length === 0 ? (
              <p className="mt-4 text-[13px] text-ink/70">Nothing sent yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-green/10">
                {rowFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                    <a href={`/api/portal/documents/${file.id}`} className="min-w-0 truncate text-green hover:text-brass">
                      {file.title}
                    </a>
                    <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                      {formatBytes(file.size)} · {shortDate(file.createdAt)}
                      {file.uploaderEmail ? ` · ${file.uploaderEmail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
```

```tsx
// src/app/(portal)/portal/clients/page.tsx
import { ClientDomainForm } from "@/components/portal/ClientDomainForm";
import { ClientDomainList, type ClientFileSummary, type PursuitOption } from "@/components/portal/ClientDomainList";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Panel } from "@/components/portal/Panel";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { listActiveClientDomains } from "@/lib/db/client-domains";
import { listClientDocuments } from "@/lib/db/documents";
import { listPursuitsForLinking } from "@/lib/db/pursuits";
import type { ClientDomain } from "@/lib/db/schema";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { stageLabel } from "@/lib/portal/stages";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) return <SetupNotice />;

  let domains: ClientDomain[] = [];
  let pursuits: PursuitOption[] = [];
  let files: Record<string, ClientFileSummary[]> = {};
  try {
    const [domainRows, pursuitRows] = await Promise.all([listActiveClientDomains(), listPursuitsForLinking()]);
    domains = domainRows;
    pursuits = pursuitRows.map((p) => ({ id: p.id, firm: p.firm, stage: stageLabel(p.stage) }));
    const lists = await Promise.all(domainRows.map((row) => listClientDocuments(row.id)));
    files = Object.fromEntries(
      domainRows.map((row, index) => [
        row.id,
        lists[index].map((doc) => ({ id: doc.id, title: doc.title, size: doc.size, createdAt: doc.createdAt, uploaderEmail: doc.uploaderEmail })),
      ])
    );
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Eyebrow rule={false} className="mb-3">Clients</Eyebrow>
        <h1 className="font-serif text-4xl text-green">Client file drop</h1>
        <p className="mt-3 max-w-xl text-[14px] text-ink/70">
          Add a firm&apos;s email domain. Anyone with a mailbox there can request a link at meritusvia.com/access
          and drop files straight into VeriCase&apos;s store. Link the domain to a pursuit so files land on its dossier.
        </p>
      </div>
      <Panel eyebrow="Add a domain" className="max-w-xl">
        <ClientDomainForm pursuits={pursuits} />
      </Panel>
      <section>
        <Eyebrow className="mb-4">Listed domains</Eyebrow>
        <ClientDomainList domains={domains} pursuits={pursuits} files={files} />
      </section>
    </div>
  );
}
```

`stageLabel(stage: PursuitStage): string` is exported from `src/lib/portal/stages.ts` (line 24).

In `src/app/(portal)/portal/layout.tsx`, after the Library `NavLink` in the desktop rail (line 55 to 57) add:

```tsx
          <NavLink href="/portal/clients">
            Clients
          </NavLink>
```

and after the Library `NavLink` in the mobile bar (line 82 to 84) add:

```tsx
            <NavLink href="/portal/clients" variant="bar">
              Clients
            </NavLink>
```

- [ ] **Step 6: Type check, lint and run the suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean and green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/portal/client-actions.ts src/lib/portal/client-actions.test.ts src/components/portal/ClientDomainForm.tsx src/components/portal/ClientDomainList.tsx "src/app/(portal)/portal/clients/page.tsx" "src/app/(portal)/portal/layout.tsx"
git commit -m "feat(portal): directors list client domains, link them to pursuits and see what arrived

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Files come back out

**Files:**
- Modify: `src/app/api/portal/documents/[id]/route.ts`
- Test: `src/app/api/portal/documents/[id]/route.test.ts` (new)
- Modify: `src/lib/portal/files.ts` (add `DIRECT_DOWNLOAD_BYTES`)

**Interfaces:**
- `GET /api/portal/documents/[id]`: files at or under `DIRECT_DOWNLOAD_BYTES` (100 MiB) stream through with `Content-Length`, `Content-Disposition` (RFC 6266), `X-Content-Type-Options: nosniff`; larger files answer 302 to a one-minute presigned URL. `DELETE` is unchanged.
- Consumes: `getObjectStream`, `presignDownload` (Task 11), `contentDisposition` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/portal/documents/[id]/route.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "@/lib/db/documents";
import type { DocumentRow } from "@/lib/db/schema";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { DIRECT_DOWNLOAD_BYTES } from "@/lib/portal/files";
import { getObjectStream, presignDownload } from "@/lib/portal/s3-transfer";
import { GET } from "./route";

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requirePortalUser: vi.fn(), requireDatabaseOr503: vi.fn() };
});
vi.mock("@/lib/env", () => ({ isStorageConfigured: () => true }));
vi.mock("@/lib/db/documents", () => ({ getDocument: vi.fn(), deleteDocumentRow: vi.fn() }));
vi.mock("@/lib/db/activity", () => ({ addActivity: vi.fn() }));
vi.mock("@/lib/portal/s3", () => ({ deleteObjects: vi.fn() }));
vi.mock("@/lib/portal/s3-transfer", () => ({ getObjectStream: vi.fn(), presignDownload: vi.fn() }));

function doc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "d1",
    scope: "pursuit",
    pursuitId: "p1",
    clientDomainId: "cd_1",
    title: "Trial bundle.pdf",
    blobUrl: "s3://vericase-test/meritus/clients/x/d1-Trial bundle.pdf",
    blobPathname: "meritus/clients/x/d1-Trial bundle.pdf",
    fileName: "Trial bundle.pdf",
    mime: "application/pdf",
    size: 1234,
    extractedText: null,
    uploadedBy: "user_c",
    uploaderEmail: "jane@example-firm.co.uk",
    createdAt: new Date("2026-09-12T10:00:00Z"),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "d1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePortalUser).mockResolvedValue({ userId: "user_wr" });
  vi.mocked(requireDatabaseOr503).mockReturnValue(null);
  vi.mocked(getDocument).mockResolvedValue(doc());
  vi.mocked(getObjectStream).mockResolvedValue({
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("%PDF")); controller.close(); } }),
    size: 1234,
    contentType: "application/pdf",
  });
  vi.mocked(presignDownload).mockResolvedValue("https://vericase-test.s3.eu-west-2.amazonaws.com/k?X-Amz-Expires=60");
});

describe("GET /api/portal/documents/[id]", () => {
  it("streams a small file as an attachment with the right headers", async () => {
    const res = await GET(new Request("http://localhost/api/portal/documents/d1"), context);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe("1234");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="Trial bundle.pdf"; filename*=UTF-8''Trial%20bundle.pdf`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("%PDF");
    expect(presignDownload).not.toHaveBeenCalled();
  });

  it("redirects a large file to a one-minute presigned url", async () => {
    vi.mocked(getDocument).mockResolvedValue(doc({ size: DIRECT_DOWNLOAD_BYTES + 1 }));
    const res = await GET(new Request("http://localhost/api/portal/documents/d1"), context);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("X-Amz-Expires=60");
    expect(presignDownload).toHaveBeenCalledWith("meritus/clients/x/d1-Trial bundle.pdf", "Trial bundle.pdf");
    expect(getObjectStream).not.toHaveBeenCalled();
  });

  it("answers 404 when the row or the object is missing", async () => {
    vi.mocked(getObjectStream).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(404);
    vi.mocked(getDocument).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(404);
  });

  it("passes the guard's answer through", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requirePortalUser).mockResolvedValue({ error: NextResponse.json({ error: "Directors only" }, { status: 403 }) });
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/portal/documents/[id]/route.test.ts"`
Expected: FAIL: `DIRECT_DOWNLOAD_BYTES` is not exported and the route still imports `getObject`.

- [ ] **Step 3: Update the constant and the route**

Append to `src/lib/portal/files.ts`:

```ts
/** Above this a Vercel function cannot proxy the file; the route redirects to a one-minute presigned url instead. */
export const DIRECT_DOWNLOAD_BYTES = 100 * 1024 * 1024;
```

In `src/app/api/portal/documents/[id]/route.ts` replace the imports and the `GET` handler (keep `DELETE` exactly as it is):

```ts
import { NextResponse } from "next/server";
import { deleteDocumentRow, getDocument } from "@/lib/db/documents";
import { addActivity } from "@/lib/db/activity";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { isStorageConfigured } from "@/lib/env";
import { DIRECT_DOWNLOAD_BYTES, contentDisposition } from "@/lib/portal/files";
import { deleteObjects } from "@/lib/portal/s3";
import { getObjectStream, presignDownload } from "@/lib/portal/s3-transfer";

export const dynamic = "force-dynamic";
/** Streaming a file of up to 100 MiB on a slow link can take minutes. */
export const maxDuration = 300;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (document.size > DIRECT_DOWNLOAD_BYTES) {
    const url = await presignDownload(document.blobPathname, document.fileName);
    return NextResponse.redirect(url, 302);
  }

  const object = await getObjectStream(document.blobPathname);
  if (!object) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": document.mime,
    "Content-Disposition": contentDisposition(document.fileName),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  if (object.size !== null) headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
```

- [ ] **Step 4: Run the test and the suite**

Run: `npx vitest run "src/app/api/portal/documents/[id]/route.test.ts" && npm test && npx tsc --noEmit`
Expected: PASS, 4 tests; suite green; tsc clean. `getObject` in `src/lib/portal/s3.ts` is now unused by routes; leave it, `actions.test.ts` still mocks the module by name.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/portal/documents/[id]/route.ts" "src/app/api/portal/documents/[id]/route.test.ts" src/lib/portal/files.ts
git commit -m "feat(portal): stream small downloads, redirect large ones to a presigned url

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Documentation and the final checks

**Files:**
- Modify: `README.md`
- Modify: `.env.example` (confirm the Task 10 line is present)

- [ ] **Step 1: Update the README**

Replace the `### Uploads` section with:

```markdown
### Client file drop

Directors list a client firm's email domain at `/portal/clients` and can link it to a pursuit. Anyone with a mailbox at that domain types their work email at `/access`; if the domain is listed, Resend sends a single-use link that expires in 30 minutes, `/access/continue` exchanges it for a Clerk session, and `/client` is their upload desk. There is no password and no public sign-up. Directors stay invite-only.

Files go straight from the browser to the VeriCase bucket by S3 multipart upload, up to 50 GB each, under `meritus/clients/<domain>/`. Nothing is extracted or analysed: the backend is a static document hold and VeriCase reads the bucket and the `documents` table. A linked domain's files appear on the pursuit's dossier; unlinked ones sit under the domain at `/portal/clients`.

Roles: every Clerk user carries `publicMetadata.role`, `director` or `client`. The middleware and every guard deny anything else. Set the three directors' metadata to `{"role": "director"}` in the Clerk dashboard before deploying this, or nobody can sign in. Optionally add the session claim `{"metadata": "{{user.public_metadata}}"}` under Sessions so the role rides in the token.

### Uploads on the desk

Director uploads on a pursuit or in the library still go through the 4 MB route (Vercel refuses larger request bodies) and text is extracted for the questions drawer. Downloads of any file up to 100 MiB stream through `/api/portal/documents/<id>`; larger files redirect to a one-minute presigned URL.
```

In `### One-off manual steps` add:

```markdown
5. **Clerk roles**: set `publicMetadata` to `{"role": "director"}` on each director. Clients get `{"role": "client", "domain": "...", "email": "..."}` automatically.
6. **AWS**: create the `meritus-portal` IAM user limited to `meritus/*` in `vericase-data` (policy in `docs/superpowers/plans/2026-09-12-client-file-drop.md`) and set its keys, `S3_BUCKET=vericase-data`, `S3_REGION=eu-west-2` and `S3_KEY_PREFIX=meritus` on the Vercel project.
```

- [ ] **Step 2: Run everything**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green. `npm run build` runs `scripts/migrate.mjs`, which exits 0 without `DATABASE_URL`; with a local Neon branch URL it applies `0003_client_files` in one transaction.

- [ ] **Step 3: Manual check against a preview deployment (or say you could not)**

1. A director with `role: director` signs in at `/sign-in` and reaches `/portal` and `/portal/clients`.
2. A director adds `example-firm.co.uk` with a firm name and links it to a pursuit.
3. `/access` with `someone@gmail.com` and with `someone@unlisted.co.uk` both show the generic message; no email arrives.
4. `/access` with `jane@example-firm.co.uk` receives "Your Meritus file link"; clicking it lands on `/client` showing the firm.
5. Uploading a 200 MB file shows progress, survives a reload and re-selecting the file, and lands in `vericase-data` under `meritus/clients/example-firm.co.uk/`.
6. The file appears on the pursuit's dossier and at `/portal/clients`; the director's download streams (small) or redirects (over 100 MiB).
7. Jane visiting `/portal` is sent to `/client`. Removing the domain ends her uploads with "Access for this domain has ended".

- [ ] **Step 4: Commit and open the pull request**

```bash
git add README.md .env.example
git commit -m "docs: client file drop, roles and manual steps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin cursor/client-domain-resend-93bc
```

Open one PR on `williamcjrogers/Meritus` against `main` titled "Client file drop: Resend link, multipart uploads to VeriCase S3, director and client roles". The body lists the manual steps from this plan and ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Spec coverage

| Spec requirement | Tasks |
|---|---|
| R1 Files sit still (keys, rows, no extraction) | 2, 3, 12 |
| R2 Files up to 50 GB by multipart, stale aborts | 11, 12, 13, 14 |
| R3 Files come back out (stream, presigned over 100 MiB) | 11, 16 |
| R4 The file drop (domains, access page, Resend, ticket, desk, generic reply, rate limits, deny-list) | 1, 8, 9, 10, 14, 15 |
| R5 Roles in middleware and every guard | 4, 5, 6 |
| R6 Directors are an explicit list | 7 |
| R7 Scope on every read | 6 (client guard), 12 (`ownedUpload`, `activeDomain`), 16 (directors only) |
| R8 Own IAM principal | Manual steps |
