import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Panel } from "@/components/portal/Panel";
import { ProspectConvertButton } from "@/components/portal/ProspectConvertButton";
import { ProspectNotesForm } from "@/components/portal/ProspectNotesForm";
import { ProspectStatusForm } from "@/components/portal/ProspectStatusForm";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { getProspect } from "@/lib/db/prospects";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import {
  SCORE_WEIGHTS,
  conflictTierHint,
  conflictTierLabel,
  evidenceLabel,
  scoreBarWidth,
} from "@/lib/prospects/model";

export const dynamic = "force-dynamic";

const SCORE_ROWS = [
  { key: "need", label: "Need", weight: SCORE_WEIGHTS.need },
  { key: "gap", label: "Gap", weight: SCORE_WEIGHTS.gap },
  { key: "capacity", label: "Capacity", weight: SCORE_WEIGHTS.capacity },
  { key: "access", label: "Access", weight: SCORE_WEIGHTS.access },
] as const;

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  const { id } = await params;
  let prospect;
  try {
    prospect = await getProspect(id);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  if (!prospect) notFound();

  const scores = {
    need: prospect.need,
    gap: prospect.gap,
    capacity: prospect.capacity,
    access: prospect.access,
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Link href="/portal/prospects" className="portal-eyebrow text-brass hover:text-green">
          All prospects
        </Link>
        <h1 className="mt-3 font-serif text-3xl text-green sm:text-4xl">{prospect.organisation}</h1>
        <p className="mt-2 text-[14px] text-ink/70">
          {prospect.organisationType ?? "Organisation"}
          {prospect.rank != null ? ` · Rank ${prospect.rank}` : ""}
          {prospect.valueScore != null ? ` · Value score ${prospect.valueScore}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-5 border border-green/10 bg-parchment p-6 lg:col-span-4">
          <div>
            <Eyebrow rule={false}>Category</Eyebrow>
            <p className="mt-2 text-[16px] text-green">{conflictTierLabel(prospect.conflictTier)}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
              {conflictTierHint(prospect.conflictTier)}
            </p>
          </div>
          <div>
            <Eyebrow rule={false}>Evidence</Eyebrow>
            <p className="mt-2 text-[14px] text-green">{evidenceLabel(prospect.evidence)}</p>
          </div>
          <ProspectStatusForm prospect={prospect} />
          <ProspectConvertButton prospect={prospect} />
        </aside>

        <div className="space-y-6 lg:col-span-8">
          <Panel title="Why they need Meritus">
            <p className="text-[14px] leading-relaxed text-ink/70">
              {prospect.whyTheyNeedYou ?? "No research note on file."}
            </p>
          </Panel>

          <Panel title="Route in">
            <p className="text-[14px] leading-relaxed text-ink/70">
              {prospect.routeInNote ?? "No route-in note on file."}
            </p>
          </Panel>

          <Panel title="Score">
            <div className="space-y-4">
              {SCORE_ROWS.map((row) => (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between gap-4 text-[13px]">
                    <span className="text-green">
                      {row.label}
                      <span className="ml-2 font-mono text-[11px] text-ink/55">
                        {Math.round(row.weight * 100)}%
                      </span>
                    </span>
                    <span className="font-mono text-[12px] text-ink/70">
                      {scores[row.key] ?? "—"} / 5
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-green/10">
                    <div className="h-full bg-brass" style={{ width: scoreBarWidth(scores[row.key]) }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-ink/70">
              Value score is the weighted average of the four judgements, expressed out of 100.
            </p>
          </Panel>

          <Panel>
            <ProspectNotesForm prospect={prospect} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
