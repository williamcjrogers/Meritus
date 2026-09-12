# Owners' requirements for the Meritus backend

Date: 12 September 2026 (cut down twice the same day: the backend is a static document hold; VeriCase processes)
Repository: williamcjrogers/Meritus
Branch: cursor/client-domain-resend-93bc
Status: for William Rogers to review

## 1. Purpose

The Meritus backend is a static document hold. Clients put documents in; the documents sit in VeriCase's bucket; VeriCase reads and processes them. The backend processes nothing. Beyond the hold it keeps doing what it does today: enquiries in, the directors' pursuit desk.

Two roles exist: director and client. William invites directors through Clerk. Clients arrive by typing a work email at an allow-listed company domain and clicking a Resend link.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Role of the backend | A static document hold. VeriCase can read anything and processes the rest |
| Users | The three directors, plus clients dropping files. Two roles, nothing else |
| Client upload cap | 50 GB per file, by S3 multipart upload |
| Delivery | One slice: the client file drop on this branch, then its implementation plan |

## 3. Requirements

**The hold**

- **R1 (S) Files sit still.** Client files go to the shared bucket under `meritus/clients/{domain}/{uuid}-{name}` with one `documents` row each: S3 key, size, uploader email, time, domain, and the pursuit when the domain is linked to one. Nothing is extracted, parsed or analysed. Rows and keys never change after upload.
- **R2 (L) Files up to 50 GB.** The upload leg goes direct to S3 by multipart upload: the server opens the upload and signs each part for a key it chose; the browser sends parts with progress; the server completes the upload and writes the row after verifying the object. A single presigned PUT stops at 5 GB, so multipart is the only route. Meritus aborts uploads it knows about after 24 hours. Director uploads on the desk keep the 4 MB path.
- **R3 (S) Files come back out.** The desk lists a linked pursuit's client files with the existing download route. Above 100 MB a Vercel function cannot proxy the file, so the route issues a single-object presigned GET that expires within a minute and redirects. This is the one exception to the handover's "no presigned links in the browser".

**The door**

- **R4 (L) The file drop** as `docs/HANDOVER-client-files.md` describes: `/portal/clients` for domains, `/access` for the work email, a Resend link, `/access/continue` ticket sign-in, the `/client` upload desk. Links are single use and expire; `/access` is rate limited on counters separate from the enquiry throttle; public mailbox domains and `meritusvia.com` cannot be added. `/access` gives the same reply whether or not the domain is listed, so nobody can probe which firms are Meritus clients; the handover allowed this choice.

**Who can touch it**

- **R5 (M) Roles.** Every Clerk user carries `publicMetadata.role`, `director` or `client`. Middleware checks it, and every portal route, server action and page checks it again. `/portal` and `/api/portal/*` admit directors only; `/client` and `/api/client/*` admit clients or directors. A client who reaches `/portal` is sent to `/client`.
- **R6 (S) Directors are an explicit list.** A director is a user with `role = director`. `listDirectors()` and the questions-drawer prompt read only from that list. A client is never an owner.
- **R7 (S) Scope on every read.** Every read, download and delete of a document checks scope on the server. Directors see all. A client sees only files from their own domain and nothing of the pursuit.
- **R8 (S, AWS console not code) Own IAM principal.** Meritus uses its own IAM principal limited to Get, Put and Delete under `meritus/*` in the shared bucket. VeriCase's production keys are never set on the Meritus Vercel project.

## 4. Out of scope: VeriCase processes it

Text extraction, hashing or any reading of client files; a domain-to-pursuit join table or matter picker (the handover's optional one-pursuit link per domain stands); audit trails beyond the existing activity table; soft delete, retention, purge and subject access; export, zips and manifests; health checks and alerts; runbooks; AI usage logging; digests and reporting; receipts and upload emails; client withdrawal of files; malware or magic-byte checks; log hygiene; privacy policy edits.

Also out of scope, as before: BREE ranking or "conflicted firm" copy; a party register; password login for clients; Vercel Blob; a second bucket or Vercel project; changes to WR2.0 or VeriCase; fee fields; search; analyst, PA or counsel roles.

## 5. Differences from the handover

Where this spec and `docs/HANDOVER-client-files.md` differ, this spec wins. The differences are two: the generic reply on `/access` (R4), and the 50 GB cap with a presigned route for downloads over 100 MB (R2, R3).
