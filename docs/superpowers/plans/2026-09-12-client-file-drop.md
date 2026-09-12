# Client File Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client at a director-listed company domain request a one-click Resend link on `/access`, sign in through a Clerk sign-in token, and upload files that land in VeriCase S3 under `meritus/clients/` and on the pursuit's dossier.

**Architecture:** Pure domain and role helpers in `src/lib/portal`; a `client_domains` table joined to pursuits; actor resolution (director or client) extending the cached Clerk user list in `directors.ts`; gates in `auth.ts` that every portal and client entry point calls; a public `/access` flow in `src/lib/access` that reuses the Resend client from `alerts.ts`; a `/client` upload desk that calls the existing `storePortalDocument`. The middleware only decides which sign-in page an anonymous visitor goes to.

**Tech Stack:** Next 15 app router, React 19, Clerk 7 (`@clerk/nextjs` 7.9, signals `useSignIn`, Backend API sign-in tokens), Drizzle 0.45 on Neon (neon-http), `@aws-sdk/client-s3`, Resend 6, Vitest 5 with Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-12-client-file-drop-design.md` (read it first; the plan argues from it). Also read `docs/HANDOVER-client-files.md` for the do-not list.

## Global Constraints

- British English in every string, comment and test name. Never an em dash anywhere (use commas, colons, semicolons or parentheses).
- Dates through `src/lib/portal/dates.ts` (`fullDate` gives "12 September 2026").
- Classes only from `src/styles/globals.css`: `portal-field`, `portal-label`, `btn-outline`, `btn-secondary`, `panel-brackets`, `portal-rail`, `grain`; components `Eyebrow`, `Panel`, `SetupNotice`, `ConfirmDialog`, `HallmarkLogo`. No new colours. Do not touch the marketing site.
- Server actions return `{ ok: true }` or `{ ok: false, error }` and never throw redirects.
- Files stay on VeriCase S3 through `putObject` in `src/lib/portal/s3.ts`. Never Vercel Blob. Never a presigned URL in the browser.
- Clerk stays invite-only for directors. No password form, no public `<SignUp>`, no Clerk invitation email for clients.
- Resend is the only sender. If it is unset, `/access` refuses; nothing falls back to Clerk mail.
- Tokens, API keys and secrets are never logged. `.env.local` is never committed.
- Every task: write the failing test first, run it, implement, run `npm test -- <file>` and `npx tsc --noEmit`, commit. Stop at the end of the task.
- Branch: `cursor/client-domain-resend-93bc` (already checked out; it holds PR #9's S3 commit and the spec). `src/lib/db/schema.ts` has an uncommitted sketch that Task 2 replaces.
- Baseline before Task 1: `npm test` gives 411 passed; `npx tsc --noEmit` is clean.

## File map

| File | Responsibility |
|---|---|
| `src/lib/portal/domains.ts` | Parse and validate company domains and work emails (pure) |
| `src/lib/portal/roles.ts` | Director or client from Clerk metadata plus listed domains; client actor id (pure) |
| `src/lib/db/schema.ts`, `drizzle/0003_client_domains.sql`, `drizzle/meta/_journal.json` | `client_domains` table, `documents.client_domain_id` |
| `src/lib/db/client-domains.ts` | Reads and writes for `client_domains`, cached name list |
| `src/lib/db/documents.ts`, `src/lib/db/pursuits.ts` | `listClientDocuments`, `listPursuitsForClientAccess` |
| `src/lib/db/throttle.ts`, `src/lib/portal/intake.ts` | `/access` rate limit keys and caps |
| `src/lib/portal/director-helpers.ts`, `src/lib/portal/directors.ts` | `primaryEmailOf`; actor list, `getActor`, stale list on failure |
| `src/lib/portal/auth.ts` | Role checks on the portal gates; `clientContext`, `requireClientUser` |
| `src/lib/portal/gate.ts`, `src/middleware.ts` | Which area a path is in and where its anonymous visitors go |
| `src/lib/access/mail.ts` | The Resend "Your Meritus file link" email |
| `src/lib/access/request.ts`, `src/app/api/access/route.ts` | The `/access` request: refusals, Clerk user, token, send |
| `src/components/access/*`, `src/app/access/**` | Public request page and ticket continuation page |
| `src/lib/portal/upload.ts`, `src/lib/portal/files.ts`, `src/components/portal/FileList.tsx`, `src/components/portal/ActivityTimeline.tsx` | Client uploads through the existing store; "client" tags |
| `src/app/client/**`, `src/app/api/client/documents/**` | Client upload desk and its routes |
| `src/lib/portal/client-actions.ts` | Director actions: add and remove a domain |
| `src/app/(portal)/portal/clients/page.tsx`, `src/components/portal/ClientDomainForm.tsx`, `src/components/portal/ClientDomainList.tsx`, `src/app/(portal)/portal/layout.tsx` | Directors' Clients page, nav item, client redirect |
| `README.md`, `.env.example`, `next-sitemap.config.js` | Docs and sitemap exclusions |

---

## Task 1: Domain and role helpers (pure)

**Files:**
- Create: `src/lib/portal/domains.ts`, `src/lib/portal/domains.test.ts`
- Create: `src/lib/portal/roles.ts`, `src/lib/portal/roles.test.ts`

**Interfaces (produces):**

```ts
// domains.ts
export const PUBLIC_MAILBOX_DOMAINS: readonly string[];
export const FIRM_DOMAIN = "meritusvia.com";
export type DomainParseError = "empty" | "invalid" | "public_mailbox" | "firm_domain";
export type DomainParseResult = { ok: true; domain: string } | { ok: false; error: DomainParseError };
export function normaliseDomain(input: string): string;
export function isPublicMailboxDomain(domain: string): boolean;
export function isFirmDomain(domain: string): boolean;
export function domainFromEmail(email: string | null | undefined): string | null;
export function domainInput(raw: string): string;
export function parseClientDomain(raw: string): DomainParseResult;
export function clientDomainErrorMessage(error: DomainParseError): string;
export type WorkEmailError = "invalid" | "public_mailbox" | "firm_domain";
export type WorkEmailResult = { ok: true; email: string; domain: string } | { ok: false; error: WorkEmailError };
export function parseWorkEmail(raw: string): WorkEmailResult;
export function emailMatchesClientDomain(email: string | null | undefined, clientDomains: readonly string[]): boolean;

// roles.ts
export type ActorKind = "director" | "client";
export const CLIENT_ROLE = "client";
export const CLIENT_ACTOR_PREFIX = "client:";
export function isClientRole(role: unknown): boolean;
export function actorKindFromSignals(input: { role: unknown; email?: string | null; clientDomains: readonly string[] }): ActorKind;
export function clientActorId(email: string): string;          // "client:jane@acme.co.uk"
export function clientActorEmail(actorId: string): string | null; // inverse; null when not a client actor
```

- [ ] **Step 1: Write the failing tests**

`src/lib/portal/domains.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clientDomainErrorMessage,
  domainFromEmail,
  domainInput,
  emailMatchesClientDomain,
  isFirmDomain,
  isPublicMailboxDomain,
  normaliseDomain,
  parseClientDomain,
  parseWorkEmail,
} from "./domains";

describe("normaliseDomain", () => {
  it("strips a leading @, lowercases and trims", () => {
    expect(normaliseDomain("  @ACME.co.uk  ")).toBe("acme.co.uk");
    expect(normaliseDomain("acme.co.uk")).toBe("acme.co.uk");
  });
});

describe("domainInput", () => {
  it("treats a bare host and an @host as the same", () => {
    expect(domainInput("acme.co.uk")).toBe("acme.co.uk");
    expect(domainInput("@acme.co.uk")).toBe("acme.co.uk");
  });

  it("takes the host from a full email", () => {
    expect(domainInput("Jane@ACME.co.uk")).toBe("acme.co.uk");
  });
});

describe("domainFromEmail", () => {
  it("returns the host in lowercase", () => {
    expect(domainFromEmail("Jane@ACME.co.uk")).toBe("acme.co.uk");
  });

  it("is null when there is no usable host", () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("not-an-email")).toBeNull();
    expect(domainFromEmail("@acme.co.uk")).toBeNull();
  });
});

describe("parseClientDomain", () => {
  it("accepts a company domain in any of the three forms", () => {
    expect(parseClientDomain("acme.co.uk")).toEqual({ ok: true, domain: "acme.co.uk" });
    expect(parseClientDomain("@acme.co.uk")).toEqual({ ok: true, domain: "acme.co.uk" });
    expect(parseClientDomain("jane@acme.co.uk")).toEqual({ ok: true, domain: "acme.co.uk" });
  });

  it("refuses public mailbox domains", () => {
    for (const domain of [
      "gmail.com",
      "googlemail.com",
      "outlook.com",
      "hotmail.com",
      "live.com",
      "yahoo.com",
      "icloud.com",
      "me.com",
      "aol.com",
      "proton.me",
      "protonmail.com",
    ]) {
      expect(parseClientDomain(domain)).toEqual({ ok: false, error: "public_mailbox" });
      expect(isPublicMailboxDomain(domain)).toBe(true);
    }
  });

  it("refuses meritusvia.com and its subdomains", () => {
    expect(parseClientDomain("meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("@meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("mail.meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(isFirmDomain("meritusvia.com")).toBe(true);
    expect(isFirmDomain("acme.co.uk")).toBe(false);
  });

  it("refuses empty or shapeless input", () => {
    expect(parseClientDomain("")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("localhost")).toEqual({ ok: false, error: "invalid" });
    expect(parseClientDomain("not a domain")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("parseWorkEmail", () => {
  it("lowercases and returns the host", () => {
    expect(parseWorkEmail(" Jane@ACME.co.uk ")).toEqual({ ok: true, email: "jane@acme.co.uk", domain: "acme.co.uk" });
  });

  it("refuses malformed addresses", () => {
    expect(parseWorkEmail("")).toEqual({ ok: false, error: "invalid" });
    expect(parseWorkEmail("jane")).toEqual({ ok: false, error: "invalid" });
    expect(parseWorkEmail("jane@localhost")).toEqual({ ok: false, error: "invalid" });
    expect(parseWorkEmail(`${"a".repeat(250)}@acme.co.uk`)).toEqual({ ok: false, error: "invalid" });
  });

  it("refuses personal mailboxes and the firm domain", () => {
    expect(parseWorkEmail("jane@gmail.com")).toEqual({ ok: false, error: "public_mailbox" });
    expect(parseWorkEmail("william@meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
  });
});

describe("emailMatchesClientDomain", () => {
  it("matches a listed company domain", () => {
    expect(emailMatchesClientDomain("jane@acme.co.uk", ["acme.co.uk"])).toBe(true);
    expect(emailMatchesClientDomain("jane@other.co.uk", ["acme.co.uk"])).toBe(false);
  });

  it("never matches meritusvia.com even if it appears on the list", () => {
    expect(emailMatchesClientDomain("mateo@meritusvia.com", ["meritusvia.com"])).toBe(false);
  });
});

describe("clientDomainErrorMessage", () => {
  it("names each refusal without an em dash", () => {
    for (const error of ["empty", "invalid", "public_mailbox", "firm_domain"] as const) {
      expect(clientDomainErrorMessage(error)).not.toContain("\u2014");
    }
    expect(clientDomainErrorMessage("invalid")).toContain("acme.co.uk");
    expect(clientDomainErrorMessage("public_mailbox")).toMatch(/public mailbox/i);
    expect(clientDomainErrorMessage("firm_domain")).toContain("meritusvia.com");
  });
});
```

`src/lib/portal/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actorKindFromSignals, clientActorEmail, clientActorId, isClientRole } from "./roles";

describe("isClientRole", () => {
  it("is true only for the literal client role", () => {
    expect(isClientRole("client")).toBe(true);
    expect(isClientRole(undefined)).toBe(false);
    expect(isClientRole(null)).toBe(false);
    expect(isClientRole("")).toBe(false);
    expect(isClientRole("director")).toBe(false);
  });
});

describe("actorKindFromSignals", () => {
  it("treats the client role as a client whatever the email", () => {
    expect(actorKindFromSignals({ role: "client", email: "jane@firm.com", clientDomains: [] })).toBe("client");
  });

  it("treats a listed company domain as a client", () => {
    expect(actorKindFromSignals({ role: undefined, email: "jane@acme.co.uk", clientDomains: ["acme.co.uk"] })).toBe("client");
  });

  it("keeps meritusvia.com directors even if the domain is listed", () => {
    expect(actorKindFromSignals({ role: undefined, email: "mateo@meritusvia.com", clientDomains: ["meritusvia.com"] })).toBe("director");
  });

  it("is a director when nothing says client", () => {
    expect(actorKindFromSignals({ role: undefined, email: "william@meritusvia.com", clientDomains: ["acme.co.uk"] })).toBe("director");
    expect(actorKindFromSignals({ role: undefined, email: null, clientDomains: [] })).toBe("director");
  });
});

describe("client actor ids", () => {
  it("round-trips an email", () => {
    expect(clientActorId("jane@acme.co.uk")).toBe("client:jane@acme.co.uk");
    expect(clientActorEmail("client:jane@acme.co.uk")).toBe("jane@acme.co.uk");
  });

  it("is null for directors, the site and the system", () => {
    expect(clientActorEmail("user_wr")).toBeNull();
    expect(clientActorEmail("site")).toBeNull();
    expect(clientActorEmail("system")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/portal/domains.test.ts src/lib/portal/roles.test.ts`
Expected: FAIL, "Failed to resolve import ./domains" and "./roles".

- [ ] **Step 3: Write the modules**

`src/lib/portal/domains.ts`:

```ts
/**
 * Company email domains are the client membership list. A director lists
 * `acme.co.uk`; anyone whose work email is at that host can request a file
 * link on /access. Public mailboxes and meritusvia.com can never be listed.
 */

export const PUBLIC_MAILBOX_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
] as const;

export const FIRM_DOMAIN = "meritusvia.com";

export type DomainParseError = "empty" | "invalid" | "public_mailbox" | "firm_domain";
export type DomainParseResult = { ok: true; domain: string } | { ok: false; error: DomainParseError };

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;

/** Strip a leading @, lowercase, trim. `acme.co.uk` and `@acme.co.uk` are the same. */
export function normaliseDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

export function isPublicMailboxDomain(domain: string): boolean {
  return (PUBLIC_MAILBOX_DOMAINS as readonly string[]).includes(normaliseDomain(domain));
}

/** meritusvia.com and its subdomains belong to the directors. */
export function isFirmDomain(domain: string): boolean {
  const host = normaliseDomain(domain);
  return host === FIRM_DOMAIN || host.endsWith(`.${FIRM_DOMAIN}`);
}

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = normaliseDomain(trimmed.slice(at + 1));
  return domain || null;
}

/** A domain, an @domain or a full email all give the host a director would list. */
export function domainInput(raw: string): string {
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
  if (isFirmDomain(domain)) return { ok: false, error: "firm_domain" };
  return { ok: true, domain };
}

export function clientDomainErrorMessage(error: DomainParseError): string {
  switch (error) {
    case "empty":
      return "Enter a company domain";
    case "invalid":
      return "Enter a domain such as acme.co.uk";
    case "public_mailbox":
      return "Public mailbox domains cannot be listed";
    case "firm_domain":
      return "meritusvia.com is reserved for directors";
    default: {
      const exhaustive: never = error;
      return exhaustive;
    }
  }
}

export type WorkEmailError = "invalid" | "public_mailbox" | "firm_domain";
export type WorkEmailResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; error: WorkEmailError };

/** The address a visitor types on /access: lowercased, and refused unless it is a work address. */
export function parseWorkEmail(raw: string): WorkEmailResult {
  const email = raw.trim().toLowerCase();
  const domain = domainFromEmail(email);
  if (email.length > EMAIL_MAX || !EMAIL.test(email) || !domain || !HOSTNAME.test(domain)) {
    return { ok: false, error: "invalid" };
  }
  if (isPublicMailboxDomain(domain)) return { ok: false, error: "public_mailbox" };
  if (isFirmDomain(domain)) return { ok: false, error: "firm_domain" };
  return { ok: true, email, domain };
}

/** True when the email's host is on the list. meritusvia.com never matches. */
export function emailMatchesClientDomain(
  email: string | null | undefined,
  clientDomains: readonly string[]
): boolean {
  const domain = domainFromEmail(email);
  if (!domain || isFirmDomain(domain)) return false;
  return clientDomains.includes(domain);
}
```

`src/lib/portal/roles.ts`:

```ts
import { emailMatchesClientDomain } from "./domains";

