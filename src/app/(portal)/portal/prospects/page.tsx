import Link from "next/link";
import { Eyebrow } from "@/components/portal/Eyebrow";
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

const VIEWS: ProspectView[] = ["approachable", "all", "excluded"];

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

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
      <div>
        <Eyebrow rule={false}>Target firms</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Prospects</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          Outbound organisations ranked by the value Meritus would bring — not inbound
          pursuits, and not the public enquiry inbox. Ranked on 10 September 2026 by need,
          gap, capacity and access.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((item) => {
          const active = item === view;
          return (
            <Link
              key={item}
              href={item === "approachable" ? "/portal/prospects" : `/portal/prospects?view=${item}`}
              className={`border px-3 py-1.5 text-[12px] ${
                active
                  ? "border-brass bg-brass text-green"
                  : "border-green/15 text-green hover:border-brass hover:text-brass"
              }`}
            >
              {prospectViewLabel(item)}
              <span className={`ml-2 font-mono ${active ? "text-green/70" : "text-ink/55"}`}>
                {counts[item]}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="max-w-2xl text-[14px] text-ink/70">{prospectViewDescription(view)}</p>

      <ProspectsTable rows={rows} />

      <p className="max-w-3xl text-[12px] leading-relaxed text-ink/70">
        {totalSeeded} organisations in the ranking file. Need, gap, capacity and access are
        judgement scores, not measured quantities. Rank is by those weights — not by assumed
        adversity or any other firm&apos;s book.
      </p>
    </div>
  );
}
