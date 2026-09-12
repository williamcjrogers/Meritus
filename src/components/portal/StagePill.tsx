import type { PursuitStage } from "@/lib/db/schema";
import { stageLabel } from "@/lib/portal/stages";

const TONES: Record<PursuitStage, string> = {
  enquiry: "border-line text-primary",
  scoping: "border-line text-primary",
  proposal: "border-primary/50 text-primary",
  instructed: "border-primary bg-primary/10 text-primary",
  declined: "border-danger/30 text-danger",
  dormant: "border-line text-muted",
};

export function StagePill({ stage, className = "" }: { stage: PursuitStage; className?: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-[2px] font-sans text-[13px]   ${TONES[stage]} ${className}`}
    >
      {stageLabel(stage)}
    </span>
  );
}
