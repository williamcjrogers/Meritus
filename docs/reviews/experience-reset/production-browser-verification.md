# Production browser verification

12 September 2026. Browser: Codex in-app browser, anonymous to Meritus. Custom domain: https://www.meritusvia.com.

## Confirmed behaviour

- Home renders the new public design. At 1440px the document width is 1440px, with one main heading and no horizontal overflow. Screenshot: `screenshots/production-home-desktop.png`.
- Opening `/client` redirects to `/access?returnTo=%2Fclient`. The page contains the work-email link request and no staff navigation. Screenshot: `screenshots/production-client-access-mobile.png`.
- Opening `/portal/actions?filter=overdue` redirects to `/sign-in?returnTo=%2Fportal%2Factions%3Ffilter%3Doverdue`.
- Opening `/sign-up` without an invitation displays invitation guidance and a Sign in link, with no registration form.
- Production Clerk renders its configured email-first sign-in within the new shell. It has no public registration prompt or old application-title header.
- At 390px the sign-in form has no horizontal overflow. Input, primary action and the initially rendered password toggle measured 44px high. The toggle measured 44px wide.

## Final style correction

The first production pass exposed an ineffective Clerk appearance selector: the provider retained a gradient pseudo-element and button shadow. Commit aa75ceb moves that correction to the application stylesheet using stable Clerk classes and explicitly preserves a 2px keyboard-focus outline. Independent review found no material issue; scoped lint, TypeScript and whitespace checks passed.

Final deployment `dpl_BYUE6e4JvNMxbNRXDzCqcfBoKp7M` is READY. At the production custom domain, the primary action measures 44px high with background `rgb(38, 66, 76)`, no resting shadow and no pseudo-element gradient. Document width remains exactly 390px at a 390px viewport. Keyboard Tab from the email field focuses Continue with `:focus-visible=true`, a 2px solid `rgb(34, 100, 123)` outline and 3px offset. Clerk also retains its focused shadow ring. Screenshot: `screenshots/production-sign-in-mobile-focused.png`; measurements: `production-sign-in-measurements.json`.

## Limits

No credentials, client links or invitation tickets were submitted. No email was sent and no client document or account was modified. Real sign-in completion, delivered links, invitations and account-switch journeys require authorised live identities and remain unverified. Synthetic interaction and error recovery evidence is in `browser-verification.md`.

Production Clerk's separate public-registration mode and hosted branding remain pending dashboard access. Its GitHub OAuth screen requests read-only profile and email access; the existing request for user confirmation remains unanswered. No new OAuth access was authorised.
