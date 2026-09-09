import type { PursuitStage } from "@/lib/db/schema";
import { stageLabel } from "@/lib/portal/stages";

const TONES: Record<PursuitStage, string> = {
  enquiry: "border-green/20 text-green",
  scoping: "border-green/20 text-green",
  proposal: "border-brass/50 text-green",
  instructed: "border-brass bg-brass/10 text-green",
  declined: "border-oxblood/30 text-oxblood",
  dormant: "border-green/15 text-ink/70",
};

export function StagePill({ stage, className = "" }: { stage: PursuitStage; className?: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-[2px] font-mono text-[10px] tracking-[0.15em] uppercase ${TONES[stage]} ${className}`}
    >
      {stageLabel(stage)}
    </span>
  );
}
