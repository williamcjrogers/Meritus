---
version: alpha
name: Meritus
description: Construction advisory expertise and a clear evidence-led working environment.
colors:
  primary: "#0B3B24"
  accent: "#B5975A"
  accent-light: "#D3BC8B"
  surface: "#FFFCF7"
  canvas: "#F5F0E8"
  text: "#1C2921"
  muted: "#5B645C"
  mist: "#E7ECDD"
  danger: "#A63A35"
  success: "#28634E"
  warning: "#79521C"
  border: "#CAC5B6"
  field-border: "#838D7F"
  focus: "#856320"
typography:
  sans:
    fontFamily: "IBM Plex Sans, Helvetica Neue, Arial, sans-serif"
  serif:
    fontFamily: "Literata, Georgia, serif"
rounded:
  DEFAULT: "6px"
  panel: "10px"
spacing:
  section-gap: "32px"
  workspace-rail: "248px"
components:
  button: {}
  field: {}
  page-header: {}
  panel: {}
  dialog: {}
  toast: {}
---

# Meritus design system

## Overview

### Creative North Star

Meritus colour and clear working priorities. Racing green establishes the workspace; brass identifies current work and selected tools. Urgent actions and distinct feature entry points attract the eye through meaningful colour, readable type and useful hierarchy.

### Product context and register

The controlling instruction is the user's correction on 12 September 2026: improve the internal system, restore the original public website, and reject monochrome treatment in either experience. `docs/reviews/experience-reset/scope-correction.md` supersedes the earlier redesign specification wherever scope, public design or palette conflicts. Public pages explain Meritus expertise and invite relevant enquiries. Client documents support organisation-wide submission and receipt history. Staff use Home, Actions, Pursuits, Prospects, Research, Programmes and Library. These are three shells within one Next.js application, with existing Clerk, Resend, Neon and storage services.

Working language is British English, with en-GB dates and Europe/London operational time. No Japanese market or locale is in scope. The original public site uses Cormorant Garamond, Cinzel, Inter and JetBrains Mono, loaded only in the marketing layout. Application text uses IBM Plex Sans. Working screens support frequent desktop use and a usable narrow-screen journey. The public website has a considered editorial register; application labels are direct, sentence case and task-specific.

Preserve the original public site's colour, typography, content and composition. Internal screens retain the repaired access/workflow behaviour and current usable layouts, with strong Meritus green, brass, warm surfaces and meaningful status colours. Do not reinstate a monochrome design.

Runtime CSS is canonical (model B): `src/styles/globals.css` owns internal semantic values and `@theme` exposes runtime-resolved Tailwind tokens. `marketing.css` scopes the original public theme and baseline styles to `.marketing-shell`. This prevents either audience's typography and styles from overriding the other. Workspace, dashboard and actions styles consume semantic tokens. Clerk appearance consumes the same internal control variables.

## Colors

Warm cream canvas and paper surfaces sit beneath dark green text. Racing green identifies the workspace and primary actions; brass identifies selection and due-today work. Pale green supplies a secondary surface. Oxide identifies errors and overdue work with accompanying text. Success and warning have separate text and light surface tokens. Normal text uses `--text`; secondary copy uses `--muted`, never alpha opacity.

Structural boundaries use `--border` and `--border-subtle`. Interactive field boundaries use the stronger `--field-border`, an accessibility refinement of the approved base palette. Focus uses `--focus`. Text colour must remain legible in every state, including primary navigation links and disabled controls. Light is the supported theme; forced colours defer to the operating system.

| Document token | Runtime owner | Adapter | Consumers |
|---|---|---|---|
| colors.primary | --primary | --color-primary | Button, links, selected navigation |
| colors.surface / canvas | --surface / --canvas | --color-surface / --color-canvas | Three shells, fields, panels |
| colors.text / muted | --text / --muted | --color-text / --color-muted | Body, labels, metadata |
| colors.field-border | --field-border | --color-control | Inputs, selects, textareas |
| colors.danger / success / warning | same-named semantic variables | same-named colour adapters | Status and button intent |
| colors.focus | --focus | --color-focus | Keyboard focus |
| rounded.DEFAULT | --radius-control | Direct CSS | Shared controls |
| typography.sans / serif | --font-ibm-plex-sans / --font-literata | --font-sans / --font-serif | Internal typography; public font variables are scoped separately |

