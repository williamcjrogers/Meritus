# Internal colour correction

12 September 2026

The user's correction limits the redesign to the internal workspace and requires confident Meritus colour. This pass uses the restored shared racing green, warm cream and brass tokens. It supersedes the earlier mineral blue presentation for the three stylesheets below.

## Files changed

- `src/styles/workspace.css`: racing green navigation and mobile menu, cream links, brass section labels and selected navigation, readable account area, contrasting keyboard focus.
- `src/styles/dashboard.css`: stronger Home title, coloured action priorities, a prominent next-action panel, brass upcoming dates, distinct prospects, research and programme entry points. The actual overview content and links remain intact.
- `src/styles/actions.css`: green filter controls, state-specific colour, red overdue and brass due-today action rows. The bounded action list switches to stacked metadata below 780 px, allowing complete titles to read naturally inside Home's narrower column.

No JSX, data, authentication, workflow or public website files changed in this pass. No commit, push, migration or deployment performed.

## Checks

`git diff --check -- src/styles/workspace.css src/styles/dashboard.css src/styles/actions.css`: passed.

Representative colour pairs were checked with a WCAG relative-luminance calculation using `corepack pnpm exec node`. All listed text pairs pass the 4.5:1 normal-text threshold; focus pairs exceed 3:1.

| Pair | Contrast |
| --- | ---: |
| Cream links on racing green | 11.12:1 |
| Light brass section labels on racing green | 6.81:1 |
| Selected navigation, active green on light brass | 8.01:1 |
| Selected navigation hover, active green on brass | 5.33:1 |
| Overdue priority, cream on red | 5.65:1 |
| Due-today priority, green on light brass | 6.81:1 |
| Due-today hover, green on brass | 4.53:1 |
| Supporting text on mist | 5.10:1 |
| Warning text on warning surface | 6.27:1 |
| Overdue action text on danger surface | 5.78:1 |
| Completed status on success surface | 6.38:1 |
| Light brass focus on racing green | 6.81:1 |
| Dark brass focus on warm canvas | 4.87:1 |

Inspected the coordinator's real-component fixture captures, using illustrative records:

- `screenshots/scope-correction-dashboard-desktop.png`
- `screenshots/scope-correction-dashboard-mobile.png`

The coordinator confirmed no horizontal page overflow at 390 px, a green mobile menu with cream links and brass selected state, and functioning Escape dismissal. The desktop capture prompted the final action-column readability adjustment described above; the coordinator will refresh the capture for the final record.

No component tests were rerun for this CSS-only pass. The coordinator reported the combined integration suite at 1,084 passed and 94 skipped before its final lint, type and build checks. Those integration results are recorded by the coordinator separately.

## Limits

The browser fixture uses illustrative data. It does not prove production account, data or deployment state. Reduced-motion rules and existing focus handling are retained; no animation or interaction logic was introduced.
