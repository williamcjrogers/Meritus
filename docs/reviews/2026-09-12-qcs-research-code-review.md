# Independent review of root-owned changes

12 September 2026

Reviewed the current safe transport, evidence object lifecycle, role gates, portal loaders, pursuit/brief/question hooks and source catalogue migration. No changes made to root-owned files during this review.

## Findings

1. **P1: a completed object can become permanently untracked if registration and compensating deletion both fail.** In `src/lib/research/evidence.ts`, `storeResearchImport` writes the S3 object before inserting its staging row (lines 103–109). When registration fails, deletion errors are suppressed and no durable record remains for the collector. `downloadResearchSnapshot` has the same gap after completing multipart upload but before registering it. The collector reads database staging rows only; the configured lifecycle rule covers incomplete multipart uploads only. A transient database outage plus an S3 delete error therefore leaves private source content outside withdrawal and retention reconciliation. Preserve a durable upload intent before writing/completing the object, or provide a bounded research-prefix S3 inventory reconciler which can recover these unregistered keys. Test the simultaneous registration/deletion failure, not just either failure independently.

2. **P2: two derived-content readers only check availability before fetching content.** `latestBrief` in `src/lib/db/briefs.ts:6` and `listQuestions` in `src/lib/db/questions.ts:6` call `isResearchPursuitAvailable`, then issue a separate content query and return its result directly. If a source withdrawal commits between those calls, the current-version pointer is already cleared but the asynchronous invalidation worker may not yet have purged the stored brief/question text. These paths can therefore return withdrawn content. `latestCompleteBrief`, `getBrief` and `listActivity` already check after fetching. Apply the same final check to these two readers, or read content and availability in one SQL statement. A regression test should make the initial check true and the post-fetch check false.

## Checked without further findings

- DNS resolution and the actual HTTPS connection use the same public address; mixed private/public answers are rejected.
- Redirects remain within an exact host allowlist and credentials are permanently stripped after crossing origin.
- Request allocation occurs before dispatch, including failed HTTP responses, with rolling quota errors retaining delay information.
- Explicit Clerk director metadata gates portal APIs, actions and each portal page loader; unknown roles fail closed and clients cannot enter the director portal.
- Current-version replacement and withdrawal hooks propagate to pursuit summaries, generated briefs, question persistence and derived notes.
- Evidence invalidation invokes the dependent-content callback before deleting the source object and marking completion.
- The catalogue preserves the supplied QCS licence and leaves sources requiring selections/credentials paused instead of claiming working coverage.

The source stream abort handling was strengthened while this review was in progress; the latest code races iterator reads against cancellation and destroys the stream, so no finding is raised for that earlier implementation.

## Resolution verification

The root implementer resolved both findings. The current object writer registers durable staging before PutObject or multipart completion and retains rows after uncertain deletion. The current brief and question readers recheck source availability after querying content. Root reported fourteen evidence tests passing, including registration and uncertain-delete scenarios. No unresolved root-owned findings remain from this review.

## Final integration review

Reread the resolved evidence staging and brief/question availability changes and the final transport abort handling. The independent focused root test run passed 158 tests. Reviewed migration0006: signal decisions lock related signals in stable order, require the current revision and available evidence, reset both merge participants for fresh review, redact derived notes/index content on withdrawal, and deduplicate weekly digests by workspace and London week. No further concrete findings from this bounded review. Root separately ran three intelligence SQL regressions.


## Final bounded delta review

Reviewed only the final pursuitResearchLink and pursuit banner, exact stored digest-ID queries, investigation selection sequence guard, merge conversion review flags, and empty-initial-corpus digest guard. No new defects found in these changes. The pursuit reader is director-gated and exposes the investigation link plus current evidence/review warning; historical digests fetch their stored IDs and recheck availability and suppressions; stale investigation responses cannot replace the current selection. Signal merge flags prior conversions for review in the same transaction, and the weekly collector leaves an initially empty corpus eligible for a later first digest.

The source reviewer separately identified that watchlist Companies House identifier selection trusted a persisted verified flag after its supporting rights expired. With root authorisation, both candidate selection and the atomic dispatch fence now require an identifier evidence record joined to its currently available passage, version and document. A regression explicitly retains the verified flag while expiring separate proof-source rights.

## Further integration review

Independent source review identified and verified corrections for registered import provenance, independent Find Case Law coverage scopes, exact historical digest membership, and current identifier proof during watchlist dispatch. Root review verified provider-specific commissioning, source-derived calendars/referrals and saved answers, hosted request limits, accessible checkbox names, retry identity and split-import coverage. Final tests and runtime boundaries are recorded in [implementation and acceptance](2026-09-12-qcs-research-delivery.md).
