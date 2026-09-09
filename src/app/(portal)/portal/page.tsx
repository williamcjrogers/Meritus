import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { Desk } from "@/components/portal/Desk";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { NewPursuitButton } from "@/components/portal/NewPursuitButton";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { StageList } from "@/components/portal/StageList";
import { SCOPE_COOKIE } from "@/components/portal/MineAllToggle";
import type { DeskExtras, RelatedRef } from "@/components/portal/desk-types";
import type { Pursuit, PursuitStage } from "@/lib/db/schema";
import { latestEnquiryActivity, latestStageChanges } from "@/lib/db/activity";
import { countByStage, getPursuit, listByStage, listDeskPursuits } from "@/lib/db/pursuits";
import { isClerkConfigured, isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { longDayDate, shortDate } from "@/lib/portal/dates";
import { listDirectors } from "@/lib/portal/directors";
import { isActiveStage, resolveReopenStage, stageLabel } from "@/lib/portal/stages";
import type { Scope } from "@/lib/portal/board";

export const dynamic = "force-dynamic";

const LIST_STAGES: PursuitStage[] = ["dormant", "instructed", "declined"];

async function signedInUserId(): Promise<string> {
  if (!isClerkConfigured()) return "local";
  const { userId } = await auth();
  return userId ?? "anonymous";
}

async function deskExtras(pursuits: Pursuit[]): Promise<DeskExtras> {
  const inbox = pursuits.filter((p) => !p.ownerId && isActiveStage(p.stage));
  const dormant = pursuits.filter((p) => p.stage === "dormant");
  const related: DeskExtras["related"] = {};
  const alerts: DeskExtras["alerts"] = {};
  const reopenStages: DeskExtras["reopenStages"] = {};

  await Promise.all(
    inbox.map(async (pursuit) => {
      const enquiry = await latestEnquiryActivity(pursuit.id);
      if (!enquiry) return;
      if (enquiry.meta?.alert) alerts[pursuit.id] = enquiry.meta.alert;
      const ids = enquiry.meta?.relatedPursuitIds ?? [];
      if (ids.length === 0) return;
      const refs = await Promise.all(ids.map((id) => getPursuit(id)));
      related[pursuit.id] = refs
        .filter((ref): ref is Pursuit => Boolean(ref))
        .map<RelatedRef>((ref) => ({ id: ref.id, firm: ref.firm, stage: ref.stage, date: shortDate(ref.stageChangedAt) }));
    })
  );

  if (dormant.length > 0) {
    const changes = await latestStageChanges(dormant.map((p) => p.id));
    for (const pursuit of dormant) {
      const change = changes.get(pursuit.id);
      reopenStages[pursuit.id] = resolveReopenStage(change ? [change] : []);
    }
  }

  return { related, alerts, reopenStages };
}

export default async function PursuitDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  const { stage } = await searchParams;
  const listStage = LIST_STAGES.find((s) => s === stage) ?? null;
  const cookieStore = await cookies();
  const scope: Scope = cookieStore.get(SCOPE_COOKIE)?.value === "mine" ? "mine" : "all";
  const userId = await signedInUserId();
  const now = new Date();

  let pursuits: Pursuit[];
  let counts: Record<PursuitStage, number>;
  try {
    [pursuits, counts] = await Promise.all([listDeskPursuits(), countByStage()]);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  const directors = await listDirectors();

  const header = (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow rule={false}>Pursuit desk</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">{longDayDate(now)}</h1>
      </div>
      <NewPursuitButton />
    </div>
  );

  if (listStage) {
    const rows = await listByStage(listStage);
    const changes = await latestStageChanges(rows.map((row) => row.id));
    return (
      <div className="max-w-6xl">
        {header}
        <StageList stage={listStage} rows={rows.map((pursuit) => ({ pursuit, change: changes.get(pursuit.id) ?? null }))} directors={directors} />
      </div>
    );
  }

  const extras = await deskExtras(pursuits);
  const open = counts.enquiry + counts.scoping + counts.proposal;

  return (
    <div className="max-w-6xl">
      {header}
      {open === 0 && counts.dormant === 0 ? (
        <div className="panel-brackets border border-green/10 bg-parchment px-6 py-10 text-center">
          <p className="font-serif text-2xl text-green">No open pursuits.</p>
          <p className="mt-2 text-[14px] text-ink/70">Enquiries from the site land here.</p>
        </div>
      ) : (
        <Desk pursuits={pursuits} extras={extras} directors={directors} userId={userId} scope={scope} now={now.toISOString()} />
      )}
      <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.15em] uppercase text-ink/70">
        {LIST_STAGES.map((s, index) => (
          <span key={s} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <Link href={`/portal?stage=${s}`} className="hover:text-brass">
              {stageLabel(s)} <span className="text-green">{counts[s]}</span>
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}
