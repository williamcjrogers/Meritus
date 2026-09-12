import { generateText, Output } from "ai";
import { assertAiConfigured, getLanguageModel, LANGUAGE_MODEL_ID } from "@/lib/ai/model";
import { reserveResearchModel, settleResearchModel } from "@/lib/db/research";
import {
  attachQuickEvidence,
  failQuickQuestion,
  findQuickEvidence,
  finishQuickQuestion,
  finishQuickUnchanged,
  leaseQuickQuestion,
} from "@/lib/db/research-quick";
import { readResearchActor, type ResearchActor } from "./roles";
import { answerSchema } from "./report-schema";
import {
  emptyQuickAnswer,
  prepareQuickAnswer,
  QUICK_RESEARCH_MAX_OUTPUT_TOKENS,
  QUICK_RESEARCH_PROMPT_VERSION,
  QUICK_RESEARCH_SYSTEM,
  quickEvidenceHash,
  validateQuickAnswer,
} from "./quick-answer";
import {
  QUICK_RESEARCH_COST_PENCE,
  QUICK_RESEARCH_TOKENS,
  type QuickAnswer,
  type QuickJob,
} from "./quick-types";
import type { EvidencePassage } from "./workflow-types";

export type QuickWorkerResult = {
  status: "idle" | "complete" | "unchanged" | "failed" | "lease_lost";
};
export type QuickWorkerDeps = {
  leaseQuickQuestion: () => Promise<QuickJob | null>;
  readResearchActor: (owner: string) => Promise<ResearchActor>;
  findQuickEvidence: (question: string) => Promise<EvidencePassage[]>;
  attachQuickEvidence: (job: QuickJob, evidence: EvidencePassage[]) => Promise<boolean>;
  finishQuickQuestion: (job: QuickJob, input: {
    answer: QuickAnswer;
    evidence: EvidencePassage[];
    evidenceHash: string;
    modelId: string;
    promptVersion: string;
  }) => Promise<boolean>;
  finishQuickUnchanged: (job: QuickJob, hash: string) => Promise<boolean>;
  failQuickQuestion: (job: QuickJob, error: string, stopMonitoring?: boolean) => Promise<unknown>;
  assertAiConfigured: () => void;
  reserveResearchModel: typeof reserveResearchModel;
  settleResearchModel: typeof settleResearchModel;
  generateAnswer: (prompt: string, signal: AbortSignal) => Promise<{
    output: unknown;
    totalTokens?: number;
  }>;
};

const defaultDeps: QuickWorkerDeps = {
  leaseQuickQuestion,
  readResearchActor,
  findQuickEvidence,
  attachQuickEvidence,
  finishQuickQuestion,
  finishQuickUnchanged,
  failQuickQuestion,
  assertAiConfigured,
  reserveResearchModel,
  settleResearchModel,
  async generateAnswer(prompt, signal) {
    const result = await generateText({
      model: getLanguageModel(),
      system: QUICK_RESEARCH_SYSTEM,
      prompt,
      output: Output.object({ schema: answerSchema }),
      maxOutputTokens: QUICK_RESEARCH_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal: signal,
    });
    return { output: result.output, totalTokens: result.totalUsage.totalTokens };
  },
};

function safeFailure(error: unknown, aborted: boolean): string {
  if (aborted) return "The research check did not finish in time. Please try again.";
  const code = error instanceof Error ? error.message : "";
  if (code === "quick_owner_unavailable") {
    return "Research access is no longer available for this question.";
  }
  if (["run_budget", "daily_model_budget", "model_capacity"].includes(code)) {
    return "Research could not run within the current spending or capacity limit. Please try again later.";
  }
  if (["source_unavailable", "rights_unavailable"].includes(code)) {
    return "The source material is not currently available for this research check.";
  }
  if (code === "quick_ai_unconfigured") {
    return "Automatic research is not configured yet.";
  }
  return "The research answer could not be completed and checked against the collected evidence. Please try again.";
}