export type ActorKind = "director" | "client";

/** Clerk public_metadata.role for users created by /access. Directors have no role. */
export const CLIENT_ROLE = "client";

/** Activity actor ids for client uploads: "client:jane@acme.co.uk". */
export const CLIENT_ACTOR_PREFIX = "client:";

export function isClientRole(role: unknown): boolean {
  return role === CLIENT_ROLE;
}

/**
 * Client when Clerk says so, or when the email host is a listed client domain
 * (so an old account can never turn into a director by accident). Otherwise a director.
 */
export function actorKindFromSignals(input: {
  role: unknown;
  email?: string | null;
  clientDomains: readonly string[];
}): ActorKind {
  if (isClientRole(input.role)) return "client";
  if (emailMatchesClientDomain(input.email, input.clientDomains)) return "client";
  return "director";
}

export function clientActorId(email: string): string {
  return `${CLIENT_ACTOR_PREFIX}${email.trim().toLowerCase()}`;
}

export function clientActorEmail(actorId: string): string | null {
  return actorId.startsWith(CLIENT_ACTOR_PREFIX) ? actorId.slice(CLIENT_ACTOR_PREFIX.length) : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/portal/domains.test.ts src/lib/portal/roles.test.ts && npx tsc --noEmit`
Expected: both files PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/domains.ts src/lib/portal/domains.test.ts src/lib/portal/roles.ts src/lib/portal/roles.test.ts
git commit -m "feat(portal): client domain and role helpers"
```

---

## Task 2: Schema, migration and database modules

**Files:**
- Modify: `src/lib/db/schema.ts` (the `documents` table and the uncommitted `clientDomains` sketch)
- Create: `drizzle/0003_client_domains.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `src/lib/db/client-domains.ts`
- Modify: `src/lib/db/documents.ts`, `src/lib/db/pursuits.ts`

**Interfaces (produces):**

```ts
// schema.ts
export const clientDomains: PgTable;           // id, domain (unique), pursuitId (not null, cascade), createdBy, createdAt
export type ClientDomain = typeof clientDomains.$inferSelect;
export type NewClientDomain = typeof clientDomains.$inferInsert;
// documents gains clientDomainId: string | null

// client-domains.ts
export type ClientDomainRow = ClientDomain & { firm: string; stage: PursuitStage; fileCount: number };
export async function listClientDomains(): Promise<ClientDomainRow[]>;
export async function listClientDomainNames(): Promise<string[]>;   // 60 s cache; [] without a database or on error
export async function getClientDomain(id: string): Promise<ClientDomain | null>;
export async function findClientDomainByName(domain: string): Promise<ClientDomain | null>;
export async function insertClientDomain(values: { domain: string; pursuitId: string; createdBy: string }): Promise<ClientDomain>;
export async function deleteClientDomain(id: string): Promise<boolean>;
export function __resetClientDomainCache(): void;

// documents.ts
export async function listClientDocuments(clientDomainId: string): Promise<DocumentRow[]>;

// pursuits.ts
export async function listPursuitsForClientAccess(): Promise<Pursuit[]>;  // every stage but declined, most recently updated first
```

No unit test hits the database in this repo (the `db/*.ts` modules are exercised through mocks in later tasks). This task is verified by `tsc`, by reading the SQL against the schema, and by `npm run db:migrate` when `DATABASE_URL` is set locally.

- [ ] **Step 1: Replace the schema sketch**

In `src/lib/db/schema.ts`, replace the `documents` table and the `clientDomains` sketch with:

```ts
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    scope: documentScopeEnum("scope").notNull(),
    pursuitId: text("pursuit_id").references(() => pursuits.id, { onDelete: "cascade" }),
    /** Set when a client uploaded the file through /client; cleared if the domain is removed. */
    clientDomainId: text("client_domain_id").references(() => clientDomains.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    extractedText: text("extracted_text"),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_client_domain_idx").on(t.clientDomainId)]
);

/**
 * Company email domains allowed to send files to a pursuit through /access.
 * One domain, one pursuit; deleting the pursuit ends the access.
 */
export const clientDomains = pgTable(
  "client_domains",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull().unique(),
    pursuitId: text("pursuit_id")
      .notNull()
      .references(() => pursuits.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_domains_pursuit_idx").on(t.pursuitId)]
);
```

Keep the `ClientDomain` and `NewClientDomain` type exports the sketch already added near `DocumentRow`.

- [ ] **Step 2: Write the migration and journal entry**

`drizzle/0003_client_domains.sql`:

```sql
CREATE TABLE "client_domains" (
  "id" text PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "pursuit_id" text NOT NULL REFERENCES "pursuits"("id") ON DELETE cascade,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "client_domains_domain_unique" ON "client_domains" ("domain");
--> statement-breakpoint
CREATE INDEX "client_domains_pursuit_idx" ON "client_domains" ("pursuit_id");
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "client_domain_id" text REFERENCES "client_domains"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "documents_client_domain_idx" ON "documents" ("client_domain_id");
```

Append to `entries` in `drizzle/meta/_journal.json`:

```json
    {
      "idx": 3,
      "version": "7",
      "when": 1789230000000,
      "tag": "0003_client_domains",
      "breakpoints": true
    }
```

- [ ] **Step 3: Write `src/lib/db/client-domains.ts`**

```ts
import { asc, eq, sql } from "drizzle-orm";
import { getDb, requireDb } from "./index";
import { clientDomains, documents, pursuits, type ClientDomain, type PursuitStage } from "./schema";

const NAME_CACHE_TTL_MS = 60 * 1000;

let nameCache: { names: string[]; expiresAt: number } | null = null;

export function __resetClientDomainCache(): void {
  nameCache = null;
}

export type ClientDomainRow = ClientDomain & { firm: string; stage: PursuitStage; fileCount: number };

/** Every listed domain with its pursuit and how many files have come in through it, by domain. */
export async function listClientDomains(): Promise<ClientDomainRow[]> {
  const db = requireDb();
  return db
    .select({
      id: clientDomains.id,
      domain: clientDomains.domain,
      pursuitId: clientDomains.pursuitId,
      createdBy: clientDomains.createdBy,
      createdAt: clientDomains.createdAt,
      firm: pursuits.firm,
      stage: pursuits.stage,
      fileCount: sql<number>`(select count(*) from ${documents} where ${documents.clientDomainId} = ${clientDomains.id})`.mapWith(Number),
    })
    .from(clientDomains)
    .innerJoin(pursuits, eq(pursuits.id, clientDomains.pursuitId))
    .orderBy(asc(clientDomains.domain));
}

/** Every listed host, held for a minute; empty without a database or when the read fails. */
export async function listClientDomainNames(): Promise<string[]> {
  if (nameCache && nameCache.expiresAt > Date.now()) return nameCache.names;
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select({ domain: clientDomains.domain }).from(clientDomains);
    const names = rows.map((row) => row.domain);
    nameCache = { names, expiresAt: Date.now() + NAME_CACHE_TTL_MS };
    return names;
  } catch {
    return [];
  }
}

export async function getClientDomain(id: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.id, id)).limit(1);
  return row ?? null;
}

export async function findClientDomainByName(domain: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.domain, domain)).limit(1);
  return row ?? null;
}

export async function insertClientDomain(values: {
  domain: string;
  pursuitId: string;
  createdBy: string;
}): Promise<ClientDomain> {
  const db = requireDb();
  const [row] = await db
    .insert(clientDomains)
    .values({ id: crypto.randomUUID(), ...values })
    .returning();
  __resetClientDomainCache();
  return row;
}

