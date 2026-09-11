"use client";

import Link from "next/link";
import type { ProgrammeListItem } from "@/lib/programme/view";
import { Panel } from "./Panel";
import { ProgrammeUpload } from "./ProgrammeUpload";

export function ProgrammePanel({
  pursuitId,
  programmes,
}: {
  pursuitId: string;
  programmes: ProgrammeListItem[];
}) {
  return (
    <Panel
      eyebrow="Programme"
      title="Intelligence"
      actions={
        <Link href="/portal/programmes" className="btn-quiet">
          All programmes
        </Link>
      }
    >
      <p className="mb-4 text-[13px] text-ink/70">
        Ingest an Asta, P6, MSP or CSV export. Figures cite the block engine. Native .pp files are inspected; XML or CSV is needed for activity-level CPM.
      </p>
      <ProgrammeUpload pursuitId={pursuitId} />
      <ul className="mt-4 divide-y divide-green/10">
        {programmes.map((item) => (
          <li key={item.id} className="py-3">
            <Link href={`/portal/programmes/${item.id}`} className="text-[13px] text-green hover:text-brass">
              {item.fileName}
            </Link>
            <p className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
              {item.parseStatus}
              {item.report?.method ? ` · ${item.report.method}` : ""}
              {item.report?.healthScore != null ? ` · health ${item.report.healthScore}` : ""}
              {item.highIssues ? ` · ${item.highIssues} high issue${item.highIssues === 1 ? "" : "s"}` : ""}
            </p>
          </li>
        ))}
        {programmes.length === 0 && <li className="py-3 text-[13px] text-ink/70">No programmes on this pursuit.</li>}
      </ul>
    </Panel>
  );
}
