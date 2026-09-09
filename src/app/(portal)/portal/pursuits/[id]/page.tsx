import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import type { AskMessage } from "@/components/portal/AskDrawer";
import type { BriefState } from "@/components/portal/BriefPanel";
import { PursuitShell } from "@/components/portal/PursuitShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import type { RelatedRef } from "@/components/portal/desk-types";
import { latestStageChanges, listActivity } from "@/lib/db/activity";
import { latestBrief, latestCompleteBrief } from "@/lib/db/briefs";
import { listDocuments } from "@/lib/db/documents";
import { findRelatedPursuits, getPursuit } from "@/lib/db/pursuits";
import { listQuestions } from "@/lib/db/questions";
import { isClerkConfigured, isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { shortDate } from "@/lib/portal/dates";
import { listDirectors } from "@/lib/portal/directors";
import { summariseDocument } from "@/lib/portal/files";
import { normaliseFirm } from "@/lib/portal/intake";

export const dynamic = "force-dynamic";

async function signedInUserId(): Promise<string> {
  if (!isClerkConfigured()) return "local";
  const { userId } = await auth();
  return userId ?? "anonymous";
}

export default async function PursuitPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  const { id } = await params;

  let pursuit;
  try {
    pursuit = await getPursuit(id);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  if (!pursuit) notFound();

  const [directors, activity, documents, run, brief, questions, changes, relatedRows, userId] = await Promise.all([
    listDirectors(),
    listActivity(id),
    listDocuments({ scope: "pursuit", pursuitId: id }),
    latestBrief(id),
    latestCompleteBrief(id),
    listQuestions(id),
    latestStageChanges([id]),
    findRelatedPursuits(pursuit.contactEmail, normaliseFirm(pursuit.firm), id),
    signedInUserId(),
  ]);

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
    <PursuitShell
      pursuit={pursuit}
      directors={directors}
      userId={userId}
      related={related}
      latestChange={changes.get(id) ?? null}
      activity={activity}
      documents={documents.map(summariseDocument)}
      briefState={briefState}
      questions={thread}
      now={new Date().toISOString()}
    />
  );
}
