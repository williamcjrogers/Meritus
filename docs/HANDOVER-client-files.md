# Handover: Meritus client file drop (VeriCase S3 + Resend)

Give this file to the next agent. Read it before touching code.

**Owner:** William Rogers  
**Date:** 12 September 2026  
**Product repo (ONLY place this work belongs):** `https://github.com/williamcjrogers/Meritus.git`  
**Local path:** `/Users/williamrogers/Projects/Meritus`  
**Do not use:** `/Users/williamrogers/Projects/WR2.0` (`williamcjrogers/WR2.0`). VeriCase is storage only.

William is tired of agents inventing adjacent work. Do the product below. Nothing else.

---

## What William asked for (in his words)

1. **Use VeriCase’s AWS S3** for Meritus file storage. Not Vercel Blob. Not a new bucket.
2. **Clients should not use Dropbox.** Directors add the client’s **company email domain** in the Meritus portal. Someone with that domain enters their work email, gets in, and **uploads documentation**.
3. **Do not revert to “normal logins.”** The Resend work stays. Clients get an **email link**, not a Clerk password / public sign-up form.

He is **not** asking for: BREE conflict ranking, Clerk DNS coding, WR2.0 app changes, a new Clerk app, or a new S3 bucket.

---

## The product (build this)

```
Director adds acme.co.uk on /portal/clients
        ↓
Client goes to a simple page (e.g. /access), types jane@acme.co.uk
        ↓
If that domain is on the list, Resend sends a one-click link
        ↓
They land on a small upload desk and put files in VeriCase’s S3 bucket
        ↓
Directors see those files on the matter (when the domain is linked to a pursuit)
```

Barriers this removes: “please use Dropbox / WeTransfer.”  
Feel it should be **less** than a product login: work email in, link in inbox, files up.

### Auth rules (do not break)

| Who | How they get in | Where they go |
|-----|-----------------|---------------|
| Directors (three partners) | Existing Clerk **invite-only**. Invitation email → `/sign-up` with ticket. Do **not** open public sign-up. | `/portal` pursuit desk |
| Clients | **Resend** sends a magic / ticket link. They type only their work email. No password. No partner SignIn widget as the happy path. | `/client` (or similar) upload desk only |

Keep Clerk as the session after the link is clicked (create user + `signInTokens.createSignInToken`, or invitation with `notify: false` and email **our** Resend message). Clerk must **not** send its own “set a password” mail if we can avoid it.

`listDirectors()` today is **every Clerk user**. The moment clients exist they will appear as directors unless you exclude them (`publicMetadata.role === "client"` and/or email domain on `client_domains`).

`meritusvia.com` and public mailboxes (`gmail.com`, `outlook.com`, `hotmail.com`, `yahoo.com`, `icloud.com`, `proton.me`, …) must not be addable as client domains.

### Storage rules

- Same AWS bucket VeriCase already uses in production.
- Key prefix `meritus/` so objects sit **beside** VeriCase objects, not on top of them.
- Env names VeriCase already uses (any of the aliases):

  `S3_BUCKET` or `MINIO_BUCKET`  
  `S3_REGION` or `AWS_REGION`  
  `AWS_ACCESS_KEY_ID` or `S3_ACCESS_KEY`  
  `AWS_SECRET_ACCESS_KEY` or `S3_SECRET_KEY`  
  `S3_KEY_PREFIX=meritus`

- Downloads stay on authenticated Meritus routes. Do not put raw S3 URLs or presigned public links in the browser.
- Portal uploads are capped at **4 MB** (`MAX_UPLOAD_BYTES` in `src/lib/portal/files.ts`).
- Keep DB columns `blob_url` / `blob_pathname`. No rename migration. New rows store `s3://bucket/key` and the S3 key.

VeriCase storage reference (read-only): `WR2.0/vericase/api/app/storage.py` and `WR2.0/vericase/.env.example`. Do not commit WR2.0.

### Resend (already built — extend it, do not replace it)

Resend is live and was paid for. Enquiry alerts already go through it:

- `src/lib/portal/alerts.ts` — `sendEnquiryAlert`, 8s timeout, plain text, `ENQUIRY_ALERT_FROM` default `enquiries@meritusvia.com`
- `src/lib/portal/alerts.test.ts`
- `isResendConfigured()` in `src/lib/env.ts`
- Vercel has `RESEND_API_KEY` (commit `2aaa151` was a redeploy to pick it up)
- Domain `meritusvia.com` is verified in Resend (EU), sender `enquiries@meritusvia.com`

