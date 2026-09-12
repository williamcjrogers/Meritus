# Independent access review

Reviewer: Astra, independent code-reviewer. Date: 12 September 2026.
Initial revision: 0461e5fda0b28b16b36db797591b631f298a19d0, against efd8849cac66cf8db622260983249482ca9c4f7c.
Initial result: request changes, two P2 recovery defects. Owner assigned both corrections.

1. `src/components/access/AccessContinue.tsx:16`: Clerk `sign_in_token_revoked_code` and `sign_in_token_cannot_be_used_code` fell through to unavailable. A signed-out visitor could only retry the unusable ticket. Classify terminal failures and offer a fresh link. Test documented codes from https://clerk.com/docs/guides/development/errors/frontend-api#sign-in-tokens .
2. `src/app/(portal)/portal/layout.tsx:32`: hardcoded `/portal` loses the requested path and query if middleware succeeds but later verification fails. Pages calling `requireResearchDirector` directly leave its 503 uncaught, yielding a generic application error. Use page-specific recovery with the actual permitted path/query; preserve typed API/worker 401/403/503 behaviour. Add sequential verification failure tests.

Reviewer inspected all access-commit files, traced guard callers and client-domain enforcement, and independently ran 12 test files / 79 tests, all passing. No material new cross-role disclosure, cross-domain authorisation bypass or open redirect was identified.

External limitations: provider registration remains public and hosted branding remains meritus-portal pending dashboard access. Live invitation acceptance, emailed ticket exchange and account switching are not proved by component fixtures.

First correction (8ba1051): terminal codes and validated request header approved. Follow-up review found nested reader checks after the entry guard still escaped recovery in Home, Pursuits, Pursuit detail, Investigation detail and the async RelatedActionPanel.

Final correction (3410bdcfe8e173ac1276a735040062d95f7a71f5): approved. Page-only exception translation now covers those nested loaders and async child rendering, including Actions catch branches. Shared backend/API/worker typed errors remain unchanged. Independent verification passed 8 files / 74 tests, including the actual Home page with the real dashboard reader and nested 401/403/503 errors after a successful entry guard. Both P2 findings are closed; no material source finding remains.