export async function deleteClientDomain(id: string): Promise<boolean> {
  const db = requireDb();
  const deleted = await db.delete(clientDomains).where(eq(clientDomains.id, id)).returning({ id: clientDomains.id });
  __resetClientDomainCache();
  return deleted.length > 0;
}
```

- [ ] **Step 4: Add the two list queries**

Append to `src/lib/db/documents.ts`:

```ts
/** Files that came in through /client for one listed domain, newest first. */
export async function listClientDocuments(clientDomainId: string): Promise<DocumentRow[]> {
  const db = requireDb();
  return db
    .select()
    .from(documents)
    .where(eq(documents.clientDomainId, clientDomainId))
    .orderBy(desc(documents.createdAt));
}
```

Append to `src/lib/db/pursuits.ts` (add `ne` to the `drizzle-orm` import on line 1):

```ts
/** Every pursuit a client domain may be attached to: everything not declined, most recently updated first. */
export async function listPursuitsForClientAccess(): Promise<Pursuit[]> {
  const db = requireDb();
  return db.select().from(pursuits).where(ne(pursuits.stage, "declined")).orderBy(desc(pursuits.updatedAt));
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; 411 + Task 1 tests pass. If `DATABASE_URL` is set in `.env.local`, also run `npm run db:migrate` and expect "migrate: migrations applied".

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0003_client_domains.sql drizzle/meta/_journal.json src/lib/db/client-domains.ts src/lib/db/documents.ts src/lib/db/pursuits.ts
git commit -m "feat(db): client_domains table and documents.client_domain_id"
```

---

## Task 3: Rate limit for /access

**Files:**
- Modify: `src/lib/db/throttle.ts`, `src/lib/db/throttle.test.ts`
- Modify: `src/lib/portal/intake.ts:174-177`, `src/lib/portal/intake.test.ts:229-238`

**Interfaces (produces):**

```ts
// throttle.ts
export const ACCESS_EMAIL_WINDOW_MS: number; // 24 h
export const ACCESS_EMAIL_CAP = 5;
export const ACCESS_IP_WINDOW_MS: number;    // 1 h
export const ACCESS_IP_CAP = 20;
export type AccessThrottleVerdict = { emailAllowed: boolean; ipAllowed: boolean };
export function decideAccessThrottle(counts: { email: number; ip: number }): AccessThrottleVerdict;
export async function registerAccessAttempt(keys: { email: string; ip: string }, now?: Date): Promise<AccessThrottleVerdict>;

// intake.ts
export type ThrottlePrefix = "email" | "ip" | "access-email" | "access-ip";
export function hashKey(prefix: ThrottlePrefix, value: string): string;
```

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/db/throttle.test.ts` (import `decideAccessThrottle`, `ACCESS_EMAIL_CAP`, `ACCESS_IP_CAP`):

```ts
describe("decideAccessThrottle", () => {
  it("allows a link request at the caps", () => {
    expect(decideAccessThrottle({ email: 5, ip: 20 })).toEqual({ emailAllowed: true, ipAllowed: true });
  });

  it("blocks the email one above its daily cap", () => {
    expect(decideAccessThrottle({ email: 6, ip: 1 }).emailAllowed).toBe(false);
  });

  it("blocks the address one above its hourly cap", () => {
    expect(decideAccessThrottle({ email: 1, ip: 21 }).ipAllowed).toBe(false);
  });

  it("fixes the caps at 5 and 20 and never mentions the alert cap", () => {
    expect(ACCESS_EMAIL_CAP).toBe(5);
    expect(ACCESS_IP_CAP).toBe(20);
    expect(Object.keys(decideAccessThrottle({ email: 1, ip: 1 }))).toEqual(["emailAllowed", "ipAllowed"]);
  });
});
```

Add to the `hashKey` block in `src/lib/portal/intake.test.ts`:

```ts
  it("keeps /access counters apart from the enquiry counters", () => {
    expect(hashKey("access-email", "jane@acme.co.uk")).toMatch(/^access-email:[0-9a-f]{64}$/);
    expect(hashKey("access-ip", "1.2.3.4")).toMatch(/^access-ip:[0-9a-f]{64}$/);
    expect(hashKey("access-email", "jane@acme.co.uk")).not.toBe(hashKey("email", "jane@acme.co.uk"));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/db/throttle.test.ts src/lib/portal/intake.test.ts`
Expected: FAIL on the missing export and on the prefix type.

- [ ] **Step 3: Implement**

In `src/lib/portal/intake.ts` replace the `hashKey` signature:

```ts
export type ThrottlePrefix = "email" | "ip" | "access-email" | "access-ip";

export function hashKey(prefix: ThrottlePrefix, value: string): string {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
  return `${prefix}:${digest}`;
}
```

Append to `src/lib/db/throttle.ts` after `registerEnquiryAttempt`:

```ts
export const ACCESS_EMAIL_WINDOW_MS = 24 * HOUR_MS;
export const ACCESS_EMAIL_CAP = 5;
export const ACCESS_IP_WINDOW_MS = HOUR_MS;
export const ACCESS_IP_CAP = 20;

export type AccessThrottleVerdict = { emailAllowed: boolean; ipAllowed: boolean };

export function decideAccessThrottle(counts: { email: number; ip: number }): AccessThrottleVerdict {
  return { emailAllowed: counts.email <= ACCESS_EMAIL_CAP, ipAllowed: counts.ip <= ACCESS_IP_CAP };
}

/**
 * Counts a /access link request against its hashed email and IP keys ("access-email:…",
 * "access-ip:…"). Separate keys, so probing /access never eats into the enquiry form's
 * counters, and there is no global cap: nothing here sends mail to the directors.
 */
export async function registerAccessAttempt(
  keys: { email: string; ip: string },
  now: Date = new Date()
): Promise<AccessThrottleVerdict> {
  const db = requireDb();
  const [emailRows, ipRows] = await db.batch([
    bump(keys.email, ACCESS_EMAIL_WINDOW_MS, now),
    bump(keys.ip, ACCESS_IP_WINDOW_MS, now),
  ]);
  return decideAccessThrottle({ email: emailRows[0]?.count ?? 1, ip: ipRows[0]?.count ?? 1 });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/db/throttle.test.ts src/lib/portal/intake.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/throttle.ts src/lib/db/throttle.test.ts src/lib/portal/intake.ts src/lib/portal/intake.test.ts
git commit -m "feat(access): rate limit keys and caps for link requests"
```

---

## Task 4: Actor resolution (directors and clients from Clerk)

**Files:**
- Modify: `src/lib/portal/director-helpers.ts` (add `primaryEmailOf`)
- Modify: `src/lib/portal/directors.ts` (whole module; keep every exported name it has today)
- Modify: `src/lib/portal/directors.test.ts`

**Interfaces:**
- Consumes: `actorKindFromSignals`, `ActorKind` (Task 1); `listClientDomainNames` (Task 2).
- Produces:

```ts
// director-helpers.ts
export function primaryEmailOf(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
}): string;   // lowercased primary email, else the first email, else ""

// directors.ts
export type Actor = { id: string; kind: ActorKind; email: string; name: string; initials: string };
/** "unknown": Clerk could not be reached and nothing cached mentions the id. null: Clerk says no such user. */
export type ActorLookup = Actor | null | "unknown";
export async function listDirectors(): Promise<Director[]>;   // kind === "director" only; last good list when Clerk fails
export async function getDirector(id: string | null | undefined): Promise<Director | null>;  // unchanged
export async function getActor(id: string | null | undefined): Promise<ActorLookup>;
export function __resetDirectorsCache(): void;
```

- [ ] **Step 1: Update the test file**

In `src/lib/portal/directors.test.ts`:

1. Replace the hoisted mock and the Clerk mock with:

```ts
const { getUserList, getUser, clerkClient, listClientDomainNames } = vi.hoisted(() => {
  const getUserList = vi.fn();
  const getUser = vi.fn();
  const clerkClient = vi.fn(async () => ({ users: { getUserList, getUser } }));
  const listClientDomainNames = vi.fn(async () => [] as string[]);
  return { getUserList, getUser, clerkClient, listClientDomainNames };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient }));
vi.mock("@/lib/db/client-domains", () => ({ listClientDomainNames }));
```

2. Add `getActor` and `primaryEmailOf` to the import from `./directors`, and give `clerkUser` an optional `publicMetadata?: Record<string, unknown>` override.

3. In `beforeEach` add `getUser.mockReset(); listClientDomainNames.mockResolvedValue([]);`.

4. Change the expectation in "maps Clerk users to directors" to `expect(getUserList).toHaveBeenCalledWith({ limit: 50, orderBy: "+created_at" });`.

5. Add these blocks:

```ts
const jane = clerkUser({
  id: "user_jane",
  firstName: "Jane",
  lastName: "Client",
  primaryEmailAddressId: "em_jane",
  emailAddresses: [{ id: "em_jane", emailAddress: "jane@acme.co.uk" }],
  publicMetadata: { role: "client", domain: "acme.co.uk" },
});

describe("listDirectors with clients", () => {
  it("leaves users with the client role out of the list", async () => {
    getUserList.mockResolvedValue({ data: [william, jane, mateo], totalCount: 3 });
    await expect(listDirectors()).resolves.toEqual([expectedMateo, expectedWilliam]);
  });

  it("leaves users whose email domain is listed out of the list", async () => {
    const legacy = clerkUser({
      id: "user_old",
      primaryEmailAddressId: "em_old",
      emailAddresses: [{ id: "em_old", emailAddress: "bob@acme.co.uk" }],
    });
    listClientDomainNames.mockResolvedValue(["acme.co.uk"]);
    getUserList.mockResolvedValue({ data: [william, legacy], totalCount: 2 });
    await expect(listDirectors()).resolves.toEqual([expectedWilliam]);
  });

  it("serves the last good list when Clerk fails after the cache has expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await listDirectors();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    getUserList.mockRejectedValueOnce(new Error("Clerk is down"));
    await expect(listDirectors()).resolves.toEqual([expectedMateo, expectedWilliam]);
  });
});

describe("getActor", () => {
  it("answers from the cached list without a second Clerk call", async () => {
    getUserList.mockResolvedValue({ data: [william, jane], totalCount: 2 });
    await expect(getActor("user_jane")).resolves.toMatchObject({ id: "user_jane", kind: "client", email: "jane@acme.co.uk" });
    await expect(getActor("user_wr")).resolves.toMatchObject({ id: "user_wr", kind: "director", name: "William Rogers", initials: "WR" });
    expect(getUserList).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("reads a user missing from the list once and caches the answer", async () => {
    getUser.mockResolvedValue(jane);
    await expect(getActor("user_jane")).resolves.toMatchObject({ kind: "client" });
    await expect(getActor("user_jane")).resolves.toMatchObject({ kind: "client" });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith("user_jane");
  });

  it("is null when Clerk has no such user", async () => {
    getUser.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    await expect(getActor("user_gone")).resolves.toBeNull();
  });

  it("serves the last good list when Clerk fails after the cache expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserList.mockResolvedValue({ data: [william, jane], totalCount: 2 });
    await getActor("user_jane");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    getUserList.mockRejectedValue(new Error("Clerk is down"));
    getUser.mockRejectedValue(new Error("Clerk is down"));
    await expect(getActor("user_jane")).resolves.toMatchObject({ kind: "client" });
  });

  it("is unknown when Clerk fails and nothing is cached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserList.mockRejectedValue(new Error("Clerk is down"));
    getUser.mockRejectedValue(new Error("Clerk is down"));
    await expect(getActor("user_jane")).resolves.toBe("unknown");
  });

  it("is unknown without calling Clerk when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;
    await expect(getActor("user_wr")).resolves.toBe("unknown");
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("is null for a missing id", async () => {
    await expect(getActor(null)).resolves.toBeNull();
  });
});

describe("primaryEmailOf", () => {
  it("prefers the primary address, lowercased, then the first address, then nothing", () => {
    expect(primaryEmailOf(william)).toBe("william@meritusvia.com");
    expect(primaryEmailOf(clerkUser({ id: "x", emailAddresses: [{ id: "a", emailAddress: "A@X.com" }] }))).toBe("a@x.com");
    expect(primaryEmailOf(clerkUser({ id: "y" }))).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/portal/directors.test.ts`
Expected: FAIL, `getActor` and `primaryEmailOf` are not exported; the `orderBy` expectation fails.

- [ ] **Step 3: Add `primaryEmailOf` to `director-helpers.ts`**

Append:

```ts
/** The user's primary email, else the first address on the account, lowercased; "" when there is none. */
export function primaryEmailOf(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
}): string {
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  const chosen = primary ?? user.emailAddresses[0];
  return chosen?.emailAddress.trim().toLowerCase() ?? "";
}
```

- [ ] **Step 4: Rewrite `directors.ts`**

Replace the whole file with:

```ts
/**
 * The Clerk application holds the three directors and, since /access, the
 * clients who have asked for a file link. There is no users table. The list
 * is read through the Clerk backend client, held in memory for five minutes,
 * and abandoned after eight seconds so a slow Clerk never holds up intake or
 * the desk. The last good list is kept past its expiry and served when Clerk
 * cannot be reached, so an outage never locks a director out.
 *
 * This module imports "@clerk/nextjs/server", which Next refuses to bundle for
 * the browser, so only server components, route handlers and server actions
 * may import it. Client components take the Director type, initialsFor,
 * directorInitials, directorName and the placeholders from "./director-helpers";
 * they are re-exported here so server code has a single import.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { listClientDomainNames } from "@/lib/db/client-domains";
import { isClerkConfigured } from "@/lib/env";
import { initialsFor, primaryEmailOf, type Director } from "./director-helpers";
import { actorKindFromSignals, type ActorKind } from "./roles";

export {
  UNASSIGNED_INITIALS,
  UNASSIGNED_NAME,
  directorInitials,
  directorName,
  initialsFor,
  primaryEmailOf,
  type Director,
} from "./director-helpers";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8 * 1000;
const PAGE_LIMIT = 50;

export type Actor = { id: string; kind: ActorKind; email: string; name: string; initials: string };

/** "unknown": Clerk could not be reached and nothing cached mentions the id. null: Clerk says no such user. */
export type ActorLookup = Actor | null | "unknown";

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
  publicMetadata?: Record<string, unknown> | null;
};

type ListCache = { actors: Actor[]; expiresAt: number };
type SingleCache = { actor: Actor | null; expiresAt: number };

const TIMED_OUT = Symbol("clerk timed out");
const FAILED = Symbol("clerk failed");

/** The last good list; consulted past its expiry when Clerk cannot answer. */
let listCache: ListCache | null = null;
/** Users read one at a time because they were not on the list (a client created seconds ago). */
const singles = new Map<string, SingleCache>();
let inFlight: Promise<Actor[] | typeof FAILED> | null = null;

function toActor(user: ClerkUserLike, clientDomains: readonly string[]): Actor {
  const email = primaryEmailOf(user);
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return {
    id: user.id,
    kind: actorKindFromSignals({ role: user.publicMetadata?.role, email, clientDomains }),
    email,
    name: name || email || "Director",
    initials: initialsFor({ firstName: user.firstName, lastName: user.lastName, email }),
  };
}

function toDirector(actor: Actor): Director {
  return { id: actor.id, name: actor.name, email: actor.email, initials: actor.initials };
}

function byName(a: Director, b: Director): number {
  return a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" });
}

async function loadClientDomains(): Promise<string[]> {
  try {
    return await listClientDomainNames();
  } catch {
    return [];
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

async function fetchActors(): Promise<Actor[]> {
  const client = await clerkClient();
  // Oldest first, so the directors (the first accounts) are always on the first page.
  const [{ data }, clientDomains] = await Promise.all([
    client.users.getUserList({ limit: PAGE_LIMIT, orderBy: "+created_at" }),
    loadClientDomains(),
  ]);
  return data.map((user) => toActor(user, clientDomains));
}

async function loadActors(): Promise<Actor[] | typeof FAILED> {
  try {
    const result = await withTimeout(fetchActors(), FETCH_TIMEOUT_MS);
    if (result === TIMED_OUT) {
      console.warn(`Directors: Clerk user list took longer than ${FETCH_TIMEOUT_MS} ms`);
      return FAILED;
    }
    listCache = { actors: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (error) {
    console.warn("Directors: Clerk user list unavailable", error);
    return FAILED;
  }
}

/** A fresh list, one request shared between concurrent callers; FAILED when Clerk did not answer. */
async function freshActors(): Promise<Actor[] | typeof FAILED> {
  if (listCache && listCache.expiresAt > Date.now()) return listCache.actors;
  if (!inFlight) {
    inFlight = loadActors().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Every director, sorted by name. Clients (role "client", or an email at a listed
 * domain) are left out. Empty when Clerk is not configured or has never answered;
 * the last good list when it fails now. A good answer is cached for five minutes.
 */
export async function listDirectors(): Promise<Director[]> {
  if (!isClerkConfigured()) return [];
  const fresh = await freshActors();
  const actors = fresh === FAILED ? (listCache?.actors ?? []) : fresh;
  return actors
    .filter((actor) => actor.kind === "director")
    .map(toDirector)
    .sort(byName);
}

export async function getDirector(id: string | null | undefined): Promise<Director | null> {
  if (!id) return null;
  const directors = await listDirectors();
  return directors.find((director) => director.id === id) ?? null;
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "status" in error && (error as { status?: unknown }).status === 404
  );
}

async function fetchActor(id: string): Promise<Actor | null | typeof FAILED> {
  try {
    const client = await clerkClient();
    const result = await withTimeout(client.users.getUser(id), FETCH_TIMEOUT_MS);
    if (result === TIMED_OUT) return FAILED;
    return toActor(result, await loadClientDomains());
  } catch (error) {
    if (isNotFound(error)) return null;
    console.warn(`Directors: Clerk user ${id} unavailable`, error);
    return FAILED;
  }
}

/**
 * Who a Clerk user id is: from the fresh list, else one direct read (cached five
 * minutes), else the last good list. "unknown" only when Clerk is unreachable and
 * no cache mentions the id; null when Clerk says the user no longer exists.
 */
export async function getActor(id: string | null | undefined): Promise<ActorLookup> {
  if (!id) return null;
  if (!isClerkConfigured()) return "unknown";
  const fresh = await freshActors();
  if (fresh !== FAILED) {
    const listed = fresh.find((actor) => actor.id === id);
    if (listed) return listed;
  }
  const single = singles.get(id);
  if (single && single.expiresAt > Date.now()) return single.actor;
  const fetched = await fetchActor(id);
  if (fetched !== FAILED) {
    singles.set(id, { actor: fetched, expiresAt: Date.now() + CACHE_TTL_MS });
    return fetched;
  }
  const stale = listCache?.actors.find((actor) => actor.id === id) ?? single?.actor ?? null;
  return stale ?? "unknown";
}

/** Test hook: forget every cached list and any request in flight. */
export function __resetDirectorsCache(): void {
  listCache = null;
  singles.clear();
  inFlight = null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/portal/directors.test.ts && npx tsc --noEmit`
Expected: every existing and new test PASS (the "is empty, and not cached, when Clerk throws" test still passes because there is no last good list on the first call); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portal/director-helpers.ts src/lib/portal/directors.ts src/lib/portal/directors.test.ts
git commit -m "feat(portal): resolve directors and clients from Clerk with a last-good cache"
```

---

## Task 5: Gates: directors only on the desk, clients only on the file desk

**Files:**
- Modify: `src/lib/portal/auth.ts`
- Create: `src/lib/portal/auth.test.ts`

**Interfaces:**
- Consumes: `getActor`, `ActorLookup` (Task 4); `findClientDomainByName`, `ClientDomain` (Task 2); `domainFromEmail` (Task 1).
- Produces:

```ts
export const DIRECTORS_ONLY = "This area is for directors only";
export const CLIENTS_ONLY = "This area is for clients";
export const ACCESS_REMOVED = "Your organisation's access has been removed";
export const UNVERIFIED = "Directors could not be verified. Try again in a minute";
export async function requirePortalUser(): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }>; // now 403 for clients, 503 for unknown
export async function requireActionUser(): Promise<ActionUser>;   // now { ok: false, error: DIRECTORS_ONLY | UNVERIFIED } for those
export type ClientContext =
  | { state: "setup" }
  | { state: "signed_out" }
  | { state: "unknown" }
  | { state: "director" }
  | { state: "unlisted"; email: string }
  | { state: "client"; userId: string; email: string; domain: ClientDomain };
export async function clientContext(): Promise<ClientContext>;
export type ClientUser = { userId: string; email: string; domain: ClientDomain };
export async function requireClientUser(): Promise<{ client: ClientUser; error?: undefined } | { client?: undefined; error: NextResponse }>;
```

- [ ] **Step 1: Write the failing tests**

`src/lib/portal/auth.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getActor: vi.fn(),
  findClientDomainByName: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("./directors", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/db/client-domains", () => ({ findClientDomainByName: mocks.findClientDomainByName }));

import {
  ACCESS_REMOVED,
  CLIENTS_ONLY,
  DIRECTORS_ONLY,
  UNVERIFIED,
  clientContext,
  requireActionUser,
  requireClientUser,
  requirePortalUser,
} from "./auth";

const director = { id: "user_wr", kind: "director", email: "william@meritusvia.com", name: "William Rogers", initials: "WR" };
const client = { id: "user_jane", kind: "client", email: "jane@acme.co.uk", name: "Jane Client", initials: "JC" };
const acme = { id: "cd1", domain: "acme.co.uk", pursuitId: "p1", createdBy: "user_wr", createdAt: new Date("2026-09-12T09:00:00Z") };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test");
  vi.stubEnv("DATABASE_URL", "postgres://test");
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_wr" });
  mocks.getActor.mockResolvedValue(director);
  mocks.findClientDomainByName.mockResolvedValue(acme);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requirePortalUser", () => {
  it("lets a director through", async () => {
    await expect(requirePortalUser()).resolves.toEqual({ userId: "user_wr" });
  });

  it("refuses a client with 403", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_jane" });
    mocks.getActor.mockResolvedValue(client);
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(403);
    await expect(result.error?.json()).resolves.toEqual({ error: DIRECTORS_ONLY });
  });

  it("fails closed with 503 when the role cannot be verified", async () => {
    mocks.getActor.mockResolvedValue("unknown");
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(503);
    await expect(result.error?.json()).resolves.toEqual({ error: UNVERIFIED });
  });

  it("treats a session for a deleted user as signed out", async () => {
    mocks.getActor.mockResolvedValue(null);
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(401);
  });

  it("still answers 401 when there is no session", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(401);
    expect(mocks.getActor).not.toHaveBeenCalled();
  });
});

describe("requireActionUser", () => {
  it("lets a director through", async () => {
    await expect(requireActionUser()).resolves.toEqual({ ok: true, userId: "user_wr" });
  });

  it("refuses a client and an unverified session with plain results", async () => {
    mocks.getActor.mockResolvedValueOnce(client);
    await expect(requireActionUser()).resolves.toEqual({ ok: false, error: DIRECTORS_ONLY });
    mocks.getActor.mockResolvedValueOnce("unknown");
    await expect(requireActionUser()).resolves.toEqual({ ok: false, error: UNVERIFIED });
  });
});

describe("clientContext", () => {
  it("is setup when Clerk or the database is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(clientContext()).resolves.toEqual({ state: "setup" });
  });

  it("is signed_out without a session", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(clientContext()).resolves.toEqual({ state: "signed_out" });
  });

  it("is director for a director", async () => {
    await expect(clientContext()).resolves.toEqual({ state: "director" });
  });

  it("is unknown when Clerk cannot say", async () => {
    mocks.getActor.mockResolvedValue("unknown");
    await expect(clientContext()).resolves.toEqual({ state: "unknown" });
  });

  it("is client with the listed domain", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_jane" });
    mocks.getActor.mockResolvedValue(client);
    await expect(clientContext()).resolves.toEqual({ state: "client", userId: "user_jane", email: "jane@acme.co.uk", domain: acme });
    expect(mocks.findClientDomainByName).toHaveBeenCalledWith("acme.co.uk");
  });

  it("is unlisted once the domain has been removed", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_jane" });
    mocks.getActor.mockResolvedValue(client);
    mocks.findClientDomainByName.mockResolvedValue(null);
    await expect(clientContext()).resolves.toEqual({ state: "unlisted", email: "jane@acme.co.uk" });
  });
});

