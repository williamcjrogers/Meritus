# Scope and colour correction

12 September 2026.

The user clarified that the requested work concerned the internal system, not a redesign of the public website. The user also rejected the monochrome internal treatment and required dashboard priorities and features to attract the eye. These instructions supersede the earlier redesign specification and its public/colour decisions.

## Direction

Restore the public site from `efd8849cac66cf8db622260983249482ca9c4f7c`, preserving its original green, brass, warm backgrounds, logo, imagery, typography, pages and content. Retain corrected client/staff destinations in the existing navigation. Scope public fonts and styles so they cannot affect internal controls.

The internal system keeps the repaired login, invitation recovery, current-identity checks, cross-role destinations, drafts and interrupted-action recovery. Its palette is Racing Green `#0B3B24`, Brass `#B5975A`, Light Brass `#D3BC8B`, Warm Canvas `#F5F0E8`, Paper `#FFFCF7` and Dark Green `#1C2921`; existing red/success/warning meanings remain explicit.

IBM Plex Sans remains the working face. Weight, scale and colour make priorities and feature entry points distinct. The Home overview remains an overview: coloured priority links lead into the relevant filtered actions, alongside dates and named working areas. Navigation uses cream on green with a brass current item. No decorative metrics or new workflow is introduced.

## Verification

- Public source restored and independently reviewed; original four marketing fonts are loaded only in the marketing layout.
- Public header measured without overlapping items at 1024px; public mobile document fits 390px. Original green sections and transparent outline buttons confirmed in the browser.
- Actual internal components checked with synthetic fixtures at 1440px and 390px; no mobile horizontal overflow. Green mobile navigation has cream links and a brass selection; Escape closes it normally.
- Full test suite: 1,084 passed, 94 opt-in database tests skipped. Restoring public tests and removing tests for the withdrawn header changes the count from the previous release.
- Representative internal text colour pairs pass WCAG AA; see `internal-colour-report.md`.
- Full lint, standalone typecheck and the database-free production build passed. Independent review found and confirmed fixes for the public outline-button background and error/focus contrast on the brass Prospects summary. No remaining material finding in the reviewed correction.
- No backend, authentication, API or workflow implementation was changed by this correction. The previously deployed functional repairs remain intact.
- Live deployment identity and verification are recorded after publication.

Production Clerk dashboard settings remain a separate pending permission from the previous work. This correction makes no provider, identity, email or document mutations.
