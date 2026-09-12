# Meritus Via website

Next.js 15 site for Meritus Via at meritusvia.com, with the directors' pursuit desk at `/portal`.

## Develop

```
npm ci
npm run dev
npm test
npm run lint && npx tsc --noEmit
npm run build      # runs pending database migrations first when DATABASE_URL is set
```

Copy `.env.example` to `.env.local` and fill in what you need. Without Clerk, database, VeriCase S3 and AI Gateway variables the portal renders a setup notice and the public site works as normal.

## Pursuit desk

The desk is the directors' private area: enquiries from the public form land in an inbox, pursuits move across a board (Enquiry, Scoping, Proposal, Instructed, with Declined and Dormant on the side), and each pursuit has a dossier with a research brief, programme intelligence, and a questions drawer. Design: `docs/superpowers/specs/2026-09-09-pursuit-desk-design.md`. Plan: `docs/superpowers/plans/2026-09-09-pursuit-desk.md`.

### Programme intelligence

`/portal/programmes` ingests Asta Powerproject (`.pp` SQLite inspect, plus XML/CSV exports), P6 XER, MSP XML, JSON snapshots and programme PDFs. The block engine (`meritus_block_v1`) selects a delay method from the records that are present (SCL Protocol 2nd Ed: no single preferred method), refuses to invent float or a critical path from PDF mark-up, and cites every figure back to an analysis block. EOT days are not converted into money. Reports are cached by schedule hash; recompute is explicit. Native `.pp` files are validated and described; activity-level CPM needs an XML or CSV export (VeriCase native ingest remains `asta_pp_sqlite_v1`).

### Database

Schema lives in `src/lib/db/schema.ts`; migrations in `drizzle/`. Generate a migration after a schema change with `npx drizzle-kit generate --name <change>`, and apply with `npm run db:migrate` (or let the build apply it). The build script applies pending migrations before `next build`, so Vercel migrates the connected Neon database on every deployment.

### One-off manual steps

1. **Clerk**: invite the three directors; keep access mode Invite-only. First sign-in is the invitation email (it lands on `/sign-up` with a ticket). Do not type the address on Login before that.
2. **Resend**: add the Resend Marketplace integration, verify the sending domain for `enquiries@meritusvia.com` in the EU region, set data retention to the minimum, set `RESEND_API_KEY` and (optionally) `ENQUIRY_ALERT_FROM`, then submit a test enquiry and confirm the alert arrives.
3. **Vercel firewall**: add a rate-limit rule for `POST /api/contact`.
4. **Companies House**: set `COMPANIES_HOUSE_API_KEY` so briefs carry register facts.
5. **Clerk roles**: set `publicMetadata` to `{"role": "director"}` on each director. Clients get `{"role": "client", "domain": "...", "email": "..."}` automatically.
6. **AWS**: create the `meritus-portal` IAM user limited to `meritus/*` in `vericase-data` (policy in `docs/superpowers/plans/2026-09-12-client-file-drop.md`) and set its keys, `S3_BUCKET=vericase-data`, `S3_REGION=eu-west-2` and `S3_KEY_PREFIX=meritus` on the Vercel project.

### Client file drop

Directors list a client firm's email domain at `/portal/clients` and can link it to a pursuit. Anyone with a mailbox at that domain types their work email at `/access`; if the domain is listed, Resend sends a single-use link that expires in 30 minutes, `/access/continue` exchanges it for a Clerk session, and `/client` is their upload desk. There is no password and no public sign-up. Directors stay invite-only.

Files go straight from the browser to the VeriCase bucket by S3 multipart upload, up to 50 GB each, under `meritus/clients/<domain>/`. Nothing is extracted or analysed: the backend is a static document hold and VeriCase reads the bucket and the `documents` table. A linked domain's files appear on the pursuit's dossier; unlinked ones sit under the domain at `/portal/clients`.

Roles: every Clerk user carries `publicMetadata.role`, `director` or `client`. The middleware and every guard deny anything else. Set the three directors' metadata to `{"role": "director"}` in the Clerk dashboard before deploying this, or nobody can sign in. Optionally add the session claim `{"metadata": "{{user.public_metadata}}"}` under Sessions so the role rides in the token.

### Uploads on the desk

Director uploads on a pursuit or in the library still go through the 4 MB route (Vercel refuses larger request bodies) and text is extracted for the questions drawer. Downloads of any file up to 100 MiB stream through `/api/portal/documents/<id>`; larger files redirect to a one-minute presigned URL.

### Environment

See `.env.example`. `RESEND_API_KEY` is optional; without it enquiries are still stored and the inbox row shows "Alert not sent".