/** Stop waiting for a provider even if its promise ignores the abort signal. */
async function abortable<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return work();
      }),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

export async function runQuickResearchQuestion(
  parentSignal: AbortSignal,
  overrides: Partial<QuickWorkerDeps> = {},
): Promise<QuickWorkerResult> {
  const deps: QuickWorkerDeps = { ...defaultDeps, ...overrides };
  const controller = new AbortController();
  const signal = AbortSignal.any([parentSignal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), 80000);
  let job: QuickJob | null = null;
  let reservation: string | null = null;
  let settled = false;
  try {
    signal.throwIfAborted();
    job = await deps.leaseQuickQuestion();
    if (!job) return { status: "idle" };
    signal.throwIfAborted();
    const actor = await abortable(() => deps.readResearchActor(job!.owner), signal);
    if (actor.role !== "director" || actor.userId !== job.owner) {
      throw new Error("quick_owner_unavailable");
    }
    const retrieved = await abortable(() => deps.findQuickEvidence(job!.question), signal);
    const { evidence, prompt } = prepareQuickAnswer(job.question, retrieved);
    const evidenceHash = quickEvidenceHash(evidence);
    signal.throwIfAborted();
    if (job.hasCurrentAnswer && job.lastEvidenceHash === evidenceHash) {
      const finished = await deps.finishQuickUnchanged(job, evidenceHash);
      return { status: finished ? "unchanged" : "lease_lost" };
    }
    if (!evidence.length) {
      const finished = await deps.finishQuickQuestion(job, {
        answer: emptyQuickAnswer(), evidence, evidenceHash,
        modelId: "none", promptVersion: QUICK_RESEARCH_PROMPT_VERSION,
      });
      return { status: finished ? "complete" : "lease_lost" };
    }
    if (!(await deps.attachQuickEvidence(job, evidence))) return { status: "lease_lost" };
    signal.throwIfAborted();
    // Recheck immediately before spending, after evidence lookup and its fencing check.
    const currentActor = await abortable(() => deps.readResearchActor(job!.owner), signal);
    if (currentActor.role !== "director" || currentActor.userId !== job.owner) {
      throw new Error("quick_owner_unavailable");
    }
    try {
      deps.assertAiConfigured();
    } catch {
      throw new Error("quick_ai_unconfigured");
    }
    signal.throwIfAborted();
    reservation = await deps.reserveResearchModel({
      sourceId: evidence[0].sourceId,
      runId: job.runId,
      tokens: QUICK_RESEARCH_TOKENS,
      pence: QUICK_RESEARCH_COST_PENCE,
    });
    signal.throwIfAborted();
    const result = await abortable(() => deps.generateAnswer(prompt, signal), signal);
    signal.throwIfAborted();
    const answer = validateQuickAnswer(result.output, evidence);
    const tokens = Number.isSafeInteger(result.totalTokens) && result.totalTokens! >= 0
      ? Math.min(result.totalTokens!, QUICK_RESEARCH_TOKENS)
      : QUICK_RESEARCH_TOKENS;
    await deps.settleResearchModel(reservation, { tokens, pence: QUICK_RESEARCH_COST_PENCE });
    settled = true;
    signal.throwIfAborted();
    const finished = await deps.finishQuickQuestion(job, {
      answer, evidence, evidenceHash,
      modelId: LANGUAGE_MODEL_ID, promptVersion: QUICK_RESEARCH_PROMPT_VERSION,
    });
    return { status: finished ? "complete" : "lease_lost" };
  } catch (error) {
    if (reservation && !settled) {
      // Null usage retains the reserved ceiling, including provider and validation failures.
      try { await deps.settleResearchModel(reservation, null); } catch { /* Reservation remains charged. */ }
    }
    if (job) {
      try {
        const message = safeFailure(error, signal.aborted);
        if (error instanceof Error && error.message === "quick_owner_unavailable") {
          await deps.failQuickQuestion(job, message, true);
        } else {
          await deps.failQuickQuestion(job, message);
        }
      } catch { /* The lease can expire safely. */ }
    }
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
