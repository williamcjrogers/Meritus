import type { ActionView } from "@/lib/actions/types";
import type { PursuitStage, ProspectOutreach } from "@/lib/db/schema";
import type { Director } from "@/lib/portal/director-helpers";

export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type ActionCounts = { overdue: number; today: number; upcoming: number; unassigned: number; undated: number; open: number };
export type TeamRow = { ownerId: string | null; ownerName: string; open: number; overdue: number; upcoming: number; completedRecent: number };
export type AgendaEntry = { id: string; date: string; title: string; kind: "action" | "review" | "research"; href: string; ownerName: string | null; qualification: string | null };
export type LeadSummary = { stages: Record<PursuitStage, number>; withoutOwner: number; withoutAction: number; exceptionRows: { id: string; firm: string; missingOwner: boolean; missingAction: boolean }[] };
export type ProspectSummary = { statuses: Record<ProspectOutreach, number>; availableToApproach: number };
export type ProgrammeSummary = { uploaded: number; analysing: number; analysed: number; analysisFailed: number; parseNeedsAttention: number };
export type ResearchSummary = { runningInvestigations: number; queuedInvestigations: number; signalsAwaitingReview: number; reportsAwaitingReview: number; failedLatestRuns: number };
export type ProgressEntry = { id: string; at: string; title: string; actorName: string; href: string; kind: "action" | "lead" | "research" };
export type DashboardView = {
  scope: "team" | "mine";
  today: string;
  refreshedAt: string;
  directory: { available: boolean; directors: Director[] };
  actions: SectionResult<{ counts: ActionCounts; rows: ActionView[]; unassignedTeam: number }>;
  team: SectionResult<TeamRow[]>;
  leads: SectionResult<LeadSummary>;
  prospects: SectionResult<ProspectSummary>;
  programmes: SectionResult<ProgrammeSummary>;
  research: SectionResult<ResearchSummary>;
  agenda: SectionResult<{ entries: AgendaEntry[]; warnings: string[] }>;
  progress: SectionResult<ProgressEntry[]>;
};