describe("requireClientUser", () => {
  it("returns the client", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_jane" });
    mocks.getActor.mockResolvedValue(client);
    await expect(requireClientUser()).resolves.toEqual({ client: { userId: "user_jane", email: "jane@acme.co.uk", domain: acme } });
  });

  it("maps each other state to a response", async () => {
    const cases: Array<[Parameters<typeof mocks.getActor.mockResolvedValue>[0], number, string]> = [
      [director, 403, CLIENTS_ONLY],
      ["unknown", 503, UNVERIFIED],
    ];
    for (const [actor, status, error] of cases) {
      mocks.getActor.mockResolvedValue(actor);
      const result = await requireClientUser();
      expect(result.error?.status).toBe(status);
      await expect(result.error?.json()).resolves.toEqual({ error });
    }
    mocks.auth.mockResolvedValue({ userId: "user_jane" });
    mocks.getActor.mockResolvedValue(client);
    mocks.findClientDomainByName.mockResolvedValue(null);
    const removed = await requireClientUser();
    expect(removed.error?.status).toBe(403);
    await expect(removed.error?.json()).resolves.toEqual({ error: ACCESS_REMOVED });
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await requireClientUser()).error?.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/portal/auth.test.ts`
Expected: FAIL, the new exports are missing and the client case returns `{ userId }`.

- [ ] **Step 3: Rewrite `auth.ts`**

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findClientDomainByName } from "@/lib/db/client-domains";
import type { ClientDomain } from "@/lib/db/schema";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { getActor } from "./directors";
import { domainFromEmail } from "./domains";

export const DIRECTORS_ONLY = "This area is for directors only";
export const CLIENTS_ONLY = "This area is for clients";
export const ACCESS_REMOVED = "Your organisation's access has been removed";
export const UNVERIFIED = "Directors could not be verified. Try again in a minute";

function json(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * The route-handler gate for /api/portal/*: the signed-in director's id, or the response
 * that explains why not. Clients get 403. When Clerk cannot say who the session belongs
 * to, the desk fails closed with 503 rather than admit an unknown session.
 */
export async function requirePortalUser(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return {
      error: NextResponse.json({ error: "Clerk is not configured", code: "SETUP" }, { status: 503 }),
    };
  }

  const { userId } = await auth();
  if (!userId) return { error: json("Unauthorized", 401) };

  const actor = await getActor(userId);
  if (actor === "unknown") return { error: json(UNVERIFIED, 503) };
  if (actor === null) return { error: json("Unauthorized", 401) };
  if (actor.kind === "client") return { error: json(DIRECTORS_ONLY, 403) };
  return { userId };
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
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in again" };
  }
  const actor = await getActor(userId);
  if (actor === "unknown") return { ok: false, error: UNVERIFIED };
  if (actor === null) return { ok: false, error: "Sign in again" };
  if (actor.kind === "client") return { ok: false, error: DIRECTORS_ONLY };
  return { ok: true, userId };
}

export type ClientContext =
  | { state: "setup" }
  | { state: "signed_out" }
  | { state: "unknown" }
  | { state: "director" }
  | { state: "unlisted"; email: string }
  | { state: "client"; userId: string; email: string; domain: ClientDomain };

/**
 * Who is on the client file desk. The domain is looked up on every call, so removing a
 * domain ends access at the client's next request even with a live session.
 */
export async function clientContext(): Promise<ClientContext> {
  if (!isClerkConfigured() || !isDatabaseConfigured()) return { state: "setup" };
  const { userId } = await auth();
  if (!userId) return { state: "signed_out" };
  const actor = await getActor(userId);
  if (actor === "unknown") return { state: "unknown" };
  if (actor === null) return { state: "signed_out" };
  if (actor.kind === "director") return { state: "director" };
  const host = domainFromEmail(actor.email);
  const domain = host ? await findClientDomainByName(host) : null;
  if (!domain) return { state: "unlisted", email: actor.email };
  return { state: "client", userId, email: actor.email, domain };
}

export type ClientUser = { userId: string; email: string; domain: ClientDomain };

/** The route-handler gate for /api/client/*: the client, or the response that explains why not. */
export async function requireClientUser(): Promise<
  { client: ClientUser; error?: undefined } | { client?: undefined; error: NextResponse }
> {
  const context = await clientContext();
  switch (context.state) {
    case "setup":
      return { error: setupResponse("Client access is not configured") };
    case "signed_out":
      return { error: json("Unauthorized", 401) };
    case "unknown":
      return { error: json(UNVERIFIED, 503) };
    case "director":
      return { error: json(CLIENTS_ONLY, 403) };
    case "unlisted":
      return { error: json(ACCESS_REMOVED, 403) };
    case "client":
      return { client: { userId: context.userId, email: context.email, domain: context.domain } };
    default: {
      const exhaustive: never = context;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/portal/auth.test.ts src/app/api && npx tsc --noEmit`
Expected: PASS (the existing pursuit documents route test mocks `requirePortalUser` and keeps passing); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/auth.ts src/lib/portal/auth.test.ts
git commit -m "feat(portal): role-aware gates and the client desk context"
```

---

## Task 6: Middleware areas

**Files:**
- Create: `src/lib/portal/gate.ts`, `src/lib/portal/gate.test.ts`
- Modify: `src/middleware.ts`

**Interfaces (produces):**

```ts
export type Area = "portal" | "client" | "public";
export function areaFor(pathname: string): Area;
export function signInPathFor(area: "portal" | "client"): "/sign-in" | "/access";
```

The middleware does no role work (no database, no Clerk backend call at the edge). It only decides that `/portal` and `/api/portal` need a session and send anonymous visitors to `/sign-in`, and that `/client` and `/api/client` need a session and send them to `/access`. Roles are enforced by Task 5's gates at every entry point and by the two layouts.

- [ ] **Step 1: Write the failing test**

`src/lib/portal/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { areaFor, signInPathFor } from "./gate";

describe("areaFor", () => {
  it("puts the desk and its api in the portal area", () => {
    for (const path of ["/portal", "/portal/", "/portal/clients", "/portal/pursuits/p1", "/api/portal", "/api/portal/library"]) {
      expect(areaFor(path)).toBe("portal");
    }
  });

  it("puts the file desk and its api in the client area", () => {
    for (const path of ["/client", "/client/", "/api/client", "/api/client/documents", "/api/client/documents/d1"]) {
      expect(areaFor(path)).toBe("client");
    }
  });

  it("leaves everything else public, including /access and look-alike prefixes", () => {
    for (const path of ["/", "/contact", "/access", "/access/continue", "/api/access", "/api/contact", "/sign-in", "/clients", "/portalx", "/api/portalx"]) {
      expect(areaFor(path)).toBe("public");
    }
  });
});

describe("signInPathFor", () => {
  it("sends directors to /sign-in and clients to /access", () => {
    expect(signInPathFor("portal")).toBe("/sign-in");
    expect(signInPathFor("client")).toBe("/access");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/portal/gate.test.ts`
Expected: FAIL, "Failed to resolve import ./gate".

- [ ] **Step 3: Write `gate.ts` and update the middleware**

`src/lib/portal/gate.ts`:

```ts
/** Which signed-in area a path belongs to. Pure, so the middleware's routing can be tested. */
export type Area = "portal" | "client" | "public";

function under(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function areaFor(pathname: string): Area {
  if (under(pathname, "/portal") || under(pathname, "/api/portal")) return "portal";
  if (under(pathname, "/client") || under(pathname, "/api/client")) return "client";
  return "public";
}

/** Where an anonymous visitor to a signed-in area is sent. */
export function signInPathFor(area: "portal" | "client"): "/sign-in" | "/access" {
  return area === "portal" ? "/sign-in" : "/access";
}
```

`src/middleware.ts`:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { areaFor, signInPathFor } from "@/lib/portal/gate";

/**
 * Sessions only. Directors' pages send anonymous visitors to /sign-in, the client file
 * desk sends them to /access. Who may do what once signed in is decided by the gates in
 * src/lib/portal/auth.ts and by the two layouts, never here.
 */
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const area = areaFor(req.nextUrl.pathname);
  if (area === "public") return;
  await auth.protect({ unauthenticatedUrl: new URL(signInPathFor(area), req.url).toString() });
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/portal/gate.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/gate.ts src/lib/portal/gate.test.ts src/middleware.ts
git commit -m "feat(auth): client area in the middleware"
```

---

## Task 7: The access email

**Files:**
- Create: `src/lib/access/mail.ts`, `src/lib/access/mail.test.ts`

**Interfaces:**
- Consumes: `ALERT_TIMEOUT_MS`, `alertFrom` from `src/lib/portal/alerts.ts`; `SITE_CONFIG.url` from `src/lib/constants.ts`; `isResendConfigured` from `src/lib/env.ts`.
- Produces:

```ts
export const ACCESS_LINK_MINUTES = 60;
export const ACCESS_LINK_SECONDS = 3600;
export const ACCESS_MAIL_SUBJECT = "Your Meritus file link";
export type AccessMailOutcome = { sentAt: string } | { error: string } | { skipped: "not_configured" };
export function accessLinkUrl(token: string): string;        // `${SITE_CONFIG.url}/access/continue?ticket=${encodeURIComponent(token)}`
export function accessMailText(url: string, minutes?: number): string;
export async function sendAccessLink(to: string, url: string): Promise<AccessMailOutcome>;
```

- [ ] **Step 1: Write the failing test**

`src/lib/access/mail.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { ALERT_TIMEOUT_MS } from "@/lib/portal/alerts";
import {
  ACCESS_LINK_MINUTES,
  ACCESS_LINK_SECONDS,
  ACCESS_MAIL_SUBJECT,
  accessLinkUrl,
  accessMailText,
  sendAccessLink,
} from "./mail";

const url = "https://meritusvia.com/access/continue?ticket=tok_1";

describe("accessLinkUrl", () => {
  it("points at /access/continue on the site with the token escaped", () => {
    expect(accessLinkUrl("tok 1/2")).toBe("https://meritusvia.com/access/continue?ticket=tok%201%2F2");
  });
});

describe("accessMailText", () => {
  it("carries the link, the life of the link and nothing else personal", () => {
    const text = accessMailText(url);
    expect(text).toContain(url);
    expect(text).toContain("60 minutes");
    expect(text).toContain("works once");
    expect(text).not.toContain("\u2014");
    expect(ACCESS_LINK_MINUTES).toBe(60);
    expect(ACCESS_LINK_SECONDS).toBe(3600);
  });
});

describe("sendAccessLink", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ENQUIRY_ALERT_FROM", "");
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("is skipped when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendAccessLink("jane@acme.co.uk", url)).resolves.toEqual({ skipped: "not_configured" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends one plain-text email from the enquiries sender with the subject and link", async () => {
    const outcome = await sendAccessLink("jane@acme.co.uk", url);
    expect("sentAt" in outcome).toBe(true);
    const [payload, options] = send.mock.calls[0];
    expect(payload.from).toBe("enquiries@meritusvia.com");
    expect(payload.to).toEqual(["jane@acme.co.uk"]);
    expect(payload.subject).toBe(ACCESS_MAIL_SUBJECT);
    expect(payload.html).toBeUndefined();
    expect(payload.text).toContain(url);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses ENQUIRY_ALERT_FROM when it is set", async () => {
    vi.stubEnv("ENQUIRY_ALERT_FROM", "desk@meritusvia.com");
    await sendAccessLink("jane@acme.co.uk", url);
    expect(send.mock.calls[0][0].from).toBe("desk@meritusvia.com");
  });

  it("returns the Resend error rather than throwing", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Not verified", statusCode: 403 } });
    await expect(sendAccessLink("jane@acme.co.uk", url)).resolves.toEqual({ error: "validation_error: Not verified" });
  });

  it("returns an error when the client throws", async () => {
    send.mockRejectedValue(new Error("socket hang up"));
    await expect(sendAccessLink("jane@acme.co.uk", url)).resolves.toEqual({ error: "socket hang up" });
  });

  it("gives up after the alert timeout", async () => {
    vi.useFakeTimers();
    send.mockReturnValue(new Promise(() => {}));
    const pending = sendAccessLink("jane@acme.co.uk", url);
    await vi.advanceTimersByTimeAsync(ALERT_TIMEOUT_MS + 1);
    await expect(pending).resolves.toMatchObject({ error: expect.stringMatching(/timed out/i) });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/access/mail.test.ts`
Expected: FAIL, "Failed to resolve import ./mail".

- [ ] **Step 3: Write `mail.ts`**

```ts
import { Resend, type CreateEmailRequestOptions } from "resend";
import { SITE_CONFIG } from "@/lib/constants";
import { isResendConfigured } from "@/lib/env";
import { ALERT_TIMEOUT_MS, alertFrom } from "@/lib/portal/alerts";

/*
 * The second use of the Resend sender that already carries enquiry alerts. Same from
 * address, same eight-second timeout, same never-throw contract. Plain text only.
 */

export const ACCESS_LINK_MINUTES = 60;
export const ACCESS_LINK_SECONDS = ACCESS_LINK_MINUTES * 60;
export const ACCESS_MAIL_SUBJECT = "Your Meritus file link";

export type AccessMailOutcome = { sentAt: string } | { error: string } | { skipped: "not_configured" };

export function accessLinkUrl(token: string): string {
  return `${SITE_CONFIG.url}/access/continue?ticket=${encodeURIComponent(token)}`;
}

export function accessMailText(url: string, minutes: number = ACCESS_LINK_MINUTES): string {
  return [
    "Open this link to send files to Meritus Via:",
    "",
    url,
    "",
    `It works once and expires in ${minutes} minutes. If you did not ask for it, ignore this email.`,
    "",
    "Meritus Via",
  ].join("\n");
}

/** Sends the link. Never throws; the caller turns any non-success into the visitor's message. */
export async function sendAccessLink(to: string, url: string): Promise<AccessMailOutcome> {
  if (!isResendConfigured()) return { skipped: "not_configured" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AccessMailOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` }),
      ALERT_TIMEOUT_MS
    );
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // The SDK spreads request options into fetch, so the signal cancels the request even though its types omit it.
    const options = { signal: AbortSignal.timeout(ALERT_TIMEOUT_MS) } as CreateEmailRequestOptions;
    const request = resend.emails
      .send({ from: alertFrom(), to: [to], subject: ACCESS_MAIL_SUBJECT, text: accessMailText(url) }, options)
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/access/mail.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/mail.ts src/lib/access/mail.test.ts
git commit -m "feat(access): Resend file-link email"
```

---

## Task 8: The access request

**Files:**
- Create: `src/lib/access/request.ts`, `src/lib/access/request.test.ts`

**Interfaces:**
- Consumes: `parseWorkEmail` (Task 1); `CLIENT_ROLE`, `isClientRole` (Task 1); `findClientDomainByName` (Task 2); `registerAccessAttempt`, `hashKey` (Task 3); `primaryEmailOf` (Task 4); `ACCESS_LINK_SECONDS`, `accessLinkUrl`, `sendAccessLink` (Task 7).
- Produces:

```ts
export const ACCESS_MESSAGES: Record<
  "invalid" | "public_mailbox" | "firm_domain" | "not_configured" | "throttled" | "not_listed" | "no_email" | "director_account" | "not_sent",
  string
>;
export type AccessRequestResult =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 403 | 429 | 502 | 503; error: string };
export async function requestAccessLink(input: { email: string; ip: string; now?: Date }): Promise<AccessRequestResult>;
```

- [ ] **Step 1: Write the failing test**

`src/lib/access/request.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserList: vi.fn(),
  createUser: vi.fn(),
  createSignInToken: vi.fn(),
  revokeSignInToken: vi.fn(),
  findClientDomainByName: vi.fn(),
  registerAccessAttempt: vi.fn(),
  sendAccessLink: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: { getUserList: mocks.getUserList, createUser: mocks.createUser },
    signInTokens: { createSignInToken: mocks.createSignInToken, revokeSignInToken: mocks.revokeSignInToken },
  })),
}));
vi.mock("@/lib/db/client-domains", () => ({ findClientDomainByName: mocks.findClientDomainByName }));
vi.mock("@/lib/db/throttle", () => ({ registerAccessAttempt: mocks.registerAccessAttempt }));
vi.mock("./mail", async () => {
  const actual = await vi.importActual<typeof import("./mail")>("./mail");
  return { ...actual, sendAccessLink: mocks.sendAccessLink };
});

import { ACCESS_MESSAGES, requestAccessLink } from "./request";

const acme = { id: "cd1", domain: "acme.co.uk", pursuitId: "p1", createdBy: "user_wr", createdAt: new Date() };
const jane = {
  id: "user_jane",
  primaryEmailAddressId: "em_1",
  emailAddresses: [{ id: "em_1", emailAddress: "jane@acme.co.uk" }],
  publicMetadata: { role: "client" },
};

