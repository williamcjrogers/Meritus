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
          {stageLabel(stage)} <span className="text-muted">({rows.length})</span>
        </Eyebrow>
        <Link href="/portal/pursuits" className="app-button app-button--ghost">
          Back to live leads
        </Link>
      </div>
      <div className="app-panel overflow-x-auto border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line font-sans text-[13px]   text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Firm</th>
              <th className="px-4 py-3 font-medium">Nature</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Since</th>
              {dormant && <th className="px-4 py-3 font-medium">Review due</th>}
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={dormant ? 6 : 5} className="px-4 py-8 text-muted">
                  Nothing at {stageLabel(stage).toLowerCase()}.
                </td>
              </tr>
            ) : (
              rows.map(({ pursuit, change }) => (
                <tr key={pursuit.id} className="align-top hover:bg-mist/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/pursuits/${pursuit.id}`} className="font-sans text-[17px] text-primary hover:text-primary">
                      {pursuit.firm}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{pursuit.disputeNature ?? "–"}</td>
                  <td className="px-4 py-3">
                    <OwnerAvatar initials={directorInitials(directors, pursuit.ownerId)} name={directorName(directors, pursuit.ownerId)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-sans text-[13px] text-muted">{shortDate(pursuit.stageChangedAt)}</td>
                  {dormant && (
                    <td className="px-4 py-3 text-muted">
                      {pursuit.reviewDue ? "Review" : "–"}
                      {pursuit.reviewDue && (
                        <span className="ml-2 font-sans text-[13px]  text-muted">due {dueLabel(pursuit.reviewDue)}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted">{change?.meta?.reason ?? "–"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
