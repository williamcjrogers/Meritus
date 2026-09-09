"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { PursuitStage } from "@/lib/db/schema";
import { BOARD_STAGES, stageLabel } from "@/lib/portal/stages";
import type { ActionResult } from "@/lib/portal/types";

/** The four stages a pursuit steps through, in order. Declined and Dormant sit outside the stepper. */
export const STEPPER_STAGES: readonly PursuitStage[] = [...BOARD_STAGES, "instructed"];

/**
 * An ordered list of four buttons. A move commits on click, Enter or Space only;
 * the arrow keys move focus between the steps without committing.
 */
export function Stepper({
  current,
  onMove,
}: {
  current: PursuitStage;
  onMove: (to: PursuitStage) => Promise<ActionResult> | ActionResult;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const currentIndex = STEPPER_STAGES.indexOf(current);

  async function commit(to: PursuitStage) {
    if (busy || to === current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onMove(to);
      if (!result.ok) setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong, try again");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const items = buttons.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.findIndex((item) => item === document.activeElement);
    if (index < 0) return;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div>
      <ol aria-label="Stage" onKeyDown={onKeyDown} className="flex items-center gap-2">
        {STEPPER_STAGES.map((stage, index) => {
          const label = stageLabel(stage);
          const isCurrent = stage === current;
          const reached = currentIndex >= 0 && index <= currentIndex;
          return (
            <li key={stage} className={`flex items-center gap-2 ${index > 0 ? "flex-1" : ""}`}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px min-w-4 flex-1 ${reached ? "bg-brass/60" : "bg-green/15"}`}
                />
              )}
              <button
                ref={(el) => {
                  buttons.current[index] = el;
                }}
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                aria-label={isCurrent ? `${label}, current stage` : `Move to ${label}`}
                disabled={busy}
                onClick={() => void commit(stage)}
                className={`group inline-flex items-center gap-2 py-1 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors disabled:opacity-50 ${
                  isCurrent ? "text-green" : "text-ink/60 hover:text-green"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-2.5 w-2.5 rounded-full border ${
                    isCurrent
                      ? "border-brass bg-brass"
                      : reached
                        ? "border-green bg-green"
                        : "border-green/40 bg-transparent group-hover:border-brass"
                  }`}
                />
                {label}
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
    </div>
  );
}