function ask(email = "Jane@Acme.co.uk") {
  return requestAccessLink({ email, ip: "1.2.3.4", now: new Date("2026-09-12T10:00:00Z") });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test");
  vi.stubEnv("DATABASE_URL", "postgres://test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.registerAccessAttempt.mockResolvedValue({ emailAllowed: true, ipAllowed: true });
  mocks.findClientDomainByName.mockResolvedValue(acme);
  mocks.getUserList.mockResolvedValue({ data: [], totalCount: 0 });
  mocks.createUser.mockResolvedValue({ id: "user_new" });
  mocks.createSignInToken.mockResolvedValue({ id: "sit_1", token: "tok_1" });
  mocks.revokeSignInToken.mockResolvedValue({ id: "sit_1" });
  mocks.sendAccessLink.mockResolvedValue({ sentAt: "2026-09-12T10:00:01Z" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requestAccessLink", () => {
  it("creates a passwordless client user, mints a one-hour token and emails the link", async () => {
    await expect(ask()).resolves.toEqual({ ok: true, email: "jane@acme.co.uk" });
    expect(mocks.getUserList).toHaveBeenCalledWith({ emailAddress: ["jane@acme.co.uk"], limit: 10 });
    expect(mocks.createUser).toHaveBeenCalledWith({
      emailAddress: ["jane@acme.co.uk"],
      skipPasswordRequirement: true,
      publicMetadata: { role: "client", domain: "acme.co.uk" },
    });
    expect(mocks.createSignInToken).toHaveBeenCalledWith({ userId: "user_new", expiresInSeconds: 3600 });
    expect(mocks.sendAccessLink).toHaveBeenCalledWith(
      "jane@acme.co.uk",
      "https://meritusvia.com/access/continue?ticket=tok_1"
    );
    expect(mocks.revokeSignInToken).not.toHaveBeenCalled();
  });

  it("reuses an existing client user without creating another", async () => {
    mocks.getUserList.mockResolvedValue({ data: [jane], totalCount: 1 });
    await expect(ask()).resolves.toEqual({ ok: true, email: "jane@acme.co.uk" });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createSignInToken).toHaveBeenCalledWith({ userId: "user_jane", expiresInSeconds: 3600 });
  });

  it("ignores a partial email match from Clerk", async () => {
    mocks.getUserList.mockResolvedValue({
      data: [{ ...jane, id: "user_other", emailAddresses: [{ id: "em_1", emailAddress: "jane@acme.co.uk.example" }] }],
      totalCount: 1,
    });
    await ask();
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });

  it("refuses a malformed address, a public mailbox and the firm domain before touching anything", async () => {
    await expect(ask("jane")).resolves.toEqual({ ok: false, status: 400, error: ACCESS_MESSAGES.invalid });
    await expect(ask("jane@gmail.com")).resolves.toEqual({ ok: false, status: 400, error: ACCESS_MESSAGES.public_mailbox });
    await expect(ask("william@meritusvia.com")).resolves.toEqual({ ok: false, status: 403, error: ACCESS_MESSAGES.firm_domain });
    expect(mocks.registerAccessAttempt).not.toHaveBeenCalled();
    expect(mocks.findClientDomainByName).not.toHaveBeenCalled();
  });

  it("is 503 when Clerk or the database is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(ask()).resolves.toEqual({ ok: false, status: 503, error: ACCESS_MESSAGES.not_configured });
  });

  it("is 429 over either cap and counts with access keys", async () => {
    mocks.registerAccessAttempt.mockResolvedValue({ emailAllowed: false, ipAllowed: true });
    await expect(ask()).resolves.toEqual({ ok: false, status: 429, error: ACCESS_MESSAGES.throttled });
    const [keys] = mocks.registerAccessAttempt.mock.calls[0];
    expect(keys.email).toMatch(/^access-email:/);
    expect(keys.ip).toMatch(/^access-ip:/);
    expect(mocks.findClientDomainByName).not.toHaveBeenCalled();
  });

  it("carries on when the throttle store is unavailable", async () => {
    mocks.registerAccessAttempt.mockRejectedValue(new Error("db down"));
    await expect(ask()).resolves.toEqual({ ok: true, email: "jane@acme.co.uk" });
  });

  it("is honest when the domain is not listed", async () => {
    mocks.findClientDomainByName.mockResolvedValue(null);
    await expect(ask()).resolves.toEqual({ ok: false, status: 403, error: ACCESS_MESSAGES.not_listed });
    expect(mocks.getUserList).not.toHaveBeenCalled();
  });

  it("refuses clearly when Resend is unset and creates nothing in Clerk", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(ask()).resolves.toEqual({ ok: false, status: 503, error: ACCESS_MESSAGES.no_email });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createSignInToken).not.toHaveBeenCalled();
  });

  it("never mints a token for an account that is not a client", async () => {
    mocks.getUserList.mockResolvedValue({ data: [{ ...jane, publicMetadata: {} }], totalCount: 1 });
    await expect(ask()).resolves.toEqual({ ok: false, status: 403, error: ACCESS_MESSAGES.director_account });
    expect(mocks.createSignInToken).not.toHaveBeenCalled();
  });

  it("revokes the token and reports 502 when the email does not go", async () => {
    mocks.sendAccessLink.mockResolvedValue({ error: "socket hang up" });
    await expect(ask()).resolves.toEqual({ ok: false, status: 502, error: ACCESS_MESSAGES.not_sent });
    expect(mocks.revokeSignInToken).toHaveBeenCalledWith("sit_1");
  });

  it("reports 502 when Clerk fails, without leaking the reason", async () => {
    mocks.createUser.mockRejectedValue(new Error("clerk exploded"));
    await expect(ask()).resolves.toEqual({ ok: false, status: 502, error: ACCESS_MESSAGES.not_sent });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/access/request.test.ts`
Expected: FAIL, "Failed to resolve import ./request".

- [ ] **Step 3: Write `request.ts`**

```ts
import { clerkClient } from "@clerk/nextjs/server";
import { findClientDomainByName } from "@/lib/db/client-domains";
import { registerAccessAttempt } from "@/lib/db/throttle";
import { isClerkConfigured, isDatabaseConfigured, isResendConfigured } from "@/lib/env";
import { primaryEmailOf } from "@/lib/portal/director-helpers";
import { parseWorkEmail } from "@/lib/portal/domains";
import { hashKey } from "@/lib/portal/intake";
import { CLIENT_ROLE, isClientRole } from "@/lib/portal/roles";
import { ACCESS_LINK_SECONDS, accessLinkUrl, sendAccessLink } from "./mail";

/*
 * One visitor, one work email, one link. The order matters: cheap refusals first, then
 * the rate limit, then the domain list (honest about an unlisted organisation), then
 * Resend's presence (so nothing is created in Clerk that can never be reached), then
 * Clerk. A token whose email did not go is revoked so it cannot be found later.
 */

export const ACCESS_MESSAGES = {
  invalid: "Enter your work email",
  public_mailbox: "Use your work email address, not a personal mailbox",
  firm_domain: "Directors sign in at meritusvia.com/sign-in",
  not_configured: "Client access is not configured yet",
  throttled: "Too many requests. Try again later",
  not_listed:
    "That organisation has not been given access yet. Ask your Meritus contact to add your company's email domain",
  no_email: "Email is not configured. Ask Meritus to enable client access",
  director_account: "This address belongs to a director account. Sign in at meritusvia.com/sign-in",
  not_sent: "We could not send the link. Try again in a few minutes",
} as const;

export type AccessRequestResult =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 403 | 429 | 502 | 503; error: string };

function refuse(status: 400 | 403 | 429 | 502 | 503, error: string): AccessRequestResult {
  return { ok: false, status, error };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function requestAccessLink(input: {
  email: string;
  ip: string;
  now?: Date;
}): Promise<AccessRequestResult> {
  const parsed = parseWorkEmail(input.email);
  if (!parsed.ok) {
    if (parsed.error === "firm_domain") return refuse(403, ACCESS_MESSAGES.firm_domain);
    return refuse(400, ACCESS_MESSAGES[parsed.error]);
  }
  const { email, domain } = parsed;
  const now = input.now ?? new Date();

  if (!isClerkConfigured() || !isDatabaseConfigured()) return refuse(503, ACCESS_MESSAGES.not_configured);

  try {
    const verdict = await registerAccessAttempt(
      { email: hashKey("access-email", email), ip: hashKey("access-ip", input.ip) },
      now
    );
    if (!verdict.emailAllowed || !verdict.ipAllowed) return refuse(429, ACCESS_MESSAGES.throttled);
  } catch (err) {
    // A broken counter must not stop a genuine client; the domain list still decides.
    console.error("[access] throttle unavailable", { domain, error: message(err) });
  }

  const listed = await findClientDomainByName(domain);
  if (!listed) return refuse(403, ACCESS_MESSAGES.not_listed);
  if (!isResendConfigured()) return refuse(503, ACCESS_MESSAGES.no_email);

  let client: Awaited<ReturnType<typeof clerkClient>>;
  let userId: string;
  try {
    client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 10 });
    const existing = data.find((user) => primaryEmailOf(user) === email);
    if (existing && !isClientRole(existing.publicMetadata?.role)) {
      return refuse(403, ACCESS_MESSAGES.director_account);
    }
    if (existing) {
      userId = existing.id;
    } else {
      const created = await client.users.createUser({
        emailAddress: [email],
        skipPasswordRequirement: true,
        publicMetadata: { role: CLIENT_ROLE, domain },
      });
      userId = created.id;
    }
  } catch (err) {
    console.error("[access] Clerk user lookup failed", { domain, error: message(err) });
    return refuse(502, ACCESS_MESSAGES.not_sent);
  }

  let token: { id: string; token: string };
  try {
    token = await client.signInTokens.createSignInToken({ userId, expiresInSeconds: ACCESS_LINK_SECONDS });
  } catch (err) {
    console.error("[access] sign-in token failed", { domain, error: message(err) });
    return refuse(502, ACCESS_MESSAGES.not_sent);
  }

  const outcome = await sendAccessLink(email, accessLinkUrl(token.token));
  if (!("sentAt" in outcome)) {
    console.error("[access] link not sent", { domain, error: "error" in outcome ? outcome.error : "Resend not configured" });
    try {
      await client.signInTokens.revokeSignInToken(token.id);
    } catch {
      // The token expires on its own within the hour.
    }
    return refuse(502, ACCESS_MESSAGES.not_sent);
  }

  return { ok: true, email };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/access/request.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean. If tsc complains that `publicMetadata.role` is not on `UserPublicMetadata`, read it as `(existing.publicMetadata as Record<string, unknown> | undefined)?.role`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access/request.ts src/lib/access/request.test.ts
git commit -m "feat(access): create the client user, mint a sign-in token and send the link"
```

---

## Task 9: `POST /api/access`

**Files:**
- Create: `src/app/api/access/route.ts`, `src/app/api/access/route.test.ts`

**Interfaces:**
- Consumes: `requestAccessLink`, `AccessRequestResult` (Task 8); `firstHop` from `src/lib/portal/intake.ts`.
- Produces: `POST /api/access` with JSON `{ email }`; `200 { ok: true, email }` or `{ error }` with the status from the result.

- [ ] **Step 1: Write the failing test**

`src/app/api/access/route.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestAccessLink: vi.fn() }));

vi.mock("@/lib/access/request", () => ({ requestAccessLink: mocks.requestAccessLink }));

import { POST } from "./route";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestAccessLink.mockResolvedValue({ ok: true, email: "jane@acme.co.uk" });
});