Compatibility aliases map older names to these variables for service-generated or unmigrated content. They are adapters, not an alternative identity. Portal components use semantic names.

## Typography

Application body text is 15 to 16px, labels 14px and metadata at least 13px. Page headings are 28 to 36px, section headings generally 21 to 24px. Weight 500 establishes hierarchy; weight 600 is reserved for emphasis. Line height is 1.5 to 1.6. Normal prose remains below 72 characters where possible. Tables use tabular numerals without a separate monospace font. Public heading scales live in marketing.css.

## Layout

Desktop workspace uses a 248px white navigation rail and a naturally scrolling main document. Navigation groups are Work, Commercial and Resources. At widths below 1024px a compact sticky bar opens a native modal navigation panel. All destinations remain reachable on short viewports through the navigation's own visible scroll region.

PageHeader aligns title, description and actions across list screens. Home retains attention, dates, ownership and progress. Pursuit detail starts with Brief, with local links to Questions, Documents, Activity and Actions. Research keeps the question-first workflow, with advanced controls reached through Research settings. Cards represent bounded work, not every sentence.

Document scrolling belongs to the page. Tables own horizontal overflow and bounded dataset navigation. Long forms never inherit a viewport-fixed table height. Sections use a 32px rhythm, with 16 to 24px internal spacing. Public layout has its own generous compositions.

## Elevation & Depth

Working surfaces use quiet boundaries and tonal separation. Elevation belongs to menus, dialogs, drawers and toast acknowledgements. Do not add decorative card shadows or gradients to operational screens.

## Shapes

Controls have a 6px radius; bounded content uses 10px. Circles are reserved for account avatars and small status marks. Structural rules convey grouping, never heritage decoration.

## Components

### Foundational visual states

All enabled buttons and links have visible hover and keyboard focus. Primary action hover and active use semantic variants. Disabled controls are inert; busy buttons expose aria-busy and retain their action label and dimensions. Inline Status variants provide information, success, warning and errors with text. Loading is a stable text/status region or the shared button spinner, not a fabricated percentage.

### Buttons and actions

`src/components/ui/Button.tsx` owns primary, secondary and ghost emphasis, alongside brand, neutral, success, warning, info and danger intent. It supports native button attributes and link destinations. Primary actions have light text on racing green; secondary actions have an explicit boundary. Destructive actions remain distinct and require confirmation when irreversible or permission-changing.

### Navigation and data display

`PortalNavigation` consumes `src/lib/portal/navigation.ts`, preserves every URL, marks current routes and returns focus after mobile dismissal. Actions retains URL-driven filtering and paging. Advanced Research tables page the loaded service snapshot at 50 rows and state that scope. See UX-CONTRACT.md for intentional local state exceptions.

### Forms and overlays

Field, Textarea and SearchField own labels, focus and field-error association. Existing native select, checkbox and date controls are deliberately retained, including operating-system popup geometry and locale. Shared app-field styling covers the closed control. Textareas have adequate starting height and resize none; supported browsers can auto-grow within a bounded maximum.

ConfirmDialog and SlideOver use native dialog modality, accessible names, Escape handling and focus restoration. Critical errors remain beside the relevant form or confirmation. ToastProvider provides one deduplicated six-second acknowledgement at the lower right, never the only copy of a correction.

### Iconography

Workspace navigation uses 20px line SVGs, with 1.5px strokes and visible text labels. Icons are decorative to assistive technology when a label already names the destination. No icon-only navigation or speculative symbol library is introduced.

### Motion

Transitions respond to user actions and last 150ms. Workspace has no ambient motion. Reduced motion disables non-essential animation and smooth scrolling. A pending spinner is informational and does not shift its control.

### Content and data visualization

Use task names, evidence provenance and precise states. Internal role identifiers remain in server contracts, never ordinary navigation copy. Do not alter user-provided records or legal source text. Dates use DD Month YYYY and operational time uses Europe/London. Currency remains GBP by default. No fabricated case claims, results or research certainty.

## Do's and Don'ts

- Do place the finding beside its evidence and the action beside its owner and date.
- Do reuse the canonical control and route owners across the three audience shells.
- Do keep Home an overview and preserve the question-first Research workflow.
- Do not remove the Meritus colour identity. Keep internal body labels readable and use status text alongside colour. Public styling must remain faithful to the restored original.
- Do not make client screens depend on portal styling or imply matter-specific confidentiality.
- Do not override shared button colours with broad anchor selectors in an audience stylesheet.
