import type { SourceSettings } from "@/lib/db/research-workflow";
import { date } from "./ResearchControls";
export function SourceHealth({ source }: { source: SourceSettings }) {
  return (
    <div className="space-y-1">
      <span className="font-medium">
        {source.status === "ready"
          ? "Available for research"
          : source.status === "paused"
            ? "Paused"
            : "Unavailable"}
      </span>
      {source.configurationError && (
        <p className="text-sm text-amber-900">{source.configurationError}</p>
      )}
      <p className="text-xs text-ink/65">
        Last successful retrieval: {date(source.lastSuccessAt)}
      </p>
    </div>
  );
}
