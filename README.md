# Meritus Via website

Next.js 15 site for Meritus Via at meritusvia.com. Directors use the pursuit desk at `/portal`. Clients sign in on the same host at `/client/sign-in` and land on `/client`.

## Develop

```
npm ci
npm run dev
npm test
npm run lint && npx tsc --noEmit
npm run build      # runs pending database migrations first when DATABASE_URL is set
```

Copy `.env.example` to `.env.local` and fill in what you need. Without Clerk, database, blob and AI Gateway variables the portal renders a setup notice and the public site works as normal.

## Pursuit desk

The desk is the directors' private area: enquiries from the public form land in an inbox, pursuits move across a board (Enquiry, Scoping, Proposal, Instructed, with Declined and Dormant on the side), and each pursuit has a dossier with a research brief and a questions drawer. Design: `docs/superpowers/specs/2026-09-09-pursuit-desk-design.md`. Plan: `docs/superpowers/plans/2026-09-09-pursuit-desk.md`.

### Client login

Company domains are the membership list. Directors add `@bree.co.uk` / `bree.co.uk` on `/portal/clients`. Anyone who authenticates with that host is a client, lands on `/client`, and cannot open `/portal`. Matter files stay in VeriCase WR2.0 S3 — this login does not create a second archive or stream objects. Clerk stays invite-only: first-time users still need a Clerk invite (redirect to `https://www.meritusvia.com/client/sign-up`) or a domain allowlist until that is enabled.

### Database

Schema lives in `src/lib/db/schema.ts`; migrations in `drizzle/`. Generate a migration after a schema change with `npx drizzle-kit generate --name <change>`, and apply with `npm run db:migrate` (or let the build apply it). The build script applies pending migrations before `next build`, so Vercel migrates the connected Neon database on every deployment.

### One-off manual steps

1. **Clerk**: invite the three directors; keep access mode Invite-only. Director invitations land on `https://www.meritusvia.com/sign-up`. Client invitations land on `https://www.meritusvia.com/client/sign-up`. Do not type the address on Login before accepting the invite. First-time client users still need a Clerk invite or a domain allowlist until that is enabled.
2. **Client domains**: on `/portal/clients`, add the company host. `meritusvia.com` and public mailboxes are refused.
3. **Resend**: add the Resend Marketplace integration, verify the sending domain for `enquiries@meritusvia.com` in the EU region, set data retention to the minimum, set `RESEND_API_KEY` and (optionally) `ENQUIRY_ALERT_FROM`, then submit a test enquiry and confirm the alert arrives.
4. **Vercel firewall**: add a rate-limit rule for `POST /api/contact`.
5. **Companies House**: set `COMPANIES_HOUSE_API_KEY` so briefs carry register facts.

### Uploads

Files on a pursuit or in the library are capped at 4 MB because Vercel functions refuse larger request bodies. Allowed types: pdf, docx, xlsx, jpg, png, webp, txt, eml, msg; text is extracted from pdf, docx, eml and txt for the questions drawer.

### Client desk

The public header has Partner and Client login. Directors add a company domain under `/portal/clients`. Anyone who authenticates with that email domain is sent to `/client` They never see `/portal`. Public mailbox domains and `meritusvia.com` cannot be added.

Clerk stays invite-only: adding a domain routes people who can already sign in; first-time users still need an invitation to `/client/sign-up`.

### Environment

See `.env.example`. `RESEND_API_KEY` is optional; without it enquiries are still stored and the inbox row shows "Alert not sent".