Client access mail should reuse that client: same `from`, same timeout/error style, new subject/body (“Your Meritus file link”). If Resend is unset, fail clearly — do not silently fall back to Clerk’s invitation email or a password form.

---

## What is already done (use it)

### PR #9 — VeriCase S3 for portal uploads (KEEP)

- URL: https://github.com/williamcjrogers/Meritus/pull/9  
- Branch: `cursor/vericase-s3-storage-93bc` @ `eff7963`  
- `feat(portal): store uploads on VeriCase AWS S3`

`@vercel/blob` is removed. `@aws-sdk/client-s3` is added.

| File | Role |
|------|------|
| `src/lib/portal/s3.ts` | `readS3Config`, `putObject`, `getObject`, `deleteObjects`, prefix `meritus/` |
| `src/lib/portal/s3.test.ts` | Config + key prefix tests |
| `src/lib/portal/upload.ts` | Extract text, then `putObject`; stores `s3://…` + key |
| `src/lib/portal/actions.ts` | `deletePursuit` deletes S3 keys (`blobPathname`), not Blob URLs |
| `src/app/api/portal/documents/[id]/route.ts` | GET/DELETE via S3 |
| `src/app/api/portal/library/route.ts` | Setup message: “VeriCase S3 is not configured” |
| `src/lib/env.ts` | Setup flag **VeriCase S3** |
| `.env.example` | S3 vars; `BLOB_READ_WRITE_TOKEN` gone |

Tests on that commit: 106 passed (s3 / upload / actions / documents route). `npx tsc --noEmit` passed.

**After merge, William still has to set those S3 vars on the existing Vercel project `meritus` (team Quantum Commercial Solutions).** Do not create a new Vercel project.

Old rows that still point at Vercel Blob URLs will 404 until re-uploaded. Acceptable.

### Clerk / domain (operational, do not recode)

- Site: `https://www.meritusvia.com`  
- Clerk is Vercel Marketplace **meritus-portal** on app `app_3J3OS9DPpQ9DoqzOoXRxlFPROS1`  
- Custom domain `clerk.meritusvia.com` is verified; TLS issued  
- Production access mode should stay **Invite-only** for directors  
- Empty Clerk org `org_3J9bm2GTqKFHxNC9ScEQUXUXxb0` is **not** the Meritus app — ignore it  
- Day-to-day director login: `https://www.meritusvia.com/sign-in` **after** they have accepted the invite email. Copy on `/sign-in` and `/sign-up` is correct for directors. Do not “fix” that into a public SignUp.

### Resend / enquiry path (do not rip out)

Public contact form → Neon pursuit + activity → Resend alert to directors. That pipeline is finished. Client file-drop mail is a **second** Resend use of the same key/domain.

---

## What exists but is the WRONG shape (do not merge as-is)

### PR #7 — draft, wrong login model

- URL: https://github.com/williamcjrogers/Meritus/pull/7  
- Branch: `cursor/client-login-vericase-b3e1`  
- Title: “Client login by company domain with VeriCase dump”

This is the closest prior attempt. **Steal the domain/UI pieces. Do not steal the login model.**

Reusable:

