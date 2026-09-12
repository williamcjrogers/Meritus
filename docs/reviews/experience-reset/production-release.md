# Production release receipt

12 September 2026.

Released to https://www.meritusvia.com and https://meritusvia.com from `origin/main`.

- Final application commit: `aa75ceb4a9f50b796f6b18b111bacd22b459c821`.
- Vercel deployment: `dpl_BYUE6e4JvNMxbNRXDzCqcfBoKp7M`, production, READY.
- Both custom-domain alias records independently resolve to that deployment. The apex domain redirects to www.
- Public site, client access, staff access and workspace presentation have been reset. Existing services, legal/article text and company-wide client sharing scope remain preserved.
- Full functional suite: 1,092 passed, 94 opt-in database tests skipped. Full lint, typecheck and database-free production build passed. The final style-only correction passed scoped lint/typecheck and independent review; the actual Vercel production build completed successfully.
- Initial production HTTP verification: nine checks passed. Final release: exact deployed identity, both aliases, Home 200 and anonymous research API 401 verified. Browser verification confirms the new design, separate client/staff entry, full staff return target, invitation guidance, mobile control sizing and keyboard focus.

Evidence: `production-verification.json`, `production-build.log`, `production-browser-verification.md`, `production-sign-in-measurements.json` and the production screenshots. Independent access/experience reviews and full-suite logs are in this directory. The strict Premium scanner's nine raw findings are documented false positives in `premium-audit-assessment.md`; its raw exit is not represented as a pass.

## Outstanding external dependency

Clerk's production provider remains configured for public registration and its old hosted branding. Application registration is invitation-gated, but that does not change the provider setting. The Clerk dashboard sign-in requests new read-only GitHub profile/email access; the user confirmation request remains unanswered, so no OAuth authorisation was submitted.

Real emailed-link, invitation, sign-in completion and account-switch journeys have not been exercised with live identities. No test emails, account grants or client uploads were performed. No new migrations were introduced by this change.

This receipt is retained on the task branch after deployment; it does not trigger another production release.
