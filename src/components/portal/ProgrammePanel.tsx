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
      title="Programme analysis"
      actions={
        <Link href="/portal/programmes" className="app-button app-button--ghost">
          All programmes
        </Link>
      }
    >
      <p className="mb-4 text-[13px] text-muted">
        Upload an Asta, Primavera P6, Microsoft Project or CSV export. Native Asta files can be inspected; XML or CSV is needed to analyse activities and the critical path.
      </p>
      <ProgrammeUpload pursuitId={pursuitId} />
      <ul className="mt-4 divide-y divide-line">
        {programmes.map((item) => (
          <li key={item.id} className="py-3">
            <Link href={`/portal/programmes/${item.id}`} className="text-[13px] text-primary hover:text-primary">
              {item.fileName}
            </Link>
            <p className="font-sans text-[13px]  text-muted">
              {item.parseStatus}
              {item.report?.method ? ` · ${item.report.method}` : ""}
              {item.report?.healthScore != null ? ` · health ${item.report.healthScore}` : ""}
              {item.highIssues ? ` · ${item.highIssues} high issue${item.highIssues === 1 ? "" : "s"}` : ""}
            </p>
          </li>
        ))}
        {programmes.length === 0 && <li className="py-3 text-[13px] text-muted">No programmes on this pursuit.</li>}
      </ul>
    </Panel>
  );
}
