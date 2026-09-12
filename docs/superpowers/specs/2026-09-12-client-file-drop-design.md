# Client file drop: design specification

Date: 12 September 2026
Repository: williamcjrogers/Meritus
Base: `cursor/vericase-s3-storage-93bc` at `eff7963` (PR #9, VeriCase S3 for portal uploads)
Working branch: `cursor/client-domain-resend-93bc`
Handover: `docs/HANDOVER-client-files.md` (read first; this spec is the design that satisfies it)
Status: for William Rogers to review

## 1. Purpose

A client of Meritus Via should be able to send documents without Dropbox, WeTransfer or a product login. A director adds the client's company email domain on the pursuit desk. Anyone at that domain types their work email on a public page, receives a one-click link by email through Resend, and lands on a small upload desk. Files go to the VeriCase AWS S3 bucket under the `meritus/` prefix and appear on the pursuit's dossier for the directors.

Directors keep the existing invite-only Clerk sign-in. Clients never see a password form, a public sign-up form, or the pursuit desk.

## 2. Decisions

The handover fixes most of the shape. The decisions below either confirm a handover choice or settle something it left open. Items marked **open to override** are the ones William may want to overturn; everything else follows directly from the handover.

| Topic | Decision |
|---|---|
| Storage | VeriCase's production bucket, same env names, prefix `meritus/`. Client uploads sit under `meritus/clients/{domain}/{id}-{file}`. Downloads stay on authenticated Meritus routes. |
| Director sign-in | Unchanged. Clerk invite-only, `/sign-in` and `/sign-up` copy unchanged. |
| Client sign-in | Public `/access` page with one email field. The server creates or finds a Clerk user with `publicMetadata.role = "client"`, mints a Clerk sign-in token, and Resend emails a link to `/access/continue?ticket=…`. That page completes a ticket sign-in and redirects to `/client`. No password. No Clerk email. |
| Link life | Single use, expires 60 minutes after it is sent. **Open to override** (Clerk's default is 30 days, which is too long for a link that lands in a shared inbox). |
| Domain and pursuit | Every client domain belongs to exactly one pursuit; the director picks the pursuit when adding the domain. Client uploads are therefore ordinary pursuit documents and show on that dossier at once. **Open to override**: the handover treated the pursuit link as optional. Making it required removes orphan documents, a new document scope, and a backfill step when a domain is linked later. A firm with two matters gets its domain re-pointed by a director; files already uploaded stay where they were. |
| Unlisted domain | The `/access` page says plainly that the organisation has not been given access. The handover accepts this over enumeration hiding; rate limits bound probing. |
| Public mailboxes | `gmail.com`, `googlemail.com`, `outlook.com`, `hotmail.com`, `live.com`, `yahoo.com`, `icloud.com`, `me.com`, `aol.com`, `proton.me`, `protonmail.com` cannot be listed and are refused on `/access` with a "use your work email" message. `meritusvia.com` and its subdomains cannot be listed; a director typing their address on `/access` is told to use `/sign-in`. |
| Role source | `publicMetadata.role === "client"` is authoritative. An email whose domain is on `client_domains` is also treated as a client, so an old account can never become a director by accident. Everyone else is a director. |
| Role failure mode | When a role cannot be determined (Clerk backend unreachable and no last-good user list), director-only areas fail closed with a "could not verify" message rather than admitting an unknown session. The last successfully fetched user list is kept and used while Clerk is down, so a warm process never locks a director out. **Open to override** (PR #7 chose fail-open). |
| Clients deleting files | A client can delete a file their organisation uploaded. The dossier timeline records the removal with the client's email. **Open to override**. |
| Directors on `/client` | A director who opens `/client` is redirected to `/portal/clients`. Directors upload on the dossier; there is nothing for them to do on the client desk. |
| Marketing site | Untouched. No header link, no footer link. Directors give clients the `/access` address; the email is the link. |
| BREE, ranking, WR2.0, Clerk DNS | Not touched. |

## 3. Flows

### 3.1 Director adds a domain

1. Director opens `/portal/clients` from the rail (new item "Clients").
2. Types the domain (`acme.co.uk`, `@acme.co.uk` or `jane@acme.co.uk` all normalise to `acme.co.uk`) and picks the pursuit from a select of every pursuit that is not declined, newest first, labelled "Firm (Stage)".
3. The action validates (shape, public mailbox, firm domain, duplicate, pursuit exists), inserts the row, resets the actor cache, revalidates `/portal`.
4. The list shows Domain, Pursuit (link to the dossier), Files (count of documents with that `client_domain_id`), Added (date, director initials), Remove.
5. Remove asks for confirmation ("Nobody at @acme.co.uk will be able to open the file desk. Files already uploaded stay on the pursuit."), deletes the row, sets `documents.client_domain_id` to null on its files, resets the actor cache.

### 3.2 Client requests a link

1. Client opens `/access` (public, `noindex`). One field: "Work email". Button: "Email me a link".
2. `POST /api/access` with `{ email }`:
   - parse and lowercase; refuse malformed input ("Enter your work email");
   - refuse public mailboxes ("Use your work email address, not a personal mailbox");
   - refuse `meritusvia.com` ("Directors sign in at meritusvia.com/sign-in");
   - throttle by hashed email (5 per 24 hours) and hashed IP (20 per hour); over either cap returns 429 "Too many requests. Try again later";
   - look up `client_domains` by domain; none returns 403 "That organisation has not been given access yet. Ask your Meritus contact to add your company's email domain";
   - if Resend is not configured return 503 "Email is not configured. Ask Meritus to enable client access" (nothing is created in Clerk);
   - find the Clerk user whose primary email equals the address (exact match on the filtered list); if none, create one with `emailAddress: [email]`, `skipPasswordRequirement: true`, `publicMetadata: { role: "client", domain }`; if one exists without `role === "client"` return 403 "This address belongs to a director account. Sign in at meritusvia.com/sign-in";
   - create a sign-in token for that user with `expiresInSeconds: 3600`;
   - send the email (section 8); on send failure revoke the token (best effort) and return 502 "We could not send the link. Try again in a few minutes";
   - return `{ ok: true }`.
3. The page replaces the form with "Check your inbox at jane@acme.co.uk. The link works once and for 60 minutes." and a "Send another" link.

### 3.3 Client opens the link

1. `/access/continue?ticket=…` is public. The page is a client component under `ClerkProvider`.
2. If Clerk is not configured it shows the setup notice. If the visitor is already signed in it goes straight to `/client`.
3. Otherwise it calls `signIn.ticket({ ticket })` from `useSignIn()` (the Clerk 7 signals API). On success (`status === "complete"`) it calls `signIn.finalize()` and navigates to `/client`. On error it shows "This link has expired or has already been used" with a link to `/access`.
4. A missing ticket shows the same message.

### 3.4 Client uploads

1. `/client` (Clerk session required; unauthenticated visitors are sent to `/access` by the middleware).
2. The layout resolves the actor. A director is redirected to `/portal/clients`. A client whose domain is no longer listed sees "Your organisation's access has been removed" with a sign-out button. Otherwise the page shows: eyebrow "Client files", heading "Files for Meritus", the line "Matter: {pursuit.firm}", the signed-in email, a sign-out button, and a `FileList` of documents where `client_domain_id` is this domain.
3. Upload posts to `/api/client/documents` (multipart, one file, same 4 MB cap and type list as the desk). The route resolves the actor again, refuses directors (403) and unlisted domains (403), then calls `storePortalDocument` with `scope: "pursuit"`, the domain's `pursuitId`, `clientDomainId`, `uploadedBy: userId` and `actorId: "client:jane@acme.co.uk"`.
4. The dossier timeline shows "Added Letter.pdf" with the actor rendered as "Client" and the email. The Files panel tags the file "client".
5. Download and delete go through `/api/client/documents/[id]`, which only serves documents whose `client_domain_id` matches the caller's domain.

### 3.5 Director sees the files

Nothing new to do: the dossier's Files panel lists pursuit documents, and client uploads are pursuit documents. Text is extracted on upload as for any other file, so the questions drawer can read them.

## 4. Routes and pages

| Route | Access | Purpose |
|---|---|---|
| `/portal/clients` | Directors | Add and remove client domains |
| `/access` | Public | Request a link |
| `/access/continue` | Public | Complete the ticket sign-in |
| `/client` | Clients | Upload desk |
| `POST /api/access` | Public, throttled | Create user, mint token, send email |
| `POST /api/client/documents` | Clients | Upload |
| `GET, DELETE /api/client/documents/[id]` | Clients (own domain) | Download, delete |
| `GET, DELETE /api/portal/documents/[id]` | Directors | Unchanged |

`/portal(.*)` and `/api/portal(.*)` stay in the middleware's protected set with `/sign-in` as the unauthenticated destination. `/client(.*)` and `/api/client(.*)` join it with `/access` as the destination. `/access(.*)` and `/api/access` are public. The middleware does no role work; it has no database and no Clerk backend call.

All new pages are `noindex` and `force-dynamic`. `next-sitemap.config.js` already excludes `/portal` and `/sign-in`; `/access`, `/access/*`, `/client` and `/client/*` join that list.

## 5. Authentication and roles

### 5.1 Clerk

- Directors: unchanged. Invitation email, `/sign-up` with ticket, then `/sign-in`.
- Clients: Backend API `users.createUser` (no email from Clerk, no password) and `signInTokens.createSignInToken`. Restricted sign-up mode does not block either. The link is our own URL; Clerk's hosted URL on the token object is ignored.
- `ClerkProvider` in the root layout is unchanged. Its forced redirect to `/portal` applies only to Clerk's components, not to our ticket page, which navigates itself.
- Session token customisation in the Clerk dashboard is not required.

### 5.2 Actor resolution (`src/lib/portal/directors.ts`)

The module already fetches every Clerk user with a five-minute cache and an eight-second timeout. It is extended, not replaced:

```ts
export type ActorKind = "director" | "client";
export type Actor = { id: string; kind: ActorKind; email: string; name: string; initials: string };

export async function listDirectors(): Promise<Director[]>;      // kind === "director" only
export async function getDirector(id): Promise<Director | null>;  // unchanged
export async function getActor(id: string): Promise<Actor | null | "unknown">;
```

- The user list and the client domain list are fetched together; each user's kind comes from `actorKindFromSignals({ role: publicMetadata.role, email, clientDomains })` in `src/lib/portal/roles.ts` (pure, from PR #7).
- `getActor` answers from the fresh cache, then from a single `users.getUser(id)` fetch (eight-second timeout, result cached for five minutes), then from the last good list even if it has expired. It returns `"unknown"` only when Clerk cannot be reached and the id is in no cached list; `null` when Clerk says the user does not exist.
- `__resetDirectorsCache()` clears every cache. The client-domain actions call it after a change.

### 5.3 Gates (`src/lib/portal/auth.ts`)

- `requirePortalUser()` and `requireActionUser()` gain a role check after the session check: a client gets 403 `"This area is for directors only"` (or `{ ok: false, error }`); `"unknown"` gets 503 `"Directors could not be verified. Try again in a minute"`.
- `requireClientUser()` returns `{ userId, email, domain: ClientDomain }` or a `NextResponse`: 401 when signed out, 403 `"This area is for clients"` for directors, 403 `"Your organisation's access has been removed"` when the email's domain is not listed, 503 when unknown.
- The portal layout calls `getActor` and redirects clients to `/client`; on `"unknown"` it renders a notice instead of the desk. The client layout mirrors this.

### 5.4 Roles module (`src/lib/portal/roles.ts`)

Pure functions, adapted from PR #7: `isClientRole`, `actorKindFromSignals`, plus `clientActorId(email)` and `clientActorEmail(actorId)` for the `client:` activity actor ids. PR #7's `allowPortalAccess` is dropped in favour of the explicit three-way handling above.

## 6. Data model

### 6.1 Schema

```ts
export const clientDomains = pgTable(
  "client_domains",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull().unique(),           // lowercase host, no @
    pursuitId: text("pursuit_id").notNull().references(() => pursuits.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),              // Clerk user id of the director
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_domains_pursuit_idx").on(t.pursuitId)]
);

// documents gains:
clientDomainId: text("client_domain_id").references(() => clientDomains.id, { onDelete: "set null" }),
```

Deleting a pursuit cascades its domains (access ends with the matter) and its documents (already the case; the action deletes the S3 keys first). Removing a domain leaves its documents on the pursuit with `client_domain_id` null.

The uncommitted sketch on the working branch is replaced: `firm` is dropped (the pursuit carries the firm), `pursuit_id` becomes not null with cascade.

### 6.2 Migration

`drizzle/0003_client_domains.sql`, hand-written in the style of `0002_programmes.sql`, plus a journal entry with `idx: 3`:

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

No enum changes. `blob_url` and `blob_pathname` keep their names.

### 6.3 Queries (`src/lib/db/client-domains.ts`, `src/lib/db/documents.ts`)

```ts
listClientDomains(): Promise<Array<ClientDomain & { firm: string; stage: PursuitStage; fileCount: number }>>;
listClientDomainNames(): Promise<string[]>;      // 60 s cache, used by actor resolution
getClientDomain(id): Promise<ClientDomain | null>;
findClientDomainByName(domain): Promise<ClientDomain | null>;
insertClientDomain(values): Promise<ClientDomain>;
deleteClientDomain(id): Promise<boolean>;
listClientDocuments(clientDomainId): Promise<DocumentRow[]>;   // documents.ts, newest first
```

### 6.4 Throttle (`src/lib/db/throttle.ts`, `src/lib/portal/intake.ts`)

`registerAccessAttempt({ email, ip }, now)` reuses `bump` with keys `access-email:<sha256>` and `access-ip:<sha256>` (so counters never mix with the enquiry form's), caps 5 per 24 hours and 20 per hour, and returns `{ emailAllowed, ipAllowed }` via a pure `decideAccessThrottle`. It never touches the enquiry global alert cap. `hashKey` accepts the two new prefixes. `purgeExpiredThrottle` already covers the new rows.

## 7. Storage

`storePortalDocument` (`src/lib/portal/upload.ts`) gains two optional inputs:

```ts
clientDomainId?: string | null;   // sets documents.client_domain_id and the clients/ key prefix
actorId?: string;                 // activity actor; defaults to uploadedBy
```

Key when `clientDomainId` is set: `clients/{domain}/{id}-{fileName}` under the configured prefix, so the object is `meritus/clients/acme.co.uk/{uuid}-Letter.pdf`. The extract-then-put order, the 4 MB cap, the allow-list and the `file_added` activity are unchanged; the activity body for a client upload is `Added Letter.pdf` with `actorId: "client:jane@acme.co.uk"`.

`deletePursuit` already deletes every pursuit document's S3 key before removing the row, so client files are covered.

## 8. Email (`src/lib/access/mail.ts`)

Same Resend client, `from` and timeout as `sendEnquiryAlert`; a second use of the verified `meritusvia.com` sender.

```ts
export const ACCESS_LINK_MINUTES = 60;
export type AccessMailOutcome = { sentAt: string } | { error: string } | { skipped: "not_configured" };
export function accessLinkUrl(token: string): string;   // `${SITE_CONFIG.url}/access/continue?ticket=${encodeURIComponent(token)}`
export function accessMailSubject(): string;             // "Your Meritus file link"
export function accessMailText(input: { url: string; minutes: number }): string;
export async function sendAccessLink(to: string, url: string): Promise<AccessMailOutcome>;
```

Plain text body:

```
Open this link to send files to Meritus Via:

{url}

It works once and expires in 60 minutes. If you did not ask for it, ignore this email.

Meritus Via
```

The caller treats `skipped` as an error for the visitor (section 3.2) and never falls back to a Clerk email.

## 9. Request handling (`src/lib/access/request.ts`)

```ts
export type AccessRequestResult =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 403 | 429 | 502 | 503; error: string };
export async function requestAccessLink(input: { email: string; ip: string; now?: Date }): Promise<AccessRequestResult>;
```

Order: parse, mailbox and firm-domain checks, throttle, domain lookup, Resend configured, Clerk user find-or-create, token, send, revoke on send failure. Clerk and Resend failures are logged with the domain (never the token) and surface as the 502 message. The route handler at `src/app/api/access/route.ts` only parses JSON, reads `x-forwarded-for` through `firstHop`, calls this function and returns the status.

## 10. Screens and copy

All portal surfaces use the existing tokens and classes (`portal-field`, `portal-label`, `btn-secondary`, `btn-outline`, `panel-brackets`, `Eyebrow`, `Panel`, `ConfirmDialog`). British English, no em dashes, dates as `fullDate`.

### 10.1 `/portal/clients`

- Rail and top-bar nav: "Clients" between Programmes and Library.
- Eyebrow "Client access", h1 "Clients", lead: "Anyone with an email address at a listed domain can request a link at meritusvia.com/access and upload files to the pursuit. Personal mailboxes and meritusvia.com cannot be listed."
- Panel "Add a domain": Company domain (text, placeholder `acme.co.uk`), Pursuit (select), button "Add domain". Inline error or "Domain listed."
- Section "Listed domains": table as in 3.1, or "No client domains yet."

### 10.2 `/access`

Same shell as `/sign-in` (green grain, hallmark). Copy: "Send files to Meritus Via. Enter your work email. If your organisation has been given access, we will email you a link." Field "Work email". Button "Email me a link". Error below the field in oxblood. Success state per 3.2.

### 10.3 `/access/continue`

Same shell. "Opening your file desk…" while working; error state per 3.3.

### 10.4 `/client`

Green top bar (hallmark, eyebrow "Client files", email, sign-out). Body: heading "Files for Meritus", "Matter: {firm}", one sentence: "Upload pdf, docx, xlsx, images, txt, eml or msg files up to 4 MB each. The Meritus directors see them on this matter straight away." Then `FileList` with `uploadUrl="/api/client/documents"`, `documentsUrl="/api/client/documents"`, `showTextTag={false}`.

`FileList` gains those two optional props (defaults keep the desk unchanged) and, for the desk, a "client" tag when `DocumentSummary.fromClient` is true.

### 10.5 Dossier

`summariseDocument` adds `fromClient: boolean`. `ActivityTimeline` renders an actor id beginning `client:` as initials "Client" and the email as the name.

## 11. Error handling

- Every failure on `/access` is a clear sentence for the visitor and a `console.error` with the domain server-side. Tokens and API keys are never logged.
- `/access/continue` has exactly one failure state (expired, used or malformed link) plus the setup notice.
- Client routes return JSON errors in the same shape as the portal routes.
- A Clerk backend outage: `/access` returns the 502 message; `/client` and `/portal` show "could not verify" only when no cached list exists (section 5.2).
- Resend unset: `/access` says so; enquiry alerts keep their existing "skipped" behaviour.
- The setup flag list gains nothing; "Resend" stays optional because the desk works without it. The README says client access needs it.

## 12. Testing

Vitest, node environment for server modules, mocks in the style of `directors.test.ts` and `alerts.test.ts`.

| File | Covers |
|---|---|
| `src/lib/portal/domains.test.ts` | normalise, parse, public mailboxes, firm domain, email match |
| `src/lib/portal/roles.test.ts` | metadata and domain signals |
| `src/lib/db/throttle.test.ts` | `decideAccessThrottle` caps |
| `src/lib/access/mail.test.ts` | from, to, subject, text with link and 60 minutes, not configured, Resend error, timeout |
| `src/lib/access/request.test.ts` | each refusal in order, find vs create user (`skipPasswordRequirement`, metadata), token expiry 3600, revoke on send failure, no Clerk call when Resend unset |
| `src/app/api/access/route.test.ts` | JSON parsing, status mapping, IP from `x-forwarded-for` |
| `src/lib/portal/directors.test.ts` | clients excluded from `listDirectors`, `getActor` cache, single fetch, stale list on error, `"unknown"` |
| `src/lib/portal/auth.test.ts` | 403 for clients on portal gates, 503 on unknown, `requireClientUser` outcomes |
| `src/lib/portal/client-actions.test.ts` | add (validation, duplicate, missing pursuit, director-only), remove |
| `src/lib/portal/upload.test.ts` | `clients/{domain}/` key, `client_domain_id` stored, activity actor id |
| `src/app/api/client/documents/route.test.ts` | upload wiring, 403 for directors and unlisted domains |
| `src/app/api/client/documents/[id]/route.test.ts` | download and delete scoped to the caller's domain |
| `src/lib/portal/gate.test.ts` | pure route classification used by the middleware |

Manual checks before the PR is called done: director adds `example-firm.co.uk` on `/portal/clients`; `/access` with `jane@example-firm.co.uk` reports the email sent and Resend shows it; the link signs in and lands on `/client`; an upload appears under `meritus/clients/example-firm.co.uk/` and on the dossier; `someone@gmail.com` is refused; a director still signs in through `/sign-in`; a client opening `/portal` lands on `/client`.

## 13. Configuration and manual steps

- Env: nothing new. `RESEND_API_KEY` (already set on Vercel), the VeriCase S3 variables from PR #9 (William sets them on the existing `meritus` project after merge), Clerk keys as today.
- `.env.example`: one comment line under Resend: "Also sends client file links; without it `/access` refuses."
- Clerk dashboard: no change. Sign-up mode stays Invite-only.
- README: two sentences under a "Client file drop" heading: directors stay invite-only; clients use `/access` and a Resend link; files go to VeriCase S3.

## 14. Out of scope

Everything on the handover's do-not list, and in addition: activity entries for adding or removing a domain (the list is the record), a marketing-site link to `/access`, client visibility of anything beyond their own uploads and the firm name, per-user (rather than per-domain) file visibility, virus scanning, and Clerk session-token customisation.

## 15. Delivery

One branch, `cursor/client-domain-resend-93bc`, containing PR #9's commit. One PR on Meritus that supersedes PR #9 (or rebases onto `main` if #9 merges first). PR #7 is closed as superseded; its domain parsing, roles and `/portal/clients` UI are carried over, its login model and Vercel Blob wording are not. Before the PR: `npm test`, `npx tsc --noEmit`, `npm run lint`.
