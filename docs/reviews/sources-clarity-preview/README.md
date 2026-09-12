# Simple research desk and source settings

Prepared on 12 September 2026 in response to the difficulty using the research portal.

This preview renders the actual revised React components with sample data. It does not read or change production data and does not call AI. It demonstrates both agreed everyday uses: an automatically selected opportunity feed and a plain-language question box with optional daily updates. Question completion is simulated and explicitly labelled.

Source settings are available under More tools. Navigation between the desk, source settings and advanced investigations works within this preview. Links to other portal pages explain their destination.

## View the preview

From this worktree, run:

```sh
corepack pnpm exec vite --config docs/reviews/sources-clarity-preview/vite.config.mts
```

Open [the local preview](http://127.0.0.1:4175).

## Application behaviour

The everyday desk selects current, permitted construction-related records for review. Save and Dismiss reduce repeat work. A question enters a durable server queue, selects relevant collected evidence automatically and produces a short cited draft answer. The user can leave the page while it runs. Daily monitoring compares the supporting passage and version set before using AI again. Each answer cycle reserves no more than £2 and 30,000 tokens, within the existing source and run budgets.

The desk covers collected sources. It is not a complete internet search, a confirmation of commercial opportunity or a verification of distress. Source collection and rights gaps remain visible. The existing collection scheduler continues to bring in source material. The new answer worker has its own bounded invocation.

Source settings explain what each source provides, its collection status and the next setup step. Imports and new-source registration are separate tasks. Licences, document checks and technical limits appear only when needed. Draft form data survives task switching; newly registered sources remain paused until enabled.

## Delivery boundary

Implementation is on `codex/sources-clarity`; William approved publication on 12 September 2026. Migration `0010_qcs_research_quick.sql` adds the automatic question lifecycle after the separately published Home dashboard migration `0009`. The existing source forms retain their API contracts. Deployment requires applying that migration and scheduling `/api/internal/research-answers` with the existing cron secret. The production model configuration must also be available. The implementation review records release verification separately from this sample preview.

The package's `build` command performs migrations. Development verification uses `next build` directly and a separate disposable PostgreSQL database. No live source configuration, licence, import, document state or question has been changed.

Gazette notice labels correspond to [the publisher's notice-code list](https://www.thegazette.co.uk/noticecodes), checked on 12 September 2026. They describe publication categories and do not establish insolvency by themselves.

Validation results are recorded in [the implementation review](../2026-09-12-automatic-research-desk.md).
