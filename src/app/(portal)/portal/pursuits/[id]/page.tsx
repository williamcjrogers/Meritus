export const metadata = { title: "Pursuit details" };
import { readRelatedActions } from "@/lib/db/desk-actions";
import { chooseNextAction } from "@/lib/actions/model";
import { requireWorkspacePage } from "@/lib/portal/auth";
import Link from "next/link";
import { pursuitResearchLink } from "@/lib/db/research-intelligence";
import { notFound } from "next/navigation";
import type { AskMessage } from "@/components/portal/AskDrawer";
import type { BriefState } from "@/components/portal/BriefPanel";
import { PursuitShell } from "@/components/portal/PursuitShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import type { RelatedRef } from "@/components/portal/desk-types";
import { latestStageChanges, listActivity } from "@/lib/db/activity";
import { latestBrief, latestCompleteBrief } from "@/lib/db/briefs";
import { expireStaleProgrammeReports, latestReport, listProgrammes } from "@/lib/db/programmes";
import { listDocuments } from "@/lib/db/documents";
import { findRelatedPursuits, getPursuit } from "@/lib/db/pursuits";
import { listQuestions } from "@/lib/db/questions";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { shortDate } from "@/lib/portal/dates";
import { readDirectorDirectory } from "@/lib/portal/directors";
import { summariseDocument } from "@/lib/portal/files";
import { summariseProgramme, type ProgrammeListItem } from "@/lib/programme/view";
import { normaliseFirm } from "@/lib/portal/intake";

export const dynamic = "force-dynamic";


export default async function PursuitPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  const userId = await requireWorkspacePage("/portal/pursuits");
  const { id } = await params;

  let pursuit;
  try {
    pursuit = await getPursuit(id);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  if (!pursuit) notFound();

  let programmeItems: ProgrammeListItem[] = [];
  try {
    const rows = await listProgrammes(id);
    programmeItems = await Promise.all(
      rows.map(async (row) => {
        await expireStaleProgrammeReports(row.id);
        return summariseProgramme(row, await latestReport(row.id));
      })
    );
  } catch {
    programmeItems = [];
  }

  const [directory, activity, documents, run, brief, questions, changes, relatedRows, researchLink] = await Promise.all([
    readDirectorDirectory(),
    listActivity(id),
    listDocuments({ scope: "pursuit", pursuitId: id }),
    latestBrief(id),
    latestCompleteBrief(id),
    listQuestions(id),
    latestStageChanges([id]),
    findRelatedPursuits(pursuit.contactEmail, normaliseFirm(pursuit.firm), id),
    pursuitResearchLink(id),
  ]);

  const directors = directory.directors;
  const actions = await readRelatedActions({ kind: "pursuit", id });
  const selected = chooseNextAction(actions, actions.find(action => action.isPrimary)?.id ?? null);
  const nextAction = actions.find(action => action.id === selected?.id) ?? null;

  const briefState: BriefState = {
    latestRun: run ? { id: run.id, status: run.status, error: run.error, createdAt: run.createdAt.toISOString() } : null,
    brief,
  };
  const thread: AskMessage[] = questions.map((q) => ({
    id: q.id,
    role: q.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: q.content }],
    metadata: { sources: q.sources ?? [] },
  }));
  const related: RelatedRef[] = relatedRows.map((row) => ({ id: row.id, firm: row.firm, stage: row.stage, date: shortDate(row.stageChangedAt) }));

  return (
    <>
    {researchLink && <aside className="mb-5 rounded border border-line bg-primary/5 px-5 py-4 text-[15px]">
      <Link href={`/portal/research/investigations/${researchLink.investigationId}`} className="font-medium underline">Open supporting research and source passages</Link>
      {(researchLink.needsReview || !researchLink.available) && <p className="mt-2">The source evidence or review basis has changed. Review this pursuit against the current research.</p>}
    </aside>}
    <PursuitShell
      pursuit={pursuit}
      actions={actions}
      directoryAvailable={directory.available}
      nextAction={nextAction}
      directors={directors}
      userId={userId}
      related={related}
      latestChange={changes.get(id) ?? null}
      activity={activity}
      documents={documents.map(summariseDocument)}
      briefState={briefState}
      questions={thread}
      programmes={programmeItems}
      now={new Date().toISOString()}
    />
    </>
  );
}
