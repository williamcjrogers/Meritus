import { actionFixture } from "@/lib/actions/fixtures.test-support";
import type { DashboardView } from "./types";

/** Synthetic records for component tests only. */
export function dashboardFixture(overrides: Partial<DashboardView> = {}): DashboardView {
  return {
    scope: "team", today: "2026-09-12", refreshedAt: "2026-09-12T09:30:00Z",
    directory: { available: true, directors: [{ id: "director-1", name: "William Rogers", initials: "WR", email: "william@example.test" }] },
    actions: { ok: true, data: { counts: { overdue: 17, today: 1, upcoming: 3, open: 24, unassigned: 2, undated: 3 }, unassignedTeam: 2, rows: [{ ...actionFixture({ title: "Call Matt Bruce about the curtain wall scope", dueDate: "2026-09-12" }), ownerName: "Unassigned", relatedLabel: "Kubik Construction", relatedHref: "/portal/pursuits/kubik", isPrimary: true, linkAvailable: true }] } },
    team: { ok: true, data: [{ ownerId: "director-1", ownerName: "William Rogers", open: 20, overdue: 17, upcoming: 3, completedRecent: 2 }, { ownerId: null, ownerName: "Unassigned", open: 2, overdue: 0, upcoming: 0, completedRecent: 0 }] },
    leads: { ok: true, data: { stages: { enquiry: 0, scoping: 1, proposal: 1, instructed: 0, dormant: 0, declined: 2 }, withoutOwner: 0, withoutAction: 1, exceptionRows: [{ id: "lq", firm: "L&Q", missingOwner: false, missingAction: true }] } },
    prospects: { ok: true, data: { availableToApproach: 62, statuses: { unworked: 62, approaching: 0, contacted: 0, parked: 0, converted: 0, do_not_approach: 0 } } },
    programmes: { ok: true, data: { uploaded: 0, analysing: 0, analysed: 0, analysisFailed: 0, parseNeedsAttention: 0 } },
    research: { ok: true, data: { runningInvestigations: 0, queuedInvestigations: 0, signalsAwaitingReview: 0, reportsAwaitingReview: 0, failedLatestRuns: 0 } },
    agenda: { ok: true, data: { entries: [], warnings: [] } },
    progress: { ok: true, data: [] },
    ...overrides,
  };
}
