# Owners' requirements for the Meritus backend

Date: 12 September 2026
Repository: williamcjrogers/Meritus
Branch: cursor/client-domain-resend-93bc
Status: for William Rogers to review

## 1. Purpose

This document states what the three directors of Meritus Group Ltd need from the backend behind meritusvia.com, as owners of the practice rather than as users of any one screen. It ranks those needs, sets requirements against each, and fixes the order in which the work ships. Each slice then gets its own design and its own implementation plan.

The backend is the practice's front office. It receives enquiries, carries a pursuit to instruction, is the client's door for sending documents for the life of the matter, and keeps the record of what came in and what the directors did with it. VeriCase is the case engine: evidence, analysis and work product. The backend never re-keys into VeriCase; it hands over by copying or pointing.

Two roles exist: director and client. William invites directors through Clerk. Clients arrive by typing a work email at an allow-listed company domain and clicking a Resend link.

## 2. Where the backend stands

The code on 12 September 2026 does these things well: intake from the public form (honeypot, throttle, alert, double-submission handling); the pursuit desk, which matches how three directors work a pipeline; the brief, which separates FACT from INFER and cites sources; migrations that run on deploy; and files on VeriCase's S3 bucket under a `meritus/` prefix, which makes a later handover cheap.

It exposes the owners in these ways:

- Any signed-in Clerk user reaches every pursuit, file, brief, programme and prospect. There is no role. `listDirectors()` returns every Clerk user. The client file drop breaks this model unless a role split ships with it.
- Every delete is hard. The activity trail is per pursuit and is cascade-deleted with it. The library, prospects, programmes, field edits, downloads and sign-ins leave no trail.
- There is no backup or restore path, no export, no retention sweep, no health check, and no monitoring beyond `console.error` in Vercel logs.
- The privacy policy promises six-year retention for enquiries, per-matter isolation, UK or EEA storage, and UK GDPR rights. The backend implements none of it, and the residency claim is untrue for Clerk and the AI providers.
- One email exists in the whole system: the enquiry alert.
- AI spend is uncapped and unlogged.

## 3. Decisions taken in the brainstorm

| Topic | Decision |
|---|---|
| Output | An owners' requirements spec, ranked, driving the next pieces of work |
| Users | The three directors, plus clients dropping files. Two roles, nothing else |
| Boundary | Meritus is the front door for the whole matter; VeriCase holds evidence and analysis; files are copied or pointed across, never re-uploaded |
| Memory | No party register. The "Previously" related-pursuits line is enough |
| Continuity | The other directors must know when it is broken, get the data out, and restore after a mistake. Adding and removing people stays with William |
| Retention | Soft delete everywhere, a 30-day purge window, a monthly review email, one director confirms the purge, erasure by the same path |
| Visibility | A weekly digest email and a source and conversion page. No fee fields, no search |
| Delivery | One spec, three slices, each with its own design and plan |
| Slice A scope | Keep every addition the reviews raised; each is small, and the two largest decide whether clients use it at all |
| Client upload cap | 50 GB per file, by S3 multipart upload |
| Alerts | Health failures and AI spend alerts go to all three directors |
| Residency | Correct the privacy policy; clients hold only an email address in Clerk |

Two independent read-only reviews, one from a practice owner's seat and one from a security and UK GDPR seat, were run against the draft. Their accepted findings appear in section 4. On the owner review's argument, AI calls are logged with cost and a threshold alert rather than stopped at a cap: a cap that blocks a brief mid-enquiry costs more than the tokens.

## 4. The seven owner needs and their requirements

