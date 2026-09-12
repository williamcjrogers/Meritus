# Forensic review: QCS research and origination capabilities

Date: 12 September 2026

## Finding

The strategy is a useful research agenda, but it is not reliable enough to become automated production logic without correction. It combines credible public-data opportunities with incorrect financial figures, incorrect legal routes, stale programme dates and untested claims about predictive accuracy. The current directors' backend can be extended to run the research, but the necessary ingestion, evidence, monitoring and review capabilities are largely absent.

QCS owns the software and is the intended operator, as William Rogers expressly confirmed. The supplied QCS licence is therefore relevant existing authority. There is no evidential basis for inventing a separate Meritus ownership obstacle. The licence's actual scope and obligations still need to be represented accurately.

This review delivers the findings, proposed system design and execution plans. It does not claim that the backend has been extended, that production permissions have been tested, or that the predictive model has been validated.

## 1. Material reviewed and method

| Material | Examination |
|---|---|
| `docs/compass_artifact_wf-940e6c99-1917-5535-9ade-03216d8ceabf_text_markdown.md` | Entire source read; section/line claims compared with primary publications and repository behaviour |
| `docs/Find_Case_Law_transactional_licence_Quantum_Commercial_Solutions_Limited.docx.pdf` | Text extracted from all six pages; operative terms and signatures visually inspected on pages 1 to 4 |
| Existing source and specifications | Repository at commit `772def8` plus the pre-existing uncommitted client-domain additions; files and tests inspected without production access |
| Public sources | Provider documentation, government releases, legislation/court publications and issuer reports, accessed on 12 September 2026 |

Input SHA-256 values:

```text
strategy: bfa4bb0aedd0ab2de37e7ba88dcb0ef5c22872a787049abef5e94b592e2b05c5
licence:  b05f5c2943043d07a2952f7722a94b3188367f16efd6581afd0e3016bf5daf6f
```

The signed PDF was not independently authenticated through DocuSign, and the review does not establish that no subsequent termination or amendment exists. The user confirmed that there is no later extension to rely on. The source document supplies few direct citations, so unsupported does not necessarily mean false; it means the reviewed evidence does not support treating the proposition as established.

The detailed registers are [claim verification](2026-09-12-research-claims-audit.md), [data-source feasibility](2026-09-12-research-data-sources.md) and [backend evidence](2026-09-12-research-backend-map.md). They identify remaining gaps and retrieval limitations.

## 2. Findings that change implementation

| Priority | Finding | Consequence |
|---|---|---|
| Critical | The current portal authorises any authenticated Clerk user, and the director list maps every returned user to a director | Implement explicit director roles before introducing clients or sensitive research; verify role checks in handlers as well as navigation |
| High | Balfour Beatty FY2025 was a £25m net non-underlying credit after tax, not the asserted £70m charge | Do not seed a distress event from the source's financial example; retrieve and cite the issuer's actual accounting period and note |
| High | Building Liability Orders are High Court orders under BSA s.130; Remediation Contribution Orders are an FTT route under s.124 | Separate remedy, forum and appellate path in legal research |
| High | The Gateway 43-week/39% figures are historical rolling-period observations; Innovation Unit chronology is wrong | Store category, denominator and reporting window; refresh current figures and avoid turning an aggregate into a named-project delay |
| High | TCC/CaTH computational use has its own HMCTS licensing route | Treat court listings separately from the QCS National Archives judgment licence |
| High | Existing briefs have URL provenance rather than claim-to-passage verification; question sources collapse pages by hostname | Build persistent source versions, passage locators and a claim/evidence relation before reporting findings as verified |
| High | Source jobs are not durable; `after()` work cannot provide resumable scheduled ingestion | Add idempotent jobs, leases, checkpoints, retry and cancellation |
| High | The strategy's lead times, low false-positive rates, competitor gaps and dispute probabilities are not validated | Label scores as transparent research priorities; calibrate against actual reviewed outcomes |
| Medium | Payment Practices provides an official complete CSV export | Build a snapshot/diff connector, not an unnecessary primary web scraper |
| Medium | Gazette offers public machine-readable interfaces but imposes delivery and crawling constraints | Separate content rights, public collection rules and paid delivery; use the permitted source route |
| Medium | BSR publications are not a complete named application/project dataset | Use them for cohort analysis; named-project research needs separate actual project evidence |
| Medium | RIS3 dates are 2026 to 2031; DIFC-LCIA is not the current new-case route | Maintain dated programme and institution records rather than embedding the source prose in prompts |
| Medium | ISG's claims portfolio is active but already has funders, insurance, solicitors and experts | Research the current adviser ecosystem and a realistic entry point instead of treating it as an untouched triage opportunity |

