# Owners' requirements for the Meritus backend

Date: 12 September 2026 (cut down the same day: VeriCase handles operations; Meritus holds the data)
Repository: williamcjrogers/Meritus
Branch: cursor/client-domain-resend-93bc
Status: for William Rogers to review

## 1. Purpose

The Meritus backend holds the data. That is all it does. It receives enquiries, lets the three directors work a pursuit to instruction, and gives clients a door for sending documents. Everything else about running a practice on that data (audit, retention, erasure, export, health, reporting, handover) is VeriCase's job and is out of scope here. The backend's obligation to VeriCase is to store what it holds where VeriCase can read it, under keys and rows that will not change.

Two roles exist: director and client. William invites directors through Clerk. Clients arrive by typing a work email at an allow-listed company domain and clicking a Resend link.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Role of the backend | Hold the data. VeriCase handles operations |
| Users | The three directors, plus clients dropping files. Two roles, nothing else |
| Boundary | Clients keep dropping files for the whole matter; VeriCase reads them from the shared bucket |
| Memory | No party register. The "Previously" related-pursuits line is enough |
| Client upload cap | 50 GB per file, by S3 multipart upload |
| Delivery | One slice: the client file drop on this branch, then its implementation plan |

## 3. Requirements

Each requirement carries a size (S, M, L). All ship in the one slice.

**What it holds**

- **R1 (S) Data VeriCase can read.** Client files live in the shared bucket under `meritus/clients/{domain}/{pursuitId}/{uuid}-{name}`. Each `documents` row carries the S3 key, size, uploader email, time and the pursuit. Keys and rows never change after upload, so VeriCase can ingest from the prefix and the table without a handover step. Pursuits and activity stay as they are.
- **R2 (M) A domain is not a matter.** One law firm's domain will cover several pursuits over time. Domains link to pursuits through a join table, not the one-pursuit-per-domain column in the current sketch. The upload desk lists that domain's live matters and the client picks one; a director can also issue a per-matter link. Files always land on the right matter.

**Who can touch it**

- **R3 (M) Roles.** Every Clerk user carries `publicMetadata.role`, `director` or `client`. Middleware checks it, and every portal route, server action and page checks it again. `/portal` and `/api/portal/*` admit directors only; `/client` and `/api/client/*` admit clients or directors. A client who reaches `/portal` is sent to `/client`.
- **R4 (S) Directors are an explicit list.** A director is a user with `role = director`. `listDirectors()` and the questions-drawer prompt read only from that list. A client is never an owner.
- **R5 (S) Scope on every read.** Every read, download and delete of a document checks scope on the server. Directors see all. A client sees only files from their own domain and nothing of the pursuit.
- **R6 (S, AWS console not code) Own IAM principal.** Meritus uses its own IAM principal limited to Get, Put and Delete under `meritus/*` in the shared bucket. VeriCase's production keys are never set on the Meritus Vercel project. A Meritus bug must not be able to touch VeriCase objects.

**The client door**

- **R7 (L) The file drop** as `docs/HANDOVER-client-files.md` describes: `/portal/clients` for domains, `/access` for the work email, a Resend link, `/access/continue` ticket sign-in, the `/client` upload desk, files on the pursuit. Links are single use and expire; `/access` is rate limited on counters separate from the enquiry throttle; public mailbox domains and `meritusvia.com` cannot be added. `/access` gives the same reply whether or not the domain is listed, so nobody can probe which firms are Meritus clients; the handover allowed this choice.
- **R8 (L) Files up to 50 GB.** The upload leg goes direct to S3 by multipart upload: the server opens the upload and signs each part for a key it chose; the browser sends parts with progress; the server completes the upload and writes the row after verifying the object. A single presigned PUT stops at 5 GB, so multipart is the only route. Meritus aborts uploads it knows about after 24 hours. Text extraction for the questions drawer runs after upload from S3 and only for files under a threshold; larger files are stored with "no text". Downloads above 100 MB cannot pass through a Vercel function, so a director route issues a single-object presigned GET that expires within a minute and redirects; smaller files stay on the proxied route. This is the one exception to the handover's "no presigned links in the browser". Director uploads on the desk keep the 4 MB path.
- **R9 (S) The pursuit shows what arrived.** Each client upload writes a `client_file_added` activity on the pursuit with the uploader's email, so the desk shows what came in and when. No emails.

## 4. Out of scope: VeriCase's job

Audit trail beyond the activity table; soft delete, undelete and tombstones; retention dates, legal hold, purge and subject access; export, zips and manifests; health checks, alerts and status lines; runbooks and key holders; AI usage logging; the weekly digest; source and conversion reporting; concluded dates and VeriCase references; receipts and upload emails; client withdrawal of files; malware scanning; magic-byte checks; log hygiene; privacy policy edits.

Also out of scope, as before: BREE ranking or "conflicted firm" copy; a party register; password login for clients; Vercel Blob; a second bucket or Vercel project; changes to WR2.0 or VeriCase; fee fields; search; analyst, PA or counsel roles.

## 5. Differences from the handover

Where this spec and `docs/HANDOVER-client-files.md` differ, this spec wins. The differences are three: the generic reply on `/access` (R7), the 50 GB cap with a presigned route for large downloads (R8), and the domain-to-pursuit join (R2).