Each requirement carries an id, a slice (A client front door, B foundation, C owners' view) and a size (S, M, L).

### N1 Control: know who can see what, revoke instantly, keep a trail that outlives the record

- **R1.1 (A, M) Roles.** Every Clerk user carries a role, `director` or `client`, in `publicMetadata.role` and in the session claims. Middleware checks it, and every portal route, server action and page checks it again. Unknown or missing roles are denied. `/portal` and `/api/portal/*` admit directors only; `/client` and `/api/client/*` admit clients or directors. A client who reaches `/portal` is sent to `/client`. In production the middleware fails closed when Clerk is not configured, instead of passing everything through as it does today.
- **R1.2 (A, S) Directors are an explicit allow-list.** A director is a user with `role = director`, set by William. Never "all Clerk users" and never "not a client". The directors list, the owner picker, actor names and the questions-drawer prompt (which today names every Clerk user as a director) read only from this list.
- **R1.3 (A, S) Scope on every read.** Every read, download and delete of a document or pursuit checks scope on the server. Directors see all. A client sees only documents whose domain is their own, and nothing of the pursuit, brief, notes or other domains. The document route today trusts the id alone.
- **R1.4 (A, M) One audit table.** An append-only audit table, separate from per-pursuit activity, never cascade-deleted, kept six years. Slice A records: access link issued and redeemed, client sign-in, client upload and withdrawal, director download of a client file, domain added and removed. Each row holds actor, role, the actor's name at the time, object, hashed first-hop IP and time. Slice B adds export run, soft delete, undelete, purge confirmed, retention date changed, matter concluded and AI threshold changed.
- **R1.5 (B, M) Activity survives deletion.** A soft-deleted pursuit keeps its activity. At purge a tombstone remains (pursuit id, firm, stage, created, purged at, purged by, reason) with all personal data removed.
- **R1.6 (B, S) Audit page.** The audit table gains the firm-level events in R1.4, and directors see a filterable audit page in the portal.
- **R1.7 (A, S, AWS console not code) Own IAM principal.** Meritus uses its own IAM principal limited to Get, Put and Delete under `meritus/*` in the shared bucket, with no listing outside it. VeriCase's production keys are never set on the Meritus Vercel project. The prefix is a naming convention; only IAM makes it a boundary. Bucket-level settings (versioning, lifecycle, access logging, TLS-only) belong to VeriCase and are recorded in the runbook as dependencies on which the purge and audit promises rest.
- **R1.8 (B, S) Names stored at write time.** Actor name and initials are stored on activity, documents and audit rows when written, so a removed director's matters never read "unknown". The digest flags pursuits owned by a removed user.

### N2 Continuity: the firm runs without William

- **R2.1 (B, M) Health.** A health check verifies Postgres, S3, Clerk, Resend and the AI Gateway on a schedule. A failure emails the directors once per incident, with a recovery email when it clears. The portal footer shows a status line.
- **R2.2 (B, M) The pursuit zip is the record.** One download holds the dossier as JSON, the activity, the brief, the questions thread, the document records and the files, with a manifest of SHA-256 hashes. It answers an insurer, a tribunal or a buyer. A second export, "export everything", writes every pursuit, activity entry, note, brief and document record as CSV and JSON for a sale or wind-up. Both stream, so Vercel limits do not bite.
- **R2.3 (B, M) Restore.** Soft delete with a 30-day window and an "Undelete" list in the portal for pursuits and documents. Neon point-in-time restore is enabled and its retention window recorded. A restore is rehearsed once and the date recorded.
- **R2.4 (B, S) Dependency, cost and undo register.** `docs/RUNBOOK.md` records, for Vercel, Neon, Clerk, Resend, the AI Gateway, AWS, Companies House and the domain registrar: account holder, backup admin, monthly cost, which env vars exist (names only), who can rotate what, whether point-in-time restore and S3 versioning are on, and how to restore, export and confirm a purge.
- **R2.5 (B, not code) A second key holder.** A named second director holds admin on Clerk, Vercel, Neon, Resend and the AWS identity. Adding and removing people stays with William day to day, but continuity needs a second key holder, or William is the single point of failure this need exists to remove.

### N3 Low burden: managed services, one alert, bounded cost

- **R3.1 (B, S) AI usage log.** Every AI call is logged with model, tokens in and out, estimated cost in GBP, pursuit, actor and purpose (brief, question, research). A monthly threshold in env sends one email when crossed. There is no hard stop.
- **R3.2 (B, S) One alert channel.** Health failures and threshold alerts go to all three directors, the same recipients as the enquiry alert, deduplicated per incident.
- **R3.3 (all) No new infrastructure.** Vercel, Neon, Clerk, AWS S3, Resend and the AI Gateway only.

### N4 A Monday-morning view

- **R4.1 (C, M) Weekly digest.** One plain-text email through Resend to every director on Monday at 07:00 Europe/London: unowned enquiries; pursuits moved by stage; overdue next actions by owner; dormant pursuits due for revisit; client files dropped and not yet downloaded; pursuits owned by a removed user; health incidents in the week; AI spend month to date; pursuits due for retention review. Each item links into the portal.
- **R4.2 (C, M) Source and conversion.** A page at `/portal/reports` shows, for a chosen period (this quarter, last quarter, twelve months, all time): pursuits by source; outcome per source (instructed, declined, dormant, open); median days in each stage; and referrers (`source_detail`) ranked by instructions. Server-rendered tables with a CSV download. No charts in the first version.

### N5 Professional obligations: retention, erasure, no party register

- **R5.1 (A, S) No party register.** There is no party register and no conflict concept. The "Previously" line stays as it is.
- **R5.2 (B, M) Conclusion and retention dates.** A director can mark an instructed matter concluded (`concluded_at`); without it retention has no clock. Every pursuit has a retention date. The default is six years from creation for enquiry, declined and dormant (the policy's "up to six years", which also preserves the "Previously" memory), and six years from conclusion for instructed, which a director may extend to fifteen at conclusion for engagements under deed. A director may edit the date; the change is audited.
- **R5.3 (B, M) Reviewed purge.** A monthly email lists pursuits past their retention date. A director confirms the purge in the portal. A pursuit under legal hold (a flag a director sets, audited) is never listed or purged. Purge reaches every copy: S3 objects, `extracted_text`, AI usage rows, briefs, questions, export archives, the client's Clerk user when no other matter needs it, and pending access tokens. It leaves the tombstone.
- **R5.4 (B, M) Subject access and erasure.** For one email address a director can produce everything held (pursuit fields, enquiry submissions in activity meta, documents by uploader, questions, briefs, audit rows and the Clerk record) as JSON within the month the policy promises, and can soft-delete it for purge where no retention ground applies. This uses the retention path.
- **R5.5 (A, S) No personal data in logs.** Application logs carry ids and hashed emails only: never names, addresses, file names, document text or prompts. The contact route logs the enquirer's firm and email to Vercel today, and the extractor logs file names; both stop. The single exception stays: when the store fails, the enquiry is emailed to the directors under a "NOT SAVED" subject.
- **R5.6 (B, S) Processor register.** The runbook lists each processor with region and transfer basis: Vercel, Neon, Clerk (United States), AWS, Resend (EU), OpenAI and Perplexity through the AI Gateway (United States), Companies House. The privacy policy is corrected to name the processors and regions rather than moving client identity off Clerk; clients hold only an email address there. The policy edit is a marketing-site task, flagged and not done in these slices.

### N6 Client trust: lighter than Dropbox, with a receipt on both sides

- **R6.1 (A, L) The file drop.** As `docs/HANDOVER-client-files.md` describes: `/portal/clients` for domains, `/access` for the work email, a Resend link, `/access/continue` ticket sign-in, the `/client` upload desk, files under `meritus/clients/{domain}/`, attached to the chosen pursuit.
- **R6.2 (A, M) A domain is not a matter.** One law firm's domain will cover several pursuits over time, and the schema sketch's one-domain-one-pursuit link is where "wrong file" starts. Domains link to pursuits through a join table. The upload desk lists that domain's live matters and the client picks one. A director can also issue a per-matter link.
- **R6.3 (A, S) Receipt both ways.** The client sees their uploads with time and size. After each upload batch Resend sends "We received n files". The pursuit gets a `client_file_added` activity and the owner director is emailed (all three when unowned).
- **R6.4 (A, S) Withdraw a file.** A client can see what their firm has sent and withdraw a file they uploaded themselves. It soft-deletes into the same 30-day purge and the activity reads "withdrawn by client". This removes the "that was privileged, please delete it" call. Withdrawal is limited to the uploader's own address because anyone with a mailbox at the domain can get in.
- **R6.5 (A, M) Link and domain rules.** Access links are single use, bound to the typed address, and expire after thirty minutes; re-requesting is one click and the page says so. Redemption is audited with hashed IP and user agent. Client sessions end within 24 hours with no remember-me. Link requests and sign-in attempts are rate limited per email, per IP and globally, on counters separate from the enquiry throttle. `/access` gives the same reply whether or not the domain is listed ("If that organisation has been given access, a link is on its way"), because an honest "not listed" tells a counterparty which firms are Meritus clients; the handover allowed this. Domains are exact match, refused against a maintained deny-list of consumer, ISP and hosted-mailbox providers and `meritusvia.com`, and the adding director confirms the client controls the whole domain. Removing a domain soft-deletes the domain row (never nulls the documents' link, which erases provenance) and revokes that domain's sessions and pending tokens at once.
- **R6.6 (A, S) Desk basics.** The desk works from a phone, shows per-file progress, states the allowed types and size limit before upload, names the directors who will see the files, and links to the privacy policy. The first impression is a solicitor's PA at six in the evening.
- **R6.7 (A, L) Big files, up to 50 GB per file.** At 4 MB clients are back on WeTransfer on day one. The consequences of 50 GB, stated so nobody is surprised:
  - The upload leg goes direct to S3 by multipart upload. The server opens the upload and signs each part for one key it chose; the browser sends parts with per-part progress; the server completes the upload and records the row only after verifying the object. A single presigned PUT stops at 5 GB, so multipart is the only route. Uploads are resumable within 24 hours because 50 GB over an office connection takes hours.
  - Abandoned parts cost money until removed. Meritus aborts uploads it knows about after 24 hours. The bucket-level lifecycle rule for incomplete multipart uploads is a VeriCase setting and goes in the runbook (R1.7).
  - Text extraction moves to after upload, reads from S3, is bounded by size (files above a threshold are stored with "no text"), is best effort, and never delays the receipt.
  - Downloads above 100 MB (a default the slice A design may tune) cannot stay on a Meritus route, because a Vercel function cannot proxy a file of that size within its limits. For those, an authenticated director route issues a single-object presigned GET that expires within a minute, writes the audit row, and redirects. Small files stay proxied and streamed. This is a deliberate exception to the handover's "no presigned links in the browser", which cannot hold at 50 GB without new infrastructure.
  - The 4 MB path stays for director uploads on the desk unless it proves a nuisance; the multipart path is built for clients first.
- **R6.8 (A, S) Upload hygiene.** Uploads are validated by magic bytes as well as extension, stored with a server-chosen content type (today the uploader's declared MIME is served back), served as attachments with nosniff, and tagged with origin (director or client) on the row. Client-origin text is labelled as client-supplied, untrusted material wherever it enters a prompt, and reaches a model only through a director's action in the questions drawer, never silently into the brief. Provider no-training settings are recorded in the runbook.
- **R6.9 (later) Malware scanning.** Scanning uploads before a director can download, done AWS-side on the prefix. Three directors opening client-supplied `.msg`, `.eml` and PDF files is the likeliest compromise path, but this is not in the first three slices.

### N7 Front office to engine: a clean handover to VeriCase

- **R7.1 (C, S) VeriCase reference.** A director sets a VeriCase case reference on the pursuit; the desk shows it as a link.
- **R7.2 (C, S) Handover manifest.** The manifest is the one the pursuit zip carries (R2.2): every document's S3 key, title, uploader, time and SHA-256. A director can download it on its own, and it is stable enough for VeriCase to ingest later. Copying into VeriCase's prefix is VeriCase-side work and out of scope here.

## 5. Slices and order of delivery

| Slice | Contents | When |
|---|---|---|
| A Client front door | R6.1 to R6.8, R1.1 to R1.4, R1.7, R5.1, R5.5 | Now, on this branch. It is in flight and carries only the foundation a client-facing door cannot ship without |
| B Foundation | R1.5, R1.6, R1.8, R2.1 to R2.5, R3.1, R3.2, R5.2 to R5.4, R5.6 | Next |
| C Owners' view | R4.1, R4.2, R7.1, R7.2 | After B, because the digest reads the health, AI spend and retention state that B creates |

Each slice gets its own design review and its own implementation plan through the writing-plans skill. The handover document remains the reference for slice A's file drop; where this spec and the handover differ, this spec wins, and the differences are the `/access` reply (R6.5), the upload cap and the large-file download route (R6.7), and the domain-to-pursuit join (R6.2).

## 6. Non-goals

BREE ranking or "conflicted firm" copy; a party register; password login for clients; Vercel Blob; a second bucket or a second Vercel project; changes to WR2.0 or VeriCase; fee or value fields; cross-pursuit search (a type-to-filter box on the existing stage lists would be small if wanted later, but it is not in these slices); analyst, PA or counsel roles; two-way sync with VeriCase; malware scanning in these slices; charts on the reports page; a hard AI spending stop.

## 7. Known risks accepted by the decisions

- A domain-wide magic link with no second factor means anyone who can read a mailbox at the domain (a leaver with forwarding, `info@`, a compromised account) is a client user for the life of the matter. Identity is as strong as the client's email tenancy. Mitigations: R6.4, R6.5, R1.4, and the director sees who uploaded what.
- The shared bucket's versioning, lifecycle and access logging are VeriCase's settings. Meritus controls only its IAM policy, so the purge and audit promises rest on settings recorded in the runbook and not owned by this codebase.

## 8. Still to name

The second key holder (R2.5), to be named in the runbook when it is written.
