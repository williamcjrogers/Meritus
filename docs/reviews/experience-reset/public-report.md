# Public experience implementation

Date: 12 September 2026
Baseline: `efd8849cac66cf8db622260983249482ca9c4f7c`
Owner: public implementation worker

## Delivered

Replaced the public site composition across all 12 route patterns (21 currently generated pages, including 10 articles). The site uses the approved Literata/IBM Plex Sans type bridge and the shared semantic palette. Public CSS is owned by `src/styles/marketing.css`, imported by the workspace owner's global stylesheet.

The home page pairs a direct construction-advisory statement with one explicitly labelled illustrative drawing, sequence and evidence record. It then presents service rows, a short process and current briefings. Removed the obsolete slogan bands and their source components, ambient tickers, animated terminals and unsupported promotional numerical claims from rendered public pages.

Navigation is Expertise, Approach, Insights and Contact. Client access remains `/access`, separate from the access owner's role-aware Account or Staff sign in. Services and sectors remain reachable, including all original hash targets. Mobile navigation is a native non-modal disclosure, with initial focus, Escape dismissal, return to its trigger, and automatic dismissal when keyboard focus leaves the header.

Interior routes use the same design language with appropriate structures: service/output pairs, sector summaries and native authority disclosures, process steps, article reading layouts, a functional enquiry form, and readable legal pages. Native sector anchors replace the old hidden-tab dependency, so every legacy sector hash points to visible content. Claims intelligence retains its compatibility route and existing dashboard link.

## Decisions and preserved behaviour

- Replaced the credentials page's entirely client-side, any-non-empty-password gate and empty download placeholders with a truthful request page. The controller explicitly agreed. `/contact?enquiry=credentials` preselects the existing Credentials request option. No private assets or server permissions were changed.
- Preserved `/api/contact`, field names, options, honeypot and category-only analytics. Added field error associations, first-invalid focus, pending duplicate prevention, visible status and focused success feedback. An analytics error can no longer misreport a successfully accepted enquiry as failed.
- Removed the unverified 24-hour response promise from enquiry display copy. No delivery or response-time capability was added.
- Kept HeaderAuth's `darkChrome` prop and MobileAuth's `onNavigate` prop. Their authentication logic remains owned by the access worker.
- Used native select popups and native details/summary disclosures. No new authored popup system.
- Retained every article's data, takeaways, blocks and references. Retained legal wording, including existing substantive statements, while replacing decorative list dashes with bullets. Legal content was not reviewed for current legal accuracy.

## Route coverage

| Route | Public presentation |
|---|---|
| `/` | Advisory introduction, illustrative record, expertise, approach, insights |
| `/services` | Five discipline sections, retained delay/quantum/technical/advisory/technology anchors |
| `/method` | Approach, retained principle/capabilities/engineering/governance anchors |
| `/sectors` | Buildings/infrastructure/energy plus all original subsector anchors |
| `/insights` | Chronological briefing index |
| `/insights/[slug]` | All 10 articles, mobile-accessible contents, retained article heading anchors |
| `/contact` | Enquiry form, email and client document access |
| `/credentials` | Credentials request through the existing enquiry service |
| `/claims-intelligence` | Research overview, retained authority content and dashboard link |
| `/privacy-policy` | Legal reading shell |
| `/terms` | Legal reading shell |
| `/accessibility` | Legal reading shell |

## Verification

- `corepack pnpm exec vitest run 'src/app/(marketing)/contact/ContactForm.test.tsx' src/components/layout/Header.test.tsx src/app/api/contact`: **35 passed across 3 files**, 12 September 2026 at 09:57 machine time. Covers navigation, mobile focus/Escape/keyboard exit, server acceptance/rejection/throttling/network failures, payload/honeypot, analytics, error associations and duplicate prevention. jsdom emits its expected document-navigation-not-implemented notice for navigation links; tests pass.
- `corepack pnpm exec eslint 'src/app/(marketing)' src/components/layout/{Header,Header.test,Footer,MobileNav}.tsx src/components/icons/HallmarkLogo.tsx src/components/ui/{Card,ServiceTile,SectionHeading,CTABand,InsightCard,PublicIntro}.tsx`: **passed**.
- `corepack pnpm exec tsc --noEmit`: **passed**, after the access owner corrected the intermediate Clerk appearance type issue.
- Formatted owned TSX and CSS with `corepack pnpm dlx prettier@3.6.2 --write` and explicit file paths. No dependency manifest or lockfile change.
- TypeScript AST-derived content check against the baseline: **all 10 `ARTICLE_CONTENT` objects identical**, including takeaways, body blocks and references. Legal JSX text identical across all three legal pages after normalising only the decorative list marker.
- Independent controller browser review found and prompted fixes for an inherited link-colour rule overriding shared buttons and missing whitespace where the mobile headline hid a line break. Both fixes are applied. The controller owns final responsive, contrast, keyboard, reduced-motion and screenshot acceptance.

No production environment, build, deployment, external account action or email was used by this worker. The controller owns full-suite integration, static audit and deployment checks. DESIGN.md was not yet present during this worker's initial implementation; the approved complete spec and shared token contract governed the public work while the workspace owner prepared it.

## Independent review correction

The reviewer and controller confirmed that the general public link reset overrode the intended underlines on article references, article contents and legal links. Both the normal and hover reset now put the anchor selection inside `:where()`, reducing reset specificity to `0,1,0`. The reading selectors retain their higher `0,1,1` specificity. Both reset rules still exclude `.app-button`, preserving the earlier primary CTA contrast fix.

Verification: `corepack pnpm exec node -` parsed the final stylesheet with PostCSS and checked that all three reading selectors retain their underline declarations, both low-specificity reset selectors exist and both original stronger selectors are absent. `git diff --check -- src/styles/marketing.css` passed. No article or legal source text changed. The controller owns the final browser confirmation.
