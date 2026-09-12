export const metadata = { title: "Prospects" };
import { requireWorkspacePage } from "@/lib/portal/auth";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProspectsTable } from "@/components/portal/ProspectsTable";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { countProspects, countProspectsByView, listProspects } from "@/lib/db/prospects";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import {
  isProspectView,
  prospectViewDescription,
  prospectViewLabel,
  type ProspectView,
} from "@/lib/prospects/model";
import { ensureProspectsSeeded } from "@/lib/prospects/seed";

export const dynamic = "force-dynamic";

const VIEWS: ProspectView[] = ["approachable", "conflicted", "all", "excluded"];

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  await requireWorkspacePage("/portal/prospects");

  const params = await searchParams;
  const view = params.view && isProspectView(params.view) ? params.view : "approachable";

  let rows;
  let counts: Record<ProspectView, number>;
  let totalSeeded: number;
  try {
    await ensureProspectsSeeded();
    [rows, counts, totalSeeded] = await Promise.all([
      listProspects(view),
      countProspectsByView(),
      countProspects(),
    ]);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader title="Prospects" description="Organisations to approach, ranked by the value Meritus can bring. Review the opportunity, record contact and develop a pursuit." actions={<Link className="app-button app-button--secondary" href="/portal/pursuits">View pursuits</Link>} />

      <nav aria-label="Prospect views" className="workspace-local-nav">
        {VIEWS.map((item) => {
          const active = item === view;
          return (
            <Link
              key={item}
              aria-current={active ? "page" : undefined}
              href={item === "approachable" ? "/portal/prospects" : `/portal/prospects?view=${item}`}
              className={`border px-3 py-1.5 text-[13px] ${
                active
                  ? "border-primary bg-primary text-surface"
                  : "border-line text-primary hover:border-primary hover:text-primary"
              }`}
            >
              {prospectViewLabel(item)}
              <span className={`ml-2 font-sans ${active ? "text-surface" : "text-muted"}`}>
                {counts[item]}
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="max-w-2xl text-[15px] text-muted">{prospectViewDescription(view)}</p>

      <ProspectsTable rows={rows} />

      <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
        {totalSeeded} organisations in the ranking file. Need, gap, capacity and access are
        judgement scores, not measured quantities. Conflict tiers reflect the BREE tracker
        only, they are not an independent conflict check.
      </p>
    </div>
  );
}