- `src/lib/portal/domains.ts` (+ tests) — parse domain, reject public mailboxes and `meritusvia.com`
- `src/lib/db/client-domains.ts`, drizzle `0002_client_domains.sql` (note: on **current** `main` after #8, programmes already used `0002`. Renumber.)
- `/portal/clients` page, `ClientDomainForm`, `ClientDomainList`
- Role/gate helpers: `roles.ts`, `gate.ts`, directors filter
- Client desk shell (`/client`, `DumpZone` idea)

Wrong / outdated:

- Client “login” is still **Clerk invite + `/client/sign-in` + `/client/sign-up`**. William called that reverting to normal logins.
- PR text says **portal uploads stay on Vercel Blob**. That is obsolete; #9 moved them to S3.
- Clerk allowlist sync as the way clients join. Invite-only + allowlist is not “type your work email, Resend sends a link.”
- Example domain in the PR body is `bree.co.uk`. William has **no BREE contract**. Do not use BREE as the worked example.

### PR #6 and `cursor/drop-bree-conflict-ranking-dbdc`

Prospect ranking / BREE framing. **Out of scope.** Do not mix into this work. `origin/main` already has programme intelligence (#8) and an older BREE ranking commit (`ca94d21`). Leave ranking alone unless William asks.

### Local dirty work (this machine, 12 Sep)

Branch `cursor/client-domain-resend-93bc` was started from #9 (`eff7963`).

Uncommitted and **incomplete**:

- `src/lib/db/schema.ts` — added `clientDomains` table and `documents.clientDomainId`

Nothing else for client access was finished (no migration, no Resend link, no `/access`, no `/client` page). Treat that schema edit as a sketch. Finish it properly with a drizzle migration (`0003_…` — `0002_programmes.sql` already exists on this line of history) or discard and take the better table from PR #7.

`feat/vericase-s3-storage` on the remote was deleted after the rename to `cursor/vericase-s3-storage-93bc`.

---

## Recommended way to finish

1. Branch from `cursor/vericase-s3-storage-93bc` (or from `main` after #9 merges). Do not branch from PR #7.
2. Copy domain parsing + `/portal/clients` UI from PR #7. Wire add/remove to Postgres.
3. Public `/access`: one email field. If domain is listed, create/find Clerk user with `publicMetadata.role = "client"`, `signInTokens.createSignInToken`, **Resend** the continue URL (`/access/continue?ticket=…`). Same generic success if you need to avoid email enumeration; be honest if the domain is not listed (“that organisation has not been given access”).
4. `/access/continue` uses Clerk `signIn.create({ strategy: "ticket", ticket })` + `setActive`. Redirect to `/client`. No password fields.
5. `/client` is FileList-class upload only. Files go through existing `putObject` (`src/lib/portal/s3.ts`). Prefix like `meritus/clients/{domain}/…`. If the domain has a `pursuitId`, also attach the document to that pursuit so it shows on the dossier.
6. Middleware: `/portal` and `/api/portal/*` are **directors only**. `/client` and `/api/client/*` are **clients** (or directors helping). Clients hitting `/portal` redirect to `/client`.
7. `listDirectors` excludes `role === "client"`.
8. Rate-limit `/access` (see `src/lib/db/throttle.ts`; do not share the enquiry global alert cap).
9. Tests: domains, Resend access mail, ticket request (Clerk mocked), director-only APIs, upload still hits S3 not Blob.
10. README: two sentences — directors stay invite-only; clients use `/access` + Resend; files go to VeriCase S3.
11. One PR on **Meritus**. Update #9 if you are only finishing S3 env docs; otherwise a new PR that **includes** #9’s commit.

Vercel project (already linked): team `quantum-commercial-solutions`, project `meritus` / `prj_c2fS1s9yqPD4AnuHZ5DJlk0xqQFP`. Set S3 env there. Do not print secrets.

---

## How this codebase works (Meritus)

- Next 15, React 19, vanilla app router, **no** extra framework.
- Clerk 7, Drizzle 0.45 on Neon, Resend, AI SDK via Vercel AI Gateway.
- Portal is vanilla-ish React with existing classes: `portal-field`, `btn-secondary`, `panel-brackets`, `Eyebrow`. Match that. Do not restyle the marketing site.
- Tests: Vitest. `npm test` from the Meritus root. No pytest fixtures mindset — this is not VeriCase.
- Migrations: `drizzle/*.sql` + `drizzle/meta/_journal.json`. Build runs `scripts/migrate.mjs`. Current files: `0000_pursuit_desk`, `0001_prospects`, `0002_programmes`. Next is **0003**.
- Auth helpers: `src/lib/portal/auth.ts` (`requirePortalUser`, `requireActionUser`). Actions live in `src/lib/portal/actions.ts` and return `{ ok }` — they do not throw-redirect.
- Upload helper: `storePortalDocument` in `src/lib/portal/upload.ts`.
- Directors: `src/lib/portal/directors.ts` (Clerk user list, 5 min cache, 8s timeout).

---

## Explicit do-not list

- Do not open Clerk production sign-up. Invite-only stays for directors.
- Do not add a password form for clients.
- Do not drop or bypass Resend.
- Do not put files on Vercel Blob again.
- Do not create a second S3 bucket or a second Vercel project.
- Do not implement this in WR2.0 / VeriCase application code.
- Do not continue BREE ranking or “conflicted firm” copy.
- Do not recode Clerk DNS. It is done.
- Do not commit `.env.local` or print AWS / Clerk / Resend secrets.
- Do not treat `listDirectors()` as safe once clients can exist.

---

## Checks before you call it done

```
cd /Users/williamrogers/Projects/Meritus
npm test
npx tsc --noEmit
```

Manually (or say you could not): director adds `example-firm.co.uk` → `/access` with a matching email → Resend would send → after ticket, upload lands in S3 under `meritus/`. A gmail address is refused. A director still uses the invitation / `/sign-in` path.

---

## If William only has five seconds

**Meritus. VeriCase S3 for files. Resend link for clients after a domain is added. Clerk invite-only for directors. No Dropbox. No password login. No WR2.0. No BREE.**
