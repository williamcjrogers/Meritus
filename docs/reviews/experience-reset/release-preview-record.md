# Meritus experience release

12 September 2026.

Reviewed functional source: 3410bdc. Independent access and experience reviews approved. Full suite: 1,092 tests passed, 94 opt-in database tests skipped. Lint, standalone typecheck and database-free production build passed. Strict Premium scanner findings are classified in the accompanying assessment.

Preview deployment: dpl_74jxCVzjQdEEB9GPo3iZzRfXzGi3, https://meritus-ldjly88vb-quantum-commercial-solutions.vercel.app, source 0782171. Vercel build completed successfully. The existing migration hook ran; this change contains no new migrations.

Deployed browser checks confirmed:

- Public Home renders the new design.
- Staff sign-in renders the Clerk widget without a signup prompt or the old application-title header.
- `/portal/actions?filter=overdue` redirects an anonymous browser to sign-in, preserving the complete return target.
- `/client` redirects to the separate client-access flow.
- `/sign-up` without an invitation displays invitation guidance rather than a registration form.
- The authenticated Vercel CLI reached `/api/portal/research/quick` without a Clerk session and received HTTP 401 with `UNAUTHENTICATED`.

The preview uses the project's existing development Clerk instance; it is protected by Vercel Authentication. Browser access and Vercel CLI protection bypass used existing authorised sessions. Plain unauthenticated HTTP requests correctly stopped at Vercel's SSO boundary.

Final visual refinement: 3c29b53 raises provider control targets to 44px. Live production measurement confirms 44px targets, but found that Clerk ignored the nested appearance selector intended to remove its primary gradient/shadow. A scoped stylesheet correction using stable Clerk classes follows. No auth behaviour changed; scoped lint/typecheck passed.

Outstanding external work: production Clerk remains configured for public registration and hosted meritus-portal branding. Changing those provider settings requires the pending GitHub-to-Clerk dashboard authorisation. No OAuth access, invitation, email, user grant or live client upload was performed. Real invitation/ticket/account-switch journeys remain unverified with live identities.

Production release verification is recorded separately after publication.