The financial correction is supported by [Balfour Beatty's FY2025 announcement, page 8 and Note 9](https://www.balfourbeatty.com/media/h5kfn0a5/2025-full-year-results-announcement.pdf). The remedy distinction is supported by [government redress guidance](https://www.gov.uk/guidance/redress-measures-information-sheet). Current and historical Gateway comparisons are recorded in the [BSR June to August 2026 release](https://www.gov.uk/government/publications/building-safety-regulator-building-control-approval-application-data-june-to-august-2026). Provider access distinctions are documented in [HMCTS publishing policy](https://www.court-tribunal-hearings.service.gov.uk/publishing-policy), the [Payment Practices export](https://check-payment-practices.service.gov.uk/export/) and [Gazette fair-use policy](https://www.thegazette.co.uk/fair-use-policy).

## 3. Supplied licence: what it establishes

This section is a document-based interpretation for implementation design. The signed agreement is the governing source; the following table does not replace it.

| Provision | Evidence in the supplied PDF | Software consequence |
|---|---|---|
| Parties and material | Page 1: The National Archives grants QCS rights over judgments and tribunal decisions published by the Keeper on its website | Register QCS as holder and operator; distinguish this provider from HMCTS lists, BAILII and third-party databases |
| Purpose | Page 1: current information on Claims Toolkit, with summarisation/interpretation enabling legal professionals and claims consultants to find/access judgments | Include full case search, reading, summarisation and comparison. Preserve the stated purpose in configuration. The text does not expressly describe a general origination/scoring business; ownership alone does not expand wording |
| Computational rights | Page 2: express right to undertake computational analysis for the Purpose; royalty-free, non-exclusive and non-transferable | Do not repeat the strategy's instruction to apply for a licence as though no licence exists |
| Term | Page 1: five calendar years from latest signature. Page 4: both signatures dated 12 May 2026, latest 14:38 BST | Record the term and anniversary on 12 May 2031; use a conservative operational expiry and record amendments/termination events |
| Current material and removal | Page 2, restrictions (a)(i) to (iii): current version; judicial personal-data restrictions; remove material withdrawn or replaced | Synchronise changes and withdrawals, hide superseded passages, invalidate derived reports, clean caches and prevent reappearance through backup restoration |
| Attribution | Page 2: specified acknowledgement in a prominent location and a form approved by the Licensor | Display the actual contractual acknowledgement; record the approved presentation, do not substitute a generic footer |
| Judicial dignity and fairness | Page 2: avoid implied endorsement, respect courts/independence, prevent discriminatory harm and bias | No official-status claim, unsupported outcome characterisation or discriminatory targeting; retain review and correction tools |
| Crawling | Page 2, restriction (a)(ix): prevent search indexing and third-party crawling/scraping of judgment contents | Authenticated source reader, no public caching or source-content export URL, `noindex`, access checks and reasonable anti-scraping controls |
| Incomplete coverage | Pages 2 to 3: prominent licensor-approved statement that the material only partially represents court/tribunal activity | Display the limitation in case-law search and court-derived index methodology; do not equate published decisions with all disputes |
| Exclusions | Page 3: unpublished information, emblems/insignia, unlicensed third-party rights, other IP and personal data; not a data sharing/processing agreement | Do not interpret copyright permission as a personal-data processing agreement; record purpose and minimisation separately |
| Termination | Page 3: material/persistent breach may terminate rights; copies returned or erased with satisfactory certificate | Provide an auditable purge workflow covering source objects and dependent content, including restoration safeguards |
| Assignment | Page 4: assignment, novation and sub-licensing require prior written consent | Record actual access/use arrangements without inventing a transfer merely from the repository's name |

The user clarified: full capabilities are required; this is for QCS; QCS owns the software. The proposed design includes the complete case-law functionality and does not hard-disable it on a supposed Meritus/QCS ownership mismatch. The purpose wording is accurately reported as a scope consideration, not converted into an invented express prohibition on marketing. Any operational interpretation or future amendment belongs in the agreement record.

The general [Open Justice Licence v2.0](https://caselaw.nationalarchives.gov.uk/open-justice-licence/version/2) and [National Archives API documentation](https://nationalarchives.github.io/ds-find-caselaw-docs/public) confirm the separate computational-licensing framework. They do not override the supplied signed agreement. The current API includes stable document URIs, transformation-ordered Atom feeds and document hashes, which are directly useful for synchronisation.

## 4. Correct research discipline

The engine should record an observed event before assessing its significance. A published petition is evidence of a petition, not proof that the company is insolvent. A provision is evidence of an accounting judgement, not necessarily a dispute. A recruitment advert is weak context. An enforcement judgment is one stage in a dispute, not a complete or unbiased picture of the court's work.

The same event repeated in Companies House, Gazette and trade press must not become three independent signals. A company name is not enough to establish identity; a group relationship is not enough to transfer liability; an expert's previous engagement is not enough to establish a current conflict. Named longlist entries must remain research subjects until supported and reviewed.

Case-law research must preserve paragraph references and procedural status. Bresco establishes an adjudication right in insolvency, with enforcement questions remaining. The Triathlon Court of Appeal outcome requires a pending Supreme Court appeal qualification. DPA limitation periods must be attached to the applicable duty and accrual rules. Programme and limitation calendars are provisional until evidence and legal assumptions are checked.

Public business contact details can still be personal information. Record the research/marketing purpose, avoid unnecessary personal data and respect objections. This follows [ICO business-to-business guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/); it is a targeted requirement for the proposed contact research, not a reason to remove company-level research capabilities.

## 5. Complete proposed implementation

The [design specification](../superpowers/specs/2026-09-12-qcs-research-design.md) maps 21 requirements to the full director workflow. It includes company monitoring, procurement, insolvency, payments, case law, court listings, building safety, programme and accounts intelligence, commercial imports, entity resolution, evidence verification, prioritisation, legal calendars, referral mapping, research assistance, reports and conversion measurement.

The recommended architecture extends the existing application with Postgres evidence/search and durable jobs plus S3 source objects. It retains the existing pursuit desk and keeps static client deposits separate from public/licensed research. OpenSearch and a separate Python application are not prerequisites.

The proposed execution sequence is:

1. [Evidence foundation and operations](../superpowers/plans/2026-09-12-qcs-research-foundation.md).
2. [Source adapters and legal research](../superpowers/plans/2026-09-12-qcs-research-sources.md).
3. [Director research and commercial workflow](../superpowers/plans/2026-09-12-qcs-research-workflow.md).

Commercial and separately licensed feeds have an honest unavailable state and a working authorised import path until their actual API contract is configured. An imported CSV is not misrepresented as a live API. Full feature coverage does not establish access to every named paid provider.

## 6. Validation performed

| Check | Result |
|---|---|
| Existing test suite | 30 test files, 411 tests passed |
| TypeScript without emitting/incremental writes | One existing fixture error at `src/lib/portal/actions.test.ts:87`: the uncommitted schema requires `clientDomainId`, while the fixture permits `undefined` |
| ESLint on `src` | Zero errors, seven existing unused-variable warnings |
| Whole-tree ESLint | Unsuitable baseline: configuration scans generated `.next` output and `next-env.d.ts`; generated output dominates failures |
| Production build/migration | Not run; `package.json` runs database migrations before build |
| Source integrations | Procurement endpoints and Payment Practices export exercised read-only by source review; other sources assessed against primary documents, as recorded in that review |
| Licence | Six-page text extraction; operative pages/signatures visually checked; no DocuSign authenticity or later-termination verification |
| Deliverable consistency | Eight documents checked; all local links resolve; 46 TypeScript/TSX plan snippets parsed without syntax errors; no em dashes or placeholder markers. Snippet parsing is not implementation or semantic type verification |

Commands used after disabling pnpm's implicit dependency installation:

```sh
corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run
corepack pnpm --config.verify-deps-before-run=false exec node node_modules/typescript/bin/tsc --noEmit --incremental false
corepack pnpm --config.verify-deps-before-run=false exec node node_modules/eslint/bin/eslint.js src
```

The first `pnpm exec` invocation unexpectedly initiated pnpm 11's automatic installation because the repository currently uses an npm lockfile. It stopped on dependency build-script policy before any tests ran. The original 35 direct dependency directories were restored, their versions checked against `package-lock.json`, generated pnpm manifests and local layout removed, and 27 executable links restored from installed locked packages. The final repeat through the restored executable links again passed all 411 tests. Subsequent validation used the existing dependencies with implicit installation disabled. No package manifest, lockfile or application code was changed for this review.

## 7. Delivery status and next decision

Completed: source review, licence assessment, existing-backend inspection, baseline tests, proposed full-system design and proposed execution plans.

Not completed: implementation, database migration, connector deployment, production ingestion or publication. The source document is preserved unchanged so findings remain traceable to the reviewed input.

The requested Superpowers brainstorming workflow requires approval of the concrete design before implementation. Review the linked specification and plans as one QCS system; execution can then proceed in the three units above, with tests and review between units.