describe("POST /api/access", () => {
  it("passes the email and the first forwarded hop to the request", async () => {
    const response = await POST(post({ email: "Jane@Acme.co.uk" }, { "x-forwarded-for": "9.9.9.9, 10.0.0.1" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, email: "jane@acme.co.uk" });
    expect(mocks.requestAccessLink).toHaveBeenCalledWith({ email: "Jane@Acme.co.uk", ip: "9.9.9.9" });
  });

  it("maps a refusal to its status and message", async () => {
    mocks.requestAccessLink.mockResolvedValue({ ok: false, status: 429, error: "Too many requests. Try again later" });
    const response = await POST(post({ email: "jane@acme.co.uk" }));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Too many requests. Try again later" });
  });

  it("answers 400 to a body that is not JSON or has no email string", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ email: 42 }))).status).toBe(400);
    expect(mocks.requestAccessLink).not.toHaveBeenCalled();
  });

  it("uses unknown as the address when there is no forwarded header", async () => {
    await POST(post({ email: "jane@acme.co.uk" }));
    expect(mocks.requestAccessLink).toHaveBeenCalledWith({ email: "jane@acme.co.uk", ip: "unknown" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/api/access/route.test.ts`
Expected: FAIL, "Failed to resolve import ./route".

- [ ] **Step 3: Write the route**

`src/app/api/access/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requestAccessLink } from "@/lib/access/request";
import { firstHop } from "@/lib/portal/intake";

export const dynamic = "force-dynamic";

/** Public. One work email in; a Resend link out, or a plain reason why not. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your work email" }, { status: 400 });
  }
  const email =
    body && typeof body === "object" && "email" in body && typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email
      : null;
  if (email === null) return NextResponse.json({ error: "Enter your work email" }, { status: 400 });

  const result = await requestAccessLink({ email, ip: firstHop(request.headers.get("x-forwarded-for")) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, email: result.email });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/api/access/route.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/access/route.ts src/app/api/access/route.test.ts
git commit -m "feat(access): public link request route"
```

---

## Task 10: `/access` and `/access/continue`

**Files:**
- Create: `src/components/access/AccessShell.tsx`
- Create: `src/components/access/AccessForm.tsx`, `src/components/access/AccessForm.test.tsx`
- Create: `src/components/access/ContinueSignIn.tsx`, `src/components/access/ContinueSignIn.test.tsx`
- Create: `src/app/access/page.tsx`, `src/app/access/continue/page.tsx`

**Interfaces:**
- Consumes: `POST /api/access` (Task 9); Clerk 7 `useSignIn` (signals API: `signIn.ticket({ ticket })`, `signIn.finalize({ navigate })`), `useAuth`, `useClerk` from `@clerk/nextjs`.
- Produces: `AccessShell({ lead, children })`, `AccessForm()`, `ContinueSignIn()`, `CONTINUE_FAILED` copy constant.

- [ ] **Step 1: Write the failing component tests**

`src/components/access/AccessForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

describe("AccessForm", () => {
  it("posts the email and shows the sent state", async () => {
    respond(200, { ok: true, email: "jane@acme.co.uk" });
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText("Work email"), "Jane@Acme.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Email me a link" }));
    await waitFor(() => expect(screen.getByText("Check your inbox")).toBeInTheDocument());
    expect(screen.getByText(/jane@acme\.co\.uk/)).toBeInTheDocument();
    expect(screen.getByText(/60 minutes/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access");
    expect(JSON.parse(init.body)).toEqual({ email: "Jane@Acme.co.uk" });
  });

  it("shows the server's reason when refused and keeps the form", async () => {
    respond(403, { error: "That organisation has not been given access yet." });
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText("Work email"), "jane@other.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Email me a link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("has not been given access"));
    expect(screen.getByLabelText("Work email")).toHaveValue("jane@other.co.uk");
  });

  it("lets the visitor send another link", async () => {
    respond(200, { ok: true, email: "jane@acme.co.uk" });
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText("Work email"), "jane@acme.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Email me a link" }));
    await userEvent.click(await screen.findByRole("button", { name: "Send another" }));
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
  });
});
```

`src/components/access/ContinueSignIn.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticket: vi.fn(),
  finalize: vi.fn(),
  replace: vi.fn(),
  isSignedIn: false,
  search: "?ticket=tok_1",
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ loaded: true }),
  useAuth: () => ({ isLoaded: true, isSignedIn: mocks.isSignedIn }),
  useSignIn: () => ({ signIn: { ticket: mocks.ticket, finalize: mocks.finalize }, errors: {}, fetchStatus: "idle" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

import { CONTINUE_FAILED, ContinueSignIn } from "./ContinueSignIn";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSignedIn = false;
  mocks.search = "?ticket=tok_1";
  mocks.ticket.mockResolvedValue({ error: null });
  mocks.finalize.mockImplementation(async ({ navigate }: { navigate: () => void }) => {
    navigate();
    return { error: null };
  });
});

describe("ContinueSignIn", () => {
  it("signs in with the ticket from the link and goes to /client", async () => {
    render(<ContinueSignIn />);
    await waitFor(() => expect(mocks.ticket).toHaveBeenCalledWith({ ticket: "tok_1" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/client"));
    expect(mocks.finalize).toHaveBeenCalledTimes(1);
  });

  it("shows the failure copy when Clerk refuses the ticket", async () => {
    mocks.ticket.mockResolvedValue({ error: { message: "expired" } });
    render(<ContinueSignIn />);
    await waitFor(() => expect(screen.getByText(CONTINUE_FAILED)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/access");
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it("fails at once without a ticket", () => {
    mocks.search = "";
    render(<ContinueSignIn />);
    expect(screen.getByText(CONTINUE_FAILED)).toBeInTheDocument();
    expect(mocks.ticket).not.toHaveBeenCalled();
  });

  it("goes straight to /client when already signed in", async () => {
    mocks.isSignedIn = true;
    render(<ContinueSignIn />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/client"));
    expect(mocks.ticket).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/access`
Expected: FAIL, imports unresolved.

- [ ] **Step 3: Write the shell and the two components**

`src/components/access/AccessShell.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

/** The same green ground as /sign-in: hallmark, one lead sentence, one card. */
export function AccessShell({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <p className="mb-6 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">{lead}</p>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

`src/components/access/AccessForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";

const NOT_SENT = "We could not send the link. Try again in a few minutes";

type Phase = { kind: "form" } | { kind: "sent"; email: string };

export function AccessForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) {
        setError(data.error ?? NOT_SENT);
        return;
      }
      setPhase({ kind: "sent", email: data.email ?? email });
    } catch {
      setError(NOT_SENT);
    } finally {
      setPending(false);
    }
  }

  if (phase.kind === "sent") {
    return (
      <div className="panel-brackets border border-brass/30 bg-parchment p-6 text-center">
        <p className="font-serif text-2xl text-green">Check your inbox</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
          We have sent a link to {phase.email}. It works once and for 60 minutes.
        </p>
        <button
          type="button"
          className="mt-4 font-mono text-[10px] tracking-[0.2em] uppercase text-green hover:text-brass"
          onClick={() => setPhase({ kind: "form" })}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="panel-brackets border border-brass/30 bg-parchment p-6">
      <label className="block">
        <span className="portal-label">Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="portal-field"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
      </label>
      {error && (
        <p className="mt-2 text-[12px] text-oxblood" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-outline mt-4 text-[12px]" disabled={pending}>
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
```

`src/components/access/ContinueSignIn.tsx`:

```tsx
"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const CONTINUE_FAILED = "This link has expired or has already been used.";

/**
 * Turns the ticket in the emailed link into a Clerk session. Clerk 7's signals API:
 * ticket() verifies, finalize() activates the session and hands us the navigation.
 */
export function ContinueSignIn() {
  const ticket = useSearchParams().get("ticket");
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const [failed, setFailed] = useState(!ticket);
  const started = useRef(false);

  useEffect(() => {
    if (!ticket || !isLoaded || !clerk.loaded || started.current) return;
    if (isSignedIn) {
      router.replace("/client");
      return;
    }
    if (!signIn) return;
    started.current = true;
    void (async () => {
      const { error } = await signIn.ticket({ ticket });
      if (error) {
        setFailed(true);
        return;
      }
      const finalised = await signIn.finalize({ navigate: () => router.replace("/client") });
      if (finalised.error) setFailed(true);
    })();
  }, [ticket, isLoaded, isSignedIn, clerk.loaded, signIn, router]);

  if (failed) {
    return (
      <div className="panel-brackets border border-brass/30 bg-parchment p-6 text-center">
        <p className="font-serif text-2xl text-green">Link not valid</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/70">{CONTINUE_FAILED}</p>
        <Link href="/access" className="mt-4 inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-green hover:text-brass">
          Ask for a new link
        </Link>
      </div>
    );
  }

  return (
    <p className="text-center text-[14px] text-cream/85" aria-live="polite">
      Opening your file desk…
    </p>
  );
}
```

- [ ] **Step 4: Write the two pages**

`src/app/access/page.tsx`:

```tsx
import { AccessForm } from "@/components/access/AccessForm";
import { AccessShell } from "@/components/access/AccessShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Send files",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccessPage() {
  return (
    <AccessShell lead="Send files to Meritus Via. Enter your work email. If your organisation has been given access, we will email you a link.">
      {isClerkConfigured() ? <AccessForm /> : <SetupNotice title="Client access is not configured yet" />}
    </AccessShell>
  );
}
```

`src/app/access/continue/page.tsx`:

```tsx
import { Suspense } from "react";
import { AccessShell } from "@/components/access/AccessShell";
import { ContinueSignIn } from "@/components/access/ContinueSignIn";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Opening your file desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ContinuePage() {
  return (
    <AccessShell lead="Meritus Via client files.">
      {isClerkConfigured() ? (
        <Suspense fallback={null}>
          <ContinueSignIn />
        </Suspense>
      ) : (
        <SetupNotice title="Client access is not configured yet" />
      )}
    </AccessShell>
  );
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npm test -- src/components/access && npx tsc --noEmit`
Expected: PASS; tsc clean. If tsc rejects `signIn.finalize({ navigate })` because the callback receives `{ session, decorateUrl }`, keep the arrow with no parameters (extra parameters are allowed on the callee side); if it rejects `useSignIn` returning a nullable `signIn`, the `if (!signIn) return` guard already covers it.

- [ ] **Step 6: Commit**

```bash
git add src/components/access src/app/access
git commit -m "feat(access): request page and ticket continuation"
```

---

## Task 11: Client uploads through the existing store

**Files:**
- Modify: `src/lib/portal/upload.ts`, `src/lib/portal/upload.test.ts`
- Modify: `src/lib/portal/files.ts` (`DocumentSummary`, `summariseDocument`)
- Modify: `src/components/portal/FileList.tsx`
- Modify: `src/components/portal/ActivityTimeline.tsx:6-10, 94-105`
- Create: `src/components/portal/ActivityTimeline.test.tsx`

**Interfaces:**
- Consumes: `clientActorEmail`, `clientActorId` (Task 1); `documents.clientDomainId` (Task 2).
- Produces:

```ts
// upload.ts: storePortalDocument gains
client?: { id: string; domain: string } | null;  // key clients/{domain}/{id}-{file}; row.clientDomainId
actorId?: string;                                // activity actor; defaults to uploadedBy

// files.ts
export type DocumentSummary = { id; title; size; createdAt; hasText; fromClient: boolean };

// FileList props
documentsUrl?: string;   // default "/api/portal/documents"; download and delete base
showTextTag?: boolean;   // default true
```

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/portal/upload.test.ts` inside `describe("storePortalDocument")`:

```ts
  it("puts a client upload under clients/{domain}, records the domain and the client actor", async () => {
    const file = new File(["%PDF"], "Site diary.pdf", { type: "application/pdf" });
    const row = await storePortalDocument({
      file,
      scope: "pursuit",
      pursuitId: "p1",
      uploadedBy: "user_jane",
      client: { id: "cd1", domain: "acme.co.uk" },
      actorId: "client:jane@acme.co.uk",
    });
    expect(mocks.put).toHaveBeenCalledWith(
      expect.stringMatching(/^clients\/acme\.co\.uk\/[0-9a-f-]{36}-Site diary\.pdf$/),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(mocks.insertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ clientDomainId: "cd1", pursuitId: "p1", uploadedBy: "user_jane" })
    );
    expect(mocks.addActivity).toHaveBeenCalledWith(
      expect.objectContaining({ pursuitId: "p1", kind: "file_added", actorId: "client:jane@acme.co.uk", meta: { documentId: row.id, title: "Site diary.pdf" } })
    );
  });

  it("stores a null domain and the uploader as actor for a director's upload", async () => {
    const file = new File(["%PDF"], "Letter.pdf", { type: "application/pdf" });
    await storePortalDocument({ file, scope: "pursuit", pursuitId: "p1", uploadedBy: "user_wr" });
    expect(mocks.insertDocument).toHaveBeenCalledWith(expect.objectContaining({ clientDomainId: null }));
    expect(mocks.addActivity).toHaveBeenCalledWith(expect.objectContaining({ actorId: "user_wr" }));
  });
```

`src/components/portal/ActivityTimeline.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/db/schema";
import { ActivityTimeline } from "./ActivityTimeline";

const entry: Activity = {
  id: "a1",
  pursuitId: "p1",
  kind: "file_added",
  actorId: "client:jane@acme.co.uk",
  body: "Added Site diary.pdf",
  meta: { documentId: "d1", title: "Site diary.pdf" },
  createdAt: new Date("2026-09-12T10:15:00Z"),
};

describe("ActivityTimeline", () => {
  it("shows a client upload with a Client pill and the email", () => {
    render(<ActivityTimeline entries={[entry]} directors={[]} />);
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByTitle("jane@acme.co.uk")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/portal/upload.test.ts src/components/portal/ActivityTimeline.test.tsx`
Expected: the client upload test FAILS (key under `portal/pursuit/`, no `clientDomainId`); the timeline test FAILS (no "Client" text).

- [ ] **Step 3: Update `upload.ts`**

Replace the input type and the three lines that use it:

```ts
export async function storePortalDocument(input: {
  file: File;
  scope: DocumentScope;
  pursuitId?: string | null;
  uploadedBy: string;
  title?: string;
  /** Set for uploads from /client: the object goes under clients/{domain}/ and the row carries the domain id. */
  client?: { id: string; domain: string } | null;
  /** Activity actor when it differs from uploadedBy; clients are recorded as "client:<email>". */
  actorId?: string;
}) {
```

```ts
  const pathname = input.client
    ? `clients/${input.client.domain}/${id}-${fileName}`
    : `portal/${input.scope}/${input.pursuitId ?? "firm"}/${id}-${fileName}`;
```

In the `insertDocument` call add `clientDomainId: input.client?.id ?? null,` after `pursuitId`. In the `addActivity` call replace `actorId: input.uploadedBy,` with `actorId: input.actorId ?? input.uploadedBy,`.

- [ ] **Step 4: Update `files.ts`**

```ts
/** What the browser needs about a file: never the extracted text itself. */
export type DocumentSummary = {
  id: string;
  title: string;
  size: number;
  createdAt: Date;
  hasText: boolean;
  /** True when a client sent the file through /client. */
  fromClient: boolean;
};

export function summariseDocument(doc: DocumentRow): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    size: doc.size,
    createdAt: doc.createdAt,
    hasText: hasReadableText(doc),
    fromClient: doc.clientDomainId != null,
  };
}
```

- [ ] **Step 5: Update `FileList.tsx`**

Change the signature and the two URLs, and add the tags:

```tsx
export function FileList({
  documents,
  uploadUrl,
  documentsUrl = "/api/portal/documents",
  showTextTag = true,
}: {
  documents: DocumentSummary[];
  uploadUrl: string;
  /** Base for download and delete; the client desk points it at /api/client/documents. */
  documentsUrl?: string;
  /** The "text / no text" tag is for the questions drawer, so the client desk hides it. */
  showTextTag?: boolean;
}) {
```

`onDelete`: `const res = await fetch(\`${documentsUrl}/${id}\`, { method: "DELETE" });`

The list item link: `<a href={\`${documentsUrl}/${doc.id}\`} ...>`.

The meta line:

```tsx
              <p className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                {formatSize(doc.size)} · {shortDate(doc.createdAt)}
                {showTextTag && (
                  <>
                    {" · "}
                    <span className={doc.hasText ? "text-green" : "text-ink/70"} title={doc.hasText ? "The questions drawer can read this file" : "No readable text in this file"}>
                      {doc.hasText ? "text" : "no text"}
                    </span>
                  </>
                )}
                {doc.fromClient && (
                  <>
                    {" · "}
                    <span className="text-brass" title="Sent by the client through the file desk">client</span>
                  </>
                )}
              </p>
```

- [ ] **Step 6: Update `ActivityTimeline.tsx`**

Import `clientActorEmail` from `@/lib/portal/roles` and replace `actorLabel` and the pill condition:

```tsx
function actorLabel(directors: Director[], actorId: string): { initials: string; name: string; pill: boolean } {
  if (actorId === "site") return { initials: "Site", name: "Site form", pill: true };
  if (actorId === "system") return { initials: "Sys", name: "System", pill: true };
  const clientEmail = clientActorEmail(actorId);
  if (clientEmail) return { initials: "Client", name: clientEmail, pill: true };
  return { initials: directorInitials(directors, actorId), name: directorName(directors, actorId), pill: false };
}
```

```tsx
              {actor.pill ? (
                <span
                  className="inline-flex h-6 items-center rounded-full border border-green/20 px-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink/70"
                  title={actor.name}
                >
                  {actor.initials}
                </span>
              ) : (
                <OwnerAvatar initials={actor.initials} name={actor.name} />
              )}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS (the existing FileList consumers pass no new props and render as before); tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/portal/upload.ts src/lib/portal/upload.test.ts src/lib/portal/files.ts src/components/portal/FileList.tsx src/components/portal/ActivityTimeline.tsx src/components/portal/ActivityTimeline.test.tsx
git commit -m "feat(portal): client uploads through the store, client tags on files and the timeline"
```

---

## Task 12: The client file desk and its routes

**Files:**
- Create: `src/app/client/layout.tsx`, `src/app/client/page.tsx`
- Create: `src/app/api/client/documents/route.ts`, `src/app/api/client/documents/route.test.ts`
- Create: `src/app/api/client/documents/[id]/route.ts`, `src/app/api/client/documents/[id]/route.test.ts`

**Interfaces:**
- Consumes: `clientContext`, `requireClientUser`, `ACCESS_REMOVED`, `UNVERIFIED` (Task 5); `storePortalDocument` with `client` and `actorId` (Task 11); `clientActorId` (Task 1); `listClientDocuments`, `getDocument`, `deleteDocumentRow` (Task 2 and existing); `getPursuit`; `FileList` with `documentsUrl`, `showTextTag` (Task 11); `getObject`, `deleteObjects`, `addActivity`, `isStorageConfigured`, `setupResponse`, `requireDatabaseOr503`.
- Produces: `POST /api/client/documents` (multipart `file`, optional `title`) and `GET | DELETE /api/client/documents/[id]`, both scoped to the caller's domain.

- [ ] **Step 1: Write the failing route tests**

`src/app/api/client/documents/route.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireClientUser: vi.fn(),
  requireDatabaseOr503: vi.fn(),
  isStorageConfigured: vi.fn(),
  storePortalDocument: vi.fn(),
}));

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requireClientUser: mocks.requireClientUser, requireDatabaseOr503: mocks.requireDatabaseOr503 };
});
vi.mock("@/lib/env", () => ({ isStorageConfigured: mocks.isStorageConfigured }));
vi.mock("@/lib/portal/upload", () => ({ storePortalDocument: mocks.storePortalDocument }));

import { POST } from "./route";

const client = {
  userId: "user_jane",
  email: "jane@acme.co.uk",
  domain: { id: "cd1", domain: "acme.co.uk", pursuitId: "p1", createdBy: "user_wr", createdAt: new Date() },
};

function request(body?: FormData): Request {
  return new Request("http://localhost/api/client/documents", { method: "POST", body });
}

function withFile(title?: string): FormData {
  const form = new FormData();
  form.append("file", new File(["%PDF"], "Site diary.pdf", { type: "application/pdf" }));
  if (title) form.append("title", title);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireClientUser.mockResolvedValue({ client });
  mocks.requireDatabaseOr503.mockReturnValue(null);
  mocks.isStorageConfigured.mockReturnValue(true);
  mocks.storePortalDocument.mockResolvedValue({ id: "d1", title: "Site diary.pdf" });
});

describe("POST /api/client/documents", () => {
  it("stores the file on the domain's pursuit as the client", async () => {
    const response = await POST(request(withFile("Site diary")));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ document: { id: "d1", title: "Site diary.pdf" } });
    expect(mocks.storePortalDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "pursuit",
        pursuitId: "p1",
        uploadedBy: "user_jane",
        client: { id: "cd1", domain: "acme.co.uk" },
        actorId: "client:jane@acme.co.uk",
        title: "Site diary",
      })
    );
  });

  it("returns the gate's response when the caller is not a client", async () => {
    mocks.requireClientUser.mockResolvedValue({ error: NextResponse.json({ error: "This area is for clients" }, { status: 403 }) });
    const response = await POST(request(withFile()));
    expect(response.status).toBe(403);
    expect(mocks.storePortalDocument).not.toHaveBeenCalled();
  });

  it("returns 503 when storage is not configured", async () => {
    mocks.isStorageConfigured.mockReturnValue(false);
    expect((await POST(request(withFile()))).status).toBe(503);
  });

  it("returns 400 without a file and when the body is not a form", async () => {
    expect((await POST(request(new FormData()))).status).toBe(400);
    const json = new Request("http://localhost/api/client/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect((await POST(json)).status).toBe(400);
  });

  it("reports a store refusal as 400 with its reason", async () => {
    mocks.storePortalDocument.mockRejectedValue(new Error("File exceeds 4 MB"));
    const response = await POST(request(withFile()));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "File exceeds 4 MB" });
  });
});
```

`src/app/api/client/documents/[id]/route.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireClientUser: vi.fn(),
  requireDatabaseOr503: vi.fn(),
  isStorageConfigured: vi.fn(),
  getDocument: vi.fn(),
  deleteDocumentRow: vi.fn(),
  addActivity: vi.fn(),
  getObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requireClientUser: mocks.requireClientUser, requireDatabaseOr503: mocks.requireDatabaseOr503 };
});
vi.mock("@/lib/env", () => ({ isStorageConfigured: mocks.isStorageConfigured }));
vi.mock("@/lib/db/documents", () => ({ getDocument: mocks.getDocument, deleteDocumentRow: mocks.deleteDocumentRow }));
vi.mock("@/lib/db/activity", () => ({ addActivity: mocks.addActivity }));
vi.mock("@/lib/portal/s3", () => ({ getObject: mocks.getObject, deleteObjects: mocks.deleteObjects }));

import { DELETE, GET } from "./route";

const client = {
  userId: "user_jane",
  email: "jane@acme.co.uk",
  domain: { id: "cd1", domain: "acme.co.uk", pursuitId: "p1", createdBy: "user_wr", createdAt: new Date() },
};

const document = {
  id: "d1",
  scope: "pursuit",
  pursuitId: "p1",
  clientDomainId: "cd1",
  title: "Site diary.pdf",
  blobUrl: "s3://bucket/meritus/clients/acme.co.uk/d1-Site diary.pdf",
  blobPathname: "meritus/clients/acme.co.uk/d1-Site diary.pdf",
  fileName: "Site diary.pdf",
  mime: "application/pdf",
  size: 4,
  extractedText: null,
  uploadedBy: "user_jane",
  createdAt: new Date(),
};

function context(id = "d1") {
  return { params: Promise.resolve({ id }) };
}

const req = (method: string) => new Request("http://localhost/api/client/documents/d1", { method });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireClientUser.mockResolvedValue({ client });
  mocks.requireDatabaseOr503.mockReturnValue(null);
  mocks.isStorageConfigured.mockReturnValue(true);
  mocks.getDocument.mockResolvedValue(document);
  mocks.getObject.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  mocks.deleteDocumentRow.mockResolvedValue(undefined);
  mocks.deleteObjects.mockResolvedValue(undefined);
  mocks.addActivity.mockResolvedValue({});
});

describe("GET /api/client/documents/[id]", () => {
  it("streams a file that belongs to the caller's domain", async () => {
    const response = await GET(req("GET"), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("Site diary.pdf");
    expect(mocks.getObject).toHaveBeenCalledWith(document.blobPathname);
  });

  it("is 404 for a file from another domain or a director's upload", async () => {
    mocks.getDocument.mockResolvedValue({ ...document, clientDomainId: "cd2" });
    expect((await GET(req("GET"), context())).status).toBe(404);
    mocks.getDocument.mockResolvedValue({ ...document, clientDomainId: null });
    expect((await GET(req("GET"), context())).status).toBe(404);
    expect(mocks.getObject).not.toHaveBeenCalled();
  });

  it("returns the gate's response for non-clients", async () => {
    mocks.requireClientUser.mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await GET(req("GET"), context())).status).toBe(401);
  });
});

describe("DELETE /api/client/documents/[id]", () => {
  it("removes the row, logs file_removed as the client, then deletes the object", async () => {
    const response = await DELETE(req("DELETE"), context());
    expect(response.status).toBe(200);
    expect(mocks.deleteDocumentRow).toHaveBeenCalledWith("d1");
    expect(mocks.addActivity).toHaveBeenCalledWith({
      pursuitId: "p1",
      kind: "file_removed",
      actorId: "client:jane@acme.co.uk",
      body: "Removed Site diary.pdf",
      meta: { documentId: "d1", title: "Site diary.pdf" },
    });
    expect(mocks.deleteObjects).toHaveBeenCalledWith([document.blobPathname]);
  });

  it("is 404 for a file outside the caller's domain", async () => {
    mocks.getDocument.mockResolvedValue({ ...document, clientDomainId: "cd2" });
    expect((await DELETE(req("DELETE"), context())).status).toBe(404);
    expect(mocks.deleteDocumentRow).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/app/api/client`
Expected: FAIL, "Failed to resolve import ./route".

- [ ] **Step 3: Write the upload route**

`src/app/api/client/documents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isStorageConfigured } from "@/lib/env";
import { requireClientUser, requireDatabaseOr503, setupResponse } from "@/lib/portal/auth";
import { clientActorId } from "@/lib/portal/roles";
import { storePortalDocument } from "@/lib/portal/upload";

export const dynamic = "force-dynamic";

/** Multipart upload of one file from the client desk onto the domain's pursuit. */
async function handlePost(request: Request) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  const title = form.get("title");

  const { client } = gate;
  try {
    const document = await storePortalDocument({
      file,
      scope: "pursuit",
      pursuitId: client.domain.pursuitId,
      uploadedBy: client.userId,
      client: { id: client.domain.id, domain: client.domain.domain },
      actorId: clientActorId(client.email),
      title: typeof title === "string" ? title : undefined,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Any failure, including one from a parser that cannot load, comes back as JSON with its reason. */
export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("client upload failed", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write the download and delete route**

`src/app/api/client/documents/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { addActivity } from "@/lib/db/activity";
import { deleteDocumentRow, getDocument } from "@/lib/db/documents";
import type { DocumentRow } from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/env";
import { requireClientUser, requireDatabaseOr503, setupResponse, type ClientUser } from "@/lib/portal/auth";
import { clientActorId } from "@/lib/portal/roles";
import { deleteObjects, getObject } from "@/lib/portal/s3";

export const dynamic = "force-dynamic";

/** A client only ever sees files that came in through their own domain. Anything else is 404, not 403. */
async function ownDocument(id: string, client: ClientUser): Promise<DocumentRow | null> {
  const document = await getDocument(id);
  if (!document || document.clientDomainId !== client.domain.id) return null;
  return document;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  const { id } = await context.params;
  const document = await ownDocument(id, gate.client);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await getObject(document.blobPathname);
  if (!body) return NextResponse.json({ error: "File missing" }, { status: 404 });

  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": document.mime,
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
    },
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  const { id } = await context.params;
  const document = await ownDocument(id, gate.client);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The database is authoritative: remove the row first so a listed file can never point at a missing object.
  await deleteDocumentRow(id);
  if (document.pursuitId) {
    await addActivity({
      pursuitId: document.pursuitId,
      kind: "file_removed",
      actorId: clientActorId(gate.client.email),
      body: `Removed ${document.title}`,
      meta: { documentId: document.id, title: document.title },
    });
  }
  try {
    await deleteObjects([document.blobPathname]);
  } catch (error) {
    console.warn("S3 delete failed", document.blobPathname, error);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Write the layout and page**

`src/app/client/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { clientContext } from "@/lib/portal/auth";

export const metadata: Metadata = {
  title: "Client files",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The client desk's chrome: one green bar, the signed-in email, sign out. Directors are
 * sent to their own Clients page; the middleware has already sent anonymous visitors to
 * /access, and the redirect here covers a session for a user Clerk no longer has.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const context = await clientContext();
  if (context.state === "director") redirect("/portal/clients");
  if (context.state === "signed_out") redirect("/access");
  const email = context.state === "client" || context.state === "unlisted" ? context.email : null;

  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <header className="portal-rail sticky top-0 z-10 flex items-center justify-between gap-4 bg-green px-4 py-3 text-cream">
        <Link href="/client" aria-label="Client files home" className="flex items-center gap-3">
          <HallmarkLogo size="favicon" variant="light" />
          <Eyebrow tone="brass">Client files</Eyebrow>
        </Link>
        <div className="flex items-center gap-4">
          {email && <span className="hidden text-[13px] text-cream/85 sm:inline">{email}</span>}
          {context.state !== "setup" && (
            <SignOutButton redirectUrl="/access">
              <button type="button" className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light">
                Sign out
              </button>
            </SignOutButton>
          )}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 lg:px-10 lg:py-12">
        {children}
      </main>
    </div>
  );
}
```

`src/app/client/page.tsx`:

```tsx
import { Eyebrow } from "@/components/portal/Eyebrow";
import { FileList } from "@/components/portal/FileList";
import { listClientDocuments } from "@/lib/db/documents";
import { getPursuit } from "@/lib/db/pursuits";
import { isStorageConfigured } from "@/lib/env";
import { ACCESS_REMOVED, UNVERIFIED, clientContext } from "@/lib/portal/auth";
import { summariseDocument } from "@/lib/portal/files";

export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel-brackets border border-green/10 bg-parchment p-8">
      <Eyebrow className="mb-3">Client files</Eyebrow>
      <h1 className="mb-3 font-serif text-2xl text-green">{title}</h1>
      <p className="text-[14px] leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}

export default async function ClientPage() {
  const context = await clientContext();
  if (context.state === "setup") return <Notice title="Not available yet" body="Client access needs Clerk and the database." />;
  if (context.state === "unknown") return <Notice title="One moment" body={UNVERIFIED} />;
  if (context.state === "unlisted") {
    return <Notice title="Access removed" body={`${ACCESS_REMOVED}. Ask your Meritus contact if you think this is wrong.`} />;
  }
  if (context.state !== "client") return null; // directors and signed-out visitors were redirected by the layout

  const [pursuit, documents] = await Promise.all([
    getPursuit(context.domain.pursuitId),
    listClientDocuments(context.domain.id),
  ]);

  return (
    <div>
      <Eyebrow rule={false}>Client files</Eyebrow>
      <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Files for Meritus</h1>
      {pursuit && <p className="mt-2 font-mono text-[12px] tracking-[0.08em] text-ink/70">Matter: {pursuit.firm}</p>}
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink/70">
        Upload pdf, docx, xlsx, images, txt, eml or msg files up to 4 MB each. The Meritus directors see them on this
        matter straight away.
      </p>
      <div className="panel-brackets mt-8 border border-green/10 bg-parchment p-6">
        {isStorageConfigured() ? (
          <FileList
            documents={documents.map(summariseDocument)}
            uploadUrl="/api/client/documents"
            documentsUrl="/api/client/documents"
            showTextTag={false}
          />
        ) : (
          <p className="text-[14px] text-ink/70">File storage is not connected yet. Try again later.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test -- src/app/api/client && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/client src/app/api/client
git commit -m "feat(client): file desk with upload, download and delete on the domain's pursuit"
```

---

## Task 13: Director actions: add and remove a client domain

**Files:**
- Create: `src/lib/portal/client-actions.ts`, `src/lib/portal/client-actions.test.ts`

**Interfaces:**
- Consumes: `requireActionUser` (Task 5); `__resetDirectorsCache` (Task 4); `parseClientDomain`, `clientDomainErrorMessage` (Task 1); `findClientDomainByName`, `insertClientDomain`, `deleteClientDomain` (Task 2); `getPursuit`; `ActionResult` from `./types`.
- Produces:

```ts
export async function addClientDomain(input: { domain: string; pursuitId: string }): Promise<ActionResult>;
export async function removeClientDomain(id: string): Promise<ActionResult>;
```

- [ ] **Step 1: Write the failing test**

`src/lib/portal/client-actions.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActionUser: vi.fn(),
  resetDirectors: vi.fn(),
  revalidatePath: vi.fn(),
  getPursuit: vi.fn(),
  findClientDomainByName: vi.fn(),
  insertClientDomain: vi.fn(),
  deleteClientDomain: vi.fn(),
}));

vi.mock("./auth", () => ({ requireActionUser: mocks.requireActionUser }));
vi.mock("./directors", () => ({ __resetDirectorsCache: mocks.resetDirectors }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/pursuits", () => ({ getPursuit: mocks.getPursuit }));
vi.mock("@/lib/db/client-domains", () => ({
  findClientDomainByName: mocks.findClientDomainByName,
  insertClientDomain: mocks.insertClientDomain,
  deleteClientDomain: mocks.deleteClientDomain,
}));

import { addClientDomain, removeClientDomain } from "./client-actions";

const PURSUIT = "8c1d2e3f-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireActionUser.mockResolvedValue({ ok: true, userId: "user_wr" });
  mocks.getPursuit.mockResolvedValue({ id: PURSUIT, firm: "Acme Developments" });
  mocks.findClientDomainByName.mockResolvedValue(null);
  mocks.insertClientDomain.mockResolvedValue({ id: "cd1", domain: "acme.co.uk", pursuitId: PURSUIT });
  mocks.deleteClientDomain.mockResolvedValue(true);
});

describe("addClientDomain", () => {
  it("lists a normalised domain against the pursuit as the signed-in director", async () => {
    await expect(addClientDomain({ domain: " @ACME.co.uk ", pursuitId: PURSUIT })).resolves.toEqual({ ok: true });
    expect(mocks.insertClientDomain).toHaveBeenCalledWith({ domain: "acme.co.uk", pursuitId: PURSUIT, createdBy: "user_wr" });
    expect(mocks.resetDirectors).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portal", "layout");
  });

  it("refuses a public mailbox, the firm domain and a shapeless domain", async () => {
    await expect(addClientDomain({ domain: "gmail.com", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "Public mailbox domains cannot be listed" });
    await expect(addClientDomain({ domain: "meritusvia.com", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "meritusvia.com is reserved for directors" });
    await expect(addClientDomain({ domain: "not a domain", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "Enter a domain such as acme.co.uk" });
    expect(mocks.insertClientDomain).not.toHaveBeenCalled();
  });

  it("refuses a duplicate, found either before or by the unique index", async () => {
    mocks.findClientDomainByName.mockResolvedValueOnce({ id: "cd1", domain: "acme.co.uk" });
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "That domain is already listed" });
    mocks.insertClientDomain.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }));
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "That domain is already listed" });
  });

  it("requires a pursuit that exists", async () => {
    mocks.getPursuit.mockResolvedValue(null);
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "Choose a pursuit" });
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: "" })).resolves.toEqual({ ok: false, error: "Choose a pursuit" });
  });

  it("hands back the gate's refusal", async () => {
    mocks.requireActionUser.mockResolvedValue({ ok: false, error: "This area is for directors only" });
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "This area is for directors only" });
    expect(mocks.insertClientDomain).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a plain message", async () => {
    mocks.insertClientDomain.mockRejectedValue(new Error("connection reset"));
    await expect(addClientDomain({ domain: "acme.co.uk", pursuitId: PURSUIT })).resolves.toEqual({ ok: false, error: "Something went wrong, try again" });
  });
});

describe("removeClientDomain", () => {
  it("removes the row and resets the actor cache", async () => {
    await expect(removeClientDomain("cd1")).resolves.toEqual({ ok: true });
    expect(mocks.deleteClientDomain).toHaveBeenCalledWith("cd1");
    expect(mocks.resetDirectors).toHaveBeenCalled();
  });

  it("says so when the row has already gone", async () => {
    mocks.deleteClientDomain.mockResolvedValue(false);
    await expect(removeClientDomain("cd1")).resolves.toEqual({ ok: false, error: "That domain is no longer listed" });
    await expect(removeClientDomain("")).resolves.toEqual({ ok: false, error: "That domain is no longer listed" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/portal/client-actions.test.ts`
Expected: FAIL, "Failed to resolve import ./client-actions".

- [ ] **Step 3: Write the actions**

`src/lib/portal/client-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { deleteClientDomain, findClientDomainByName, insertClientDomain } from "@/lib/db/client-domains";
import { getPursuit } from "@/lib/db/pursuits";
import { requireActionUser } from "./auth";
import { __resetDirectorsCache } from "./directors";
import { clientDomainErrorMessage, parseClientDomain } from "./domains";
import type { ActionResult } from "./types";

/*
 * The two mutations behind /portal/clients. Same shape as actions.ts: check the director,
 * do the work, return a plain result, and always revalidate the portal. The actor cache
 * is reset too, because a listed domain changes who counts as a client.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ALREADY_LISTED = "That domain is already listed";
const NOT_LISTED = "That domain is no longer listed";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505");
}

async function guarded(name: string, handler: (userId: string) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    return await handler(user.userId);
  } catch (error) {
    console.error(`[portal] ${name} failed`, error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    __resetDirectorsCache();
    revalidatePath("/portal", "layout");
  }
}

export async function addClientDomain(input: { domain: string; pursuitId: string }): Promise<ActionResult> {
  return guarded("addClientDomain", async (userId) => {
    const parsed = parseClientDomain(input.domain);
    if (!parsed.ok) return { ok: false, error: clientDomainErrorMessage(parsed.error) };
    if (!ID.test(input.pursuitId) || !(await getPursuit(input.pursuitId))) {
      return { ok: false, error: "Choose a pursuit" };
    }
    if (await findClientDomainByName(parsed.domain)) return { ok: false, error: ALREADY_LISTED };
    try {
      await insertClientDomain({ domain: parsed.domain, pursuitId: input.pursuitId, createdBy: userId });
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, error: ALREADY_LISTED };
      throw error;
    }
    return { ok: true };
  });
}

export async function removeClientDomain(id: string): Promise<ActionResult> {
  return guarded("removeClientDomain", async () => {
    if (!ID.test(id)) return { ok: false, error: NOT_LISTED };
    const deleted = await deleteClientDomain(id);
    return deleted ? { ok: true } : { ok: false, error: NOT_LISTED };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/portal/client-actions.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal/client-actions.ts src/lib/portal/client-actions.test.ts
git commit -m "feat(portal): add and remove client domains"
```

---

## Task 14: The directors' Clients page, nav item and client redirect

**Files:**
- Create: `src/components/portal/ClientDomainForm.tsx`, `src/components/portal/ClientDomainForm.test.tsx`
- Create: `src/components/portal/ClientDomainList.tsx`
- Create: `src/app/(portal)/portal/clients/page.tsx`
- Modify: `src/app/(portal)/portal/layout.tsx`

**Interfaces:**
- Consumes: `addClientDomain`, `removeClientDomain` (Task 13); `listClientDomains`, `ClientDomainRow`, `listPursuitsForClientAccess` (Task 2); `getActor` (Task 4); `listDirectors`, `directorInitials`; `stageLabel` from `./stages`; `fullDate`; `ConfirmDialog`, `Eyebrow`, `Panel`, `SetupNotice`, `NavLink`, `DirectorMenu`.
- Produces:

```ts
export type PursuitOption = { id: string; label: string };
export function ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] }): JSX.Element;
export type ClientDomainItem = { id: string; domain: string; pursuitId: string; firm: string; stage: string; fileCount: number; added: string; addedBy: string };
export function ClientDomainList({ domains }: { domains: ClientDomainItem[] }): JSX.Element;
```

- [ ] **Step 1: Write the failing form test**

`src/components/portal/ClientDomainForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ addClientDomain: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/portal/client-actions", () => ({ addClientDomain: mocks.addClientDomain }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { ClientDomainForm } from "./ClientDomainForm";

const pursuits = [
  { id: "p1", label: "Acme Developments (Scoping)" },
  { id: "p2", label: "Beta Build (Enquiry)" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addClientDomain.mockResolvedValue({ ok: true });
});

describe("ClientDomainForm", () => {
  it("submits the domain and the chosen pursuit, then clears and refreshes", async () => {
    render(<ClientDomainForm pursuits={pursuits} />);
    await userEvent.type(screen.getByLabelText("Company domain"), "acme.co.uk");
    await userEvent.selectOptions(screen.getByLabelText("Pursuit"), "p2");
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() => expect(mocks.addClientDomain).toHaveBeenCalledWith({ domain: "acme.co.uk", pursuitId: "p2" }));
    await waitFor(() => expect(screen.getByText("Domain listed.")).toBeInTheDocument());
    expect(screen.getByLabelText("Company domain")).toHaveValue("");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows the action's error and keeps the input", async () => {
    mocks.addClientDomain.mockResolvedValue({ ok: false, error: "That domain is already listed" });
    render(<ClientDomainForm pursuits={pursuits} />);
    await userEvent.type(screen.getByLabelText("Company domain"), "acme.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("already listed"));
    expect(screen.getByLabelText("Company domain")).toHaveValue("acme.co.uk");
  });

  it("cannot submit when there is no pursuit to attach to", () => {
    render(<ClientDomainForm pursuits={[]} />);
    expect(screen.getByRole("button", { name: "Add domain" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/portal/ClientDomainForm.test.tsx`
Expected: FAIL, "Failed to resolve import ./ClientDomainForm".

- [ ] **Step 3: Write the form and the list**

`src/components/portal/ClientDomainForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { addClientDomain } from "@/lib/portal/client-actions";

export type PursuitOption = { id: string; label: string };

export function ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [pursuitId, setPursuitId] = useState(pursuits[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await addClientDomain({ domain, pursuitId });
      if (result.ok) {
        setDomain("");
        setMessage({ tone: "ok", text: "Domain listed." });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="portal-label">Company domain</span>
        <input
          name="domain"
          type="text"
          required
          className="portal-field"
          placeholder="acme.co.uk"
          autoComplete="off"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
        />
      </label>
      <label className="block">
        <span className="portal-label">Pursuit</span>
        <select
          name="pursuitId"
          required
          className="portal-field"
          value={pursuitId}
          onChange={(event) => setPursuitId(event.target.value)}
        >
          {pursuits.length === 0 && <option value="">No pursuits yet</option>}
          {pursuits.map((pursuit) => (
            <option key={pursuit.id} value={pursuit.id}>
              {pursuit.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-outline text-[12px]" disabled={pending || pursuits.length === 0}>
        {pending ? "Adding…" : "Add domain"}
      </button>
      {message && (
        <p
          className={`text-[12px] ${message.tone === "ok" ? "text-ink/70" : "text-oxblood"}`}
          role={message.tone === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
```

`src/components/portal/ClientDomainList.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeClientDomain } from "@/lib/portal/client-actions";
import { ConfirmDialog } from "./ConfirmDialog";

export type ClientDomainItem = {
  id: string;
  domain: string;
  pursuitId: string;
  firm: string;
  stage: string;
  fileCount: number;
  /** Already formatted: "12 September 2026". */
  added: string;
  /** The listing director's initials. */
  addedBy: string;
};

export function ClientDomainList({ domains }: { domains: ClientDomainItem[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<ClientDomainItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return <p className="text-[14px] text-ink/70">No client domains yet.</p>;
  }

  function confirmRemove() {
    const target = removing;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await removeClientDomain(target.id);
      setRemoving(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div>
      <div className="overflow-x-auto border border-green/10 bg-parchment">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-green/10 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
              <th className="px-4 py-3 font-normal">Domain</th>
              <th className="px-4 py-3 font-normal">Pursuit</th>
              <th className="px-4 py-3 font-normal">Files</th>
              <th className="px-4 py-3 font-normal">Added</th>
              <th className="px-4 py-3 font-normal">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((row) => (
              <tr key={row.id} className="border-b border-green/5 last:border-0">
                <td className="px-4 py-3 text-green">@{row.domain}</td>
                <td className="px-4 py-3">
                  <Link href={`/portal/pursuits/${row.pursuitId}`} className="text-green hover:text-brass">
                    {row.firm}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ink/55">{row.stage}</span>
                </td>
                <td className="px-4 py-3 text-ink/70">{row.fileCount}</td>
                <td className="px-4 py-3 text-ink/70">
                  {row.added} <span className="font-mono text-[10px] text-ink/55">{row.addedBy}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="font-mono text-[9px] tracking-[0.15em] uppercase text-ink/70 hover:text-oxblood"
                    onClick={() => setRemoving(row)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-3 text-[12px] text-oxblood">{error}</p>}
      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Remove @${removing.domain}?` : ""}
        body="Nobody at this domain will be able to open the file desk. Files already uploaded stay on the pursuit."
        confirmLabel="Remove"
        danger
        pending={pending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

`src/app/(portal)/portal/clients/page.tsx`:

```tsx
import { ClientDomainForm, type PursuitOption } from "@/components/portal/ClientDomainForm";
import { ClientDomainList, type ClientDomainItem } from "@/components/portal/ClientDomainList";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Panel } from "@/components/portal/Panel";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { listClientDomains } from "@/lib/db/client-domains";
import { listPursuitsForClientAccess } from "@/lib/db/pursuits";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { fullDate } from "@/lib/portal/dates";
import { directorInitials, listDirectors } from "@/lib/portal/directors";
import { stageLabel } from "@/lib/portal/stages";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let items: ClientDomainItem[];
  let options: PursuitOption[];
  try {
    const [rows, pursuits, directors] = await Promise.all([
      listClientDomains(),
      listPursuitsForClientAccess(),
      listDirectors(),
    ]);
    items = rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      pursuitId: row.pursuitId,
      firm: row.firm,
      stage: stageLabel(row.stage),
      fileCount: row.fileCount,
      added: fullDate(row.createdAt),
      addedBy: directorInitials(directors, row.createdBy),
    }));
    options = pursuits.map((pursuit) => ({ id: pursuit.id, label: `${pursuit.firm} (${stageLabel(pursuit.stage)})` }));
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Eyebrow rule={false}>Client access</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Clients</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          Anyone with an email address at a listed domain can request a link at meritusvia.com/access and upload
          files to the pursuit. Personal mailboxes and meritusvia.com cannot be listed.
        </p>
      </div>

      <Panel eyebrow="Add a domain" className="max-w-xl">
        <ClientDomainForm pursuits={options} />
      </Panel>

      <section>
        <Eyebrow className="mb-4">Listed domains</Eyebrow>
        <ClientDomainList domains={items} />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Update the portal layout**

In `src/app/(portal)/portal/layout.tsx`:

1. Replace the imports of `getDirector` with `getActor`, and add `import { redirect } from "next/navigation";` and `import { UNVERIFIED } from "@/lib/portal/auth";`.
2. Replace `signedInDirector` with:

```tsx
type Signed =
  | { state: "anonymous" }
  | { state: "client" }
  | { state: "unknown" }
  | { state: "director"; name: string; initials: string };

async function signedIn(): Promise<Signed> {
  if (!isClerkConfigured()) return { state: "anonymous" };
  try {
    const { userId } = await auth();
    if (!userId) return { state: "anonymous" };
    const actor = await getActor(userId);
    if (actor === "unknown") return { state: "unknown" };
    if (actor === null) return { state: "anonymous" };
    if (actor.kind === "client") return { state: "client" };
    return { state: "director", name: actor.name, initials: actor.initials };
  } catch {
    return { state: "anonymous" };
  }
}
```

3. At the top of `PortalLayout`:

```tsx
  const signed = await signedIn();
  if (signed.state === "client") redirect("/client");
  const director = signed.state === "director" ? signed : null;
  const clerk = isClerkConfigured();
```

4. Add the Clients link to both navs, between Programmes and Library:

```tsx
          <NavLink href="/portal/clients">
            Clients
          </NavLink>
```

and, in the top bar, the same with `variant="bar"`.

5. Replace `{children}` inside `<main>` with:

```tsx
          {signed.state === "unknown" ? (
            <div className="max-w-xl border border-green/10 bg-parchment p-8">
              <Eyebrow className="mb-3">Pursuit desk</Eyebrow>
              <h2 className="mb-3 font-serif text-2xl text-green">One moment</h2>
              <p className="text-[14px] leading-relaxed text-ink/70">{UNVERIFIED}</p>
            </div>
          ) : (
            children
          )}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all PASS; tsc and lint clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(portal)/portal/clients/page.tsx" "src/app/(portal)/portal/layout.tsx" src/components/portal/ClientDomainForm.tsx src/components/portal/ClientDomainForm.test.tsx src/components/portal/ClientDomainList.tsx
git commit -m "feat(portal): Clients page, nav item and client redirect"
```

---

## Task 15: Docs, sitemap, full verification, PR

**Files:**
- Modify: `README.md`, `.env.example`, `next-sitemap.config.js`

- [ ] **Step 1: README**

After the "### Uploads" section add:

```markdown
### Client file drop

Directors stay invite-only in Clerk. A director lists a client's company email domain on `/portal/clients` against a pursuit; anyone at that domain types their work email on `/access`, receives a one-click link through Resend (single use, 60 minutes), and uploads files on `/client`. Those files go to the VeriCase S3 bucket under `meritus/clients/{domain}/` and appear on the pursuit's dossier. Client access needs `RESEND_API_KEY`; without it `/access` says so and sends nothing.
```

Under "### One-off manual steps", extend item 2 with: "The same key sends client file links."

- [ ] **Step 2: `.env.example`**

Replace the Resend comment line (the one that begins `# Resend`) with:

```
# Resend: alerts to the directors when an enquiry arrives, and client file links from /access.
# Enquiry alerts are skipped without it; /access refuses until it is set.
```

- [ ] **Step 3: Sitemap**

In `next-sitemap.config.js` set:

```js
  exclude: ["/credentials", "/portal", "/portal/*", "/sign-in", "/sign-in/*", "/access", "/access/*", "/client", "/client/*"],
```

- [ ] **Step 4: Full verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: every test passes (411 baseline plus the new files), tsc and lint clean.

- [ ] **Step 5: Manual check (or say it could not be done)**

With `.env.local` holding Clerk, `DATABASE_URL`, the S3 variables and `RESEND_API_KEY`, run `npm run dev` and:

1. As a director, add `example-firm.co.uk` on `/portal/clients` against a pursuit.
2. Open `/access` in a private window, type `jane@example-firm.co.uk`; expect "Check your inbox" and an email in the Resend dashboard.
3. Open the link; expect `/client` with "Matter: {firm}".
4. Upload a small PDF; expect it under `meritus/clients/example-firm.co.uk/` in the bucket and on the dossier's Files panel with the "client" tag; expect a timeline entry with the Client pill.
5. Type `someone@gmail.com` on `/access`; expect the personal-mailbox refusal.
6. As the client, open `/portal`; expect a redirect to `/client`.
7. As a director, open `/client`; expect a redirect to `/portal/clients`.
8. Remove the domain; as the client, reload `/client`; expect "Access removed".

- [ ] **Step 6: Commit and open the PR**

```bash
git add README.md .env.example next-sitemap.config.js
git commit -m "docs: client file drop"
git push -u origin cursor/client-domain-resend-93bc
```

Open one PR on `williamcjrogers/Meritus` from `cursor/client-domain-resend-93bc` to `main`, titled "Client file drop: Resend link, VeriCase S3, invite-only directors". The description lists: what changed, the migration (`0003_client_domains`), the manual step (set the S3 variables on the existing Vercel project `meritus`, team Quantum Commercial Solutions), that PR #9 is included and PR #7 is superseded, and the manual check results from Step 5. Do not merge.

---

## Self-review against the spec

- Spec 3.1 (director adds a domain): Tasks 13 and 14.
- Spec 3.2 (request a link, refusals in order): Tasks 1, 3, 7, 8, 9, 10.
- Spec 3.3 (continue): Task 10.
- Spec 3.4 (upload, download, delete, timeline): Tasks 11 and 12.
- Spec 3.5 (dossier): no change needed; client uploads are pursuit documents (Task 11 adds the tag).
- Spec 4 (routes, middleware, sitemap): Tasks 6, 15.
- Spec 5 (actor resolution, gates, fail closed with a last-good list): Tasks 4, 5, 14.
- Spec 6 (schema, migration, queries, throttle): Tasks 2, 3.
- Spec 7 (storage key): Task 11.
- Spec 8 (email): Task 7.
- Spec 9 (request handling): Tasks 8, 9.
- Spec 10 (screens and copy): Tasks 10, 12, 14.
- Spec 12 (tests): every listed file has a task above.
- Spec 13 (config and docs): Task 15.

Names used across tasks: `getActor` / `ActorLookup` (4, 5, 14); `clientContext` / `requireClientUser` (5, 12); `storePortalDocument({ client, actorId })` (11, 12); `clientActorId` / `clientActorEmail` (1, 11, 12); `listClientDomains` / `ClientDomainRow` (2, 14); `listPursuitsForClientAccess` (2, 14); `registerAccessAttempt` / `hashKey("access-email" | "access-ip")` (3, 8); `sendAccessLink` / `accessLinkUrl` / `ACCESS_LINK_SECONDS` (7, 8); `requestAccessLink` / `ACCESS_MESSAGES` (8, 9); `FileList({ documentsUrl, showTextTag })` and `DocumentSummary.fromClient` (11, 12).
