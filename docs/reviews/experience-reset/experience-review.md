# Independent experience review

Reviewer: Astra, independent code-reviewer. Date: 12 September 2026.
Scope: public and workspace implementation against the approved experience specification.

Initial findings:

1. P2: public generic link reset overrode article/contents/legal reading-link underlines. Fixed in eb5b45a by lowering reset specificity with `:where()`, preserving shared button colours and article/legal content.
2. P2: organisation-access submission could lose the draft on validation/refusal. Initial controlled fix still lost the selected pursuit during React's automatic form reset. Fixed in 5f7d9dd using explicit action dispatch, retained controlled state, validation and transport recovery.
3. P2: rejected pursuit deletion or question-thread clearing could leave pending confirmation stuck. Fixed in 5f7d9dd with catch/finally, persistent errors and retry/cancel recovery.

Final independent outcome: approve scoped fixes. Eight tests passed across ClientDomainForm, PursuitShell and AskDrawer, including the previously failing selected-pursuit retention case. Public reset specificity is now (0,1,0), below reading-link selectors at (0,1,1). No source edits were made by the reviewer.

The public composition, audience separation, retained routes, Home overview and pursuit section structure agree with the approved direction. No additional material regression was established. Ordinary directory-error copy is team-neutral. Root browser verification separately confirmed the mobile stage layout and surviving More actions focus target.

Capture caveat: malformed full-page screenshots were browser capture artefacts. Acceptance evidence uses replacement native viewport captures and DOM dimensions.

Provider authentication and release verification remain separate from this review.
