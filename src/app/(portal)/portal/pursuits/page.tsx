export const metadata = { title: "Pursuits" };
import { requireWorkspacePage } from "@/lib/portal/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { withPageAccessRecovery } from "@/lib/portal/page-access";
import { readLiveLeads } from "@/lib/portal/live-leads";
import { Desk } from "@/components/portal/Desk";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewPursuitButton } from "@/components/portal/NewPursuitButton";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { StageList } from "@/components/portal/StageList";
import { SCOPE_COOKIE } from "@/components/portal/MineAllToggle";
import type { DeskExtras, RelatedRef } from "@/components/portal/desk-types";
import type { Pursuit, PursuitStage } from "@/lib/db/schema";
import { latestEnquiryActivity, latestStageChanges } from "@/lib/db/activity";
import { countByStage, getPursuit, listByStage, listDeskPursuits } from "@/lib/db/pursuits";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { longDayDate, shortDate } from "@/lib/portal/dates";
import { listDirectors } from "@/lib/portal/directors";
import { isActiveStage, resolveReopenStage, stageLabel } from "@/lib/portal/stages";
import type { Scope } from "@/lib/portal/board";

export const dynamic = "force-dynamic";

const LIST_STAGES: PursuitStage[] = ["dormant", "instructed", "declined"];


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
    }),
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

export default async function LiveLeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) return <SetupNotice />;
  const userId = await requireWorkspacePage("/portal/pursuits");

  const { stage } = await searchParams;
  const listStage = LIST_STAGES.find((item) => item === stage) ?? null;
  const cookieStore = await cookies();
  const scope: Scope = cookieStore.get(SCOPE_COOKIE)?.value === "mine" ? "mine" : "all";
  const now = new Date();

  let pursuits: Pursuit[];
  let counts: Record<PursuitStage, number>;
  try {
    [pursuits, counts] = await Promise.all([listDeskPursuits(), countByStage()]);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  const directors = await listDirectors();

  const header = <PageHeader title="Pursuits" description={`Live leads, ownership and the next step. ${longDayDate(now)}.`} actions={<><Link className="app-button app-button--secondary" href="/portal/prospects">View prospects</Link><NewPursuitButton /></>} />;

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

  const [extras, leads] = await Promise.all([deskExtras(pursuits), withPageAccessRecovery(() => readLiveLeads(pursuits), "/portal/pursuits")]);
  const open = counts.enquiry + counts.scoping + counts.proposal;

  return (
    <div className="max-w-6xl">
      {header}
      {open === 0 && counts.dormant === 0 ? (
        <div className="app-panel border border-line bg-surface px-6 py-10 text-center">
          <p className="font-sans text-2xl text-primary">No open live leads.</p>
          <p className="mt-2 text-[15px] text-muted">Enquiries from the site land here.</p>
        </div>
      ) : (
        <Desk pursuits={leads} extras={extras} directors={directors} userId={userId} scope={scope} now={now.toISOString()} />
      )}
      <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px]   text-muted">
        {LIST_STAGES.map((item, index) => (
          <span key={item} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <Link href={`/portal/pursuits?stage=${item}`} className="hover:text-primary">
              {stageLabel(item)} <span className="text-primary">{counts[item]}</span>
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}
