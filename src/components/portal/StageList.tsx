import Link from "next/link";
import type { Activity, Pursuit, PursuitStage } from "@/lib/db/schema";
import { dueLabel, shortDate } from "@/lib/portal/dates";
import { directorInitials, directorName, type Director } from "@/lib/portal/director-helpers";
import { stageLabel } from "@/lib/portal/stages";
import { Eyebrow } from "./Eyebrow";
import { OwnerAvatar } from "./OwnerAvatar";

export function StageList({
  stage,
  rows,
  directors,
}: {
  stage: PursuitStage;
  rows: Array<{ pursuit: Pursuit; change?: Activity | null }>;
  directors: Director[];
}) {
  const dormant = stage === "dormant";
  return (
    <section aria-label={`${stageLabel(stage)} list`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <Eyebrow rule={false}>
          {stageLabel(stage)} <span className="text-ink/60">({rows.length})</span>
        </Eyebrow>
        <Link href="/portal" className="btn-quiet">
          Back to board
        </Link>
      </div>
      <div className="panel-brackets overflow-x-auto border border-green/10 bg-parchment">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-green/10 font-mono text-[10px] tracking-[0.15em] uppercase text-green/80">
            <tr>
              <th className="px-4 py-3 font-medium">Firm</th>
              <th className="px-4 py-3 font-medium">Nature</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Since</th>
              {dormant && <th className="px-4 py-3 font-medium">Next action</th>}
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={dormant ? 6 : 5} className="px-4 py-8 text-ink/70">
                  Nothing at {stageLabel(stage).toLowerCase()}.
                </td>
              </tr>
            ) : (
              rows.map(({ pursuit, change }) => (
                <tr key={pursuit.id} className="align-top hover:bg-stone/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/pursuits/${pursuit.id}`} className="font-serif text-[17px] text-green hover:text-brass">
                      {pursuit.firm}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{pursuit.disputeNature ?? "–"}</td>
                  <td className="px-4 py-3">
                    <OwnerAvatar initials={directorInitials(directors, pursuit.ownerId)} name={directorName(directors, pursuit.ownerId)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-ink/70">{shortDate(pursuit.stageChangedAt)}</td>
                  {dormant && (
                    <td className="px-4 py-3 text-ink/80">
                      {pursuit.nextAction ?? "–"}
                      {pursuit.nextActionDue && (
                        <span className="ml-2 font-mono text-[10px] tracking-[0.05em] text-ink/60">due {dueLabel(pursuit.nextActionDue)}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-ink/70">{change?.meta?.reason ?? "–"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
