# Static audit assessment

12 September 2026. Raw strict result retained in final-premium-audit.json: exit 1, nine findings, all `affordance.actionless-button`. No raw strict pass is claimed.

Independent test-runner inspection explains every remaining finding:

- Four production `<Button href>` uses in Credentials, Hero, Services and CTABand produce Next Link anchors. The scanner case-folds JSX names and ignores href. Shared primitive tests prove their anchor semantics; browser checks prove their destinations.
- Two child buttons in access/denied and client/page receive their action from Clerk SignOutButton. The installed Clerk React implementation clones the child and supplies an onClick calling clerk.signOut. The scanner examines only the literal child's own attributes.
- Three matches are intentionally inert controls in Header and shared primitive test fixtures.

The two real textarea findings from the initial implementation were fixed. The nine findings above do not establish broken production actions. This interpretation does not certify a real signed-in sign-out journey; live identity limitations are recorded separately.
