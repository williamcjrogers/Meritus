# Browser verification

12 September 2026. Browser: Codex in-app Chromium. Public pages ran in the real Next application at 127.0.0.1:3107. Protected presentation ran in the loopback-only fixture at 127.0.0.1:4319, using real components with illustrative data and blocked/mocked transport.

## Confirmed

- Public Home, Services, Method, Sectors, Insights, Credentials, Claims Intelligence, Privacy, Terms and Accessibility rendered with one main heading and no page overflow at the inspected desktop width. Services and Contact also passed 390px inspection.
- Home primary links have white text on Mineral (computed rgb(255,255,255) on rgb(38,66,76)). The mobile headline includes the correct space between sentences.
- Mobile public menu opens with focus on its first link. Escape closes it and returns focus to Menu.
- Empty contact submission focuses Name. No real enquiry was submitted.
- Access success shows the requested email, a disabled 60-second resend countdown and Change email. Synthetic failure shows useful inline feedback. No real access email was sent.
- Client documents displays organisation identity, the existing company-wide submission-detail policy, upload control and recent receipts without workspace navigation.
- Home has meaningful empty states. Actions supports creating an unassigned action in memory and completing it; completion removes it from the open view. Assigned submission without a due date is rejected with a clear message.
- Pursuits renders a three-column desktop board and a stacked mobile board. The detail page has no horizontal overflow at 390px. All four stages remain visible. Edit details closes with Escape and returns focus to More actions.
- Organisation-access validation focuses the missing domain and retains firm/pursuit. A refused synthetic server action retains domain, firm and selected pursuit with visible feedback.
- Research failure displays an explicit retry action. Research, programme review, library and prospects representative components had no page overflow at 390px.
- Reduced-motion emulation was enabled and detected. No CSS animations were active; remaining transitions were short control/colour feedback. Temporary emulation is reset before final delivery.
- Actions reflowed at 720px by 500px, with its primary action still visible and no page overflow.

## Evidence limits

The fixture does not prove real session authorisation, provider configuration, mail delivery, uploads or database persistence. Those are covered only where separately recorded by integration tests or live verification.

The native date picker crashed the in-app test tab when opened. Native date selection therefore remains a browser-specific verification limitation; form validation and date-state handling are covered by component tests. Testing continued in a fresh tab using unassigned action creation, without changing the application's native date ownership.

The available browser zoom shortcut did not provide reliable native 200% zoom evidence. Half-width reflow was checked instead and is not described as a native zoom pass.

Some full-page captures were malformed by the browser capture path. Reviewed native viewport captures replace them. Screenshots are presentation evidence with illustrative data, not live-account proof.

Final production-build check confirmed underlines on all inspected legal links and article contents/source links. The inspected article also has no page overflow at 390px. Deployment verification follows in the release record.
