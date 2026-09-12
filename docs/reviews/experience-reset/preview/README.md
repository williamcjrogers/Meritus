# Local component verification

Run `corepack pnpm exec node docs/reviews/experience-reset/preview/serve.mjs`.

This loopback-only fixture renders the actual application components and stylesheet. It replaces Next navigation, Clerk and API transport with local fixtures. It is not a production route or an authentication bypass, and it cannot send live messages or mutate production records.

Views: `/portal`, `/portal/actions`, `/portal/research`, `/access`, `/client`. Add `?scenario=empty`, `?scenario=error` or Research `?scenario=loading` to inspect recovery states. Home and action editing use an in-memory copy of the established synthetic fixture. Accounts use `example.test` addresses.

Additional views use real components with synthetic data: `/portal/pursuits/example`, `/portal/prospects`, `/portal/library`, `/portal/programmes` and `/portal/programmes/example`. Pursuit mutations return an explicit preview-only error.

Public-site validation uses the real Next development server separately. Authentication-service verification must be recorded separately from this fixture. Client and access use the real presentation components and shells, with no server identity or storage integration.
