# Workspace route inventory

12 September 2026. All route paths below remain valid. Every route uses `src/app/(portal)/portal/layout.tsx`, `workspace-shell`, `PortalNavigation`, `workspace-body` and `workspace-main`. Each page now has route-specific metadata. Native dialogs remain app-owned accessible overlays, with semantic CSS shared across shells.

| Route | Shell | Presentation owner | Implementation state |
|---|---|---|---|
| `/portal/actions` | Workspace | ActionRegister + PageHeader; ActionEditor and shared drawer | Existing services and permissions retained; semantic styles migrated |
| `/portal/clients` | Workspace | PageHeader + ClientDomainForm/List + named permission confirmation | Existing services and permissions retained; semantic styles migrated |
| `/portal/library` | Workspace | PageHeader + FileList + named delete confirmation | Existing services and permissions retained; semantic styles migrated |
| `/portal` | Workspace | HomeDashboard + PageHeader; attention, agenda, ownership and progress | Existing services and permissions retained; semantic styles migrated |
| `/portal/programmes/[id]` | Workspace | ProgrammeReportView, PageHeader geometry, shared controls | Existing services and permissions retained; semantic styles migrated |
| `/portal/programmes` | Workspace | PageHeader + ProgrammeUpload + programme list | Existing services and permissions retained; semantic styles migrated |
| `/portal/prospects/[id]` | Workspace | Prospect detail, Panel, shared fields and actions | Existing services and permissions retained; semantic styles migrated |
| `/portal/prospects` | Workspace | PageHeader + ProspectsTable + SearchField | Existing services and permissions retained; semantic styles migrated |
| `/portal/pursuits/[id]` | Workspace | PursuitShell; Brief first, Questions drawer, Documents, Activity, Actions | Existing services and permissions retained; semantic styles migrated |
| `/portal/pursuits` | Workspace | PageHeader + Desk + Board/StageList | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/advanced` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/calendar` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/case-law/[id]` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/case-law` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/digests` | Workspace | ResearchIntelligence + shared ResearchControls tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/evidence/[id]` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/indexes` | Workspace | ResearchIntelligence + shared ResearchControls tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/investigations/[id]` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/outcomes` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research` | Workspace | ResearchDesk + PageHeader; question, evidence and opportunity sections | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/referrals` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/reports/[id]` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/reports` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/runs` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/signals` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/sources` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |
| `/portal/research/watchlists` | Workspace | ResearchWorkspace + PageHeader; ResearchControls for advanced forms/tables | Existing services and permissions retained; semantic styles migrated |

Pursuit and programme not-found routes retain the workspace shell and clear return links. SetupNotice is a plain recovery surface with no provider or database configuration instructions. Error/loading/empty states continue within their owning component; the server does not fabricate success.

Public, access and client route inventories belong to their workers. Their shared controls consume the same runtime tokens and explicitly separate `marketing-shell`, `access-shell` and `client-shell` wrappers.

## Verification boundary

Component tests cover shared buttons/fields/status, navigation selection and mobile dismissal, Home/Actions, pursuit structure and the More actions to Edit focus path, Research requests, source forms, document failure recovery and organisation access changes. Controller owns live browser screenshots, cross-role account verification and release checks. A route's presence in this inventory confirms source migration, not a completed real-account journey.
