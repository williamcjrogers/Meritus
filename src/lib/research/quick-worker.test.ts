// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db/research-quick", () => ({
  leaseQuickQuestion: vi.fn(), findQuickEvidence: vi.fn(), attachQuickEvidence: vi.fn(),
  finishQuickQuestion: vi.fn(), finishQuickUnchanged: vi.fn(), failQuickQuestion: vi.fn(),
}));
vi.mock("@/lib/db/research", () => ({ reserveResearchModel: vi.fn(), settleResearchModel: vi.fn() }));
vi.mock("./roles", () => ({ readResearchActor: vi.fn() }));
vi.mock("@/lib/ai/model", () => ({
  assertAiConfigured: vi.fn(), getLanguageModel: vi.fn(() => "test-model"), LANGUAGE_MODEL_ID: "test-model",
}));
vi.mock("ai", () => ({ generateText: vi.fn(), Output: { object: vi.fn(() => "structured-output") } }));

import { generateText } from "ai";
import { runQuickResearchQuestion, type QuickWorkerDeps } from "./quick-worker";
import {
  prepareQuickAnswer, QUICK_RESEARCH_MAX_OUTPUT_TOKENS,
  QUICK_RESEARCH_PROMPT_VERSION, QUICK_RESEARCH_SYSTEM, quickEvidenceHash,
} from "./quick-answer";
import type { EvidencePassage } from "./workflow-types";
import type { QuickJob } from "./quick-types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const job: QuickJob = {
  id: id(1), owner: "director-1", leaseToken: 4, question: "How quickly are invoices paid?",
  investigationId: id(2), runId: id(3), monitoring: true,
  lastEvidenceHash: null, hasCurrentAnswer: false,
};
const passage: EvidencePassage = {
  documentId: id(4), versionId: id(5), passageId: id(6), sourceId: id(7),
  title: "Payment record", url: "https://example.test/payment", locator: { page: 1 },
  text: "The company reported paying invoices in 35 days.",
  retrievedAt: "2026-09-12T00:00:00Z", publishedAt: null, eventAt: null,
  attribution: "Published record",
};
const answer = {
  findings: [{
    text: "The record reports payment in 35 days.", kind: "observation" as const,
    evidence: [{ documentId: id(4), versionId: id(5), passageId: id(6) }],
    quotation: "paying invoices in 35 days",
  }],
  limitations: ["This record covers one reporting period."],
};
type MockDeps = { [K in keyof QuickWorkerDeps]: Mock<QuickWorkerDeps[K]> };
function setup() {
  const deps: MockDeps = {
    leaseQuickQuestion: vi.fn().mockResolvedValue({ ...job }),
    readResearchActor: vi.fn().mockResolvedValue({ userId: job.owner, role: "director" }),
    findQuickEvidence: vi.fn().mockResolvedValue([passage]),
    attachQuickEvidence: vi.fn().mockResolvedValue(true),
    finishQuickQuestion: vi.fn().mockResolvedValue(true),
    finishQuickUnchanged: vi.fn().mockResolvedValue(true),
    failQuickQuestion: vi.fn().mockResolvedValue(undefined),
    assertAiConfigured: vi.fn(),
    reserveResearchModel: vi.fn().mockResolvedValue("reservation-1"),
    settleResearchModel: vi.fn().mockResolvedValue(undefined),
    generateAnswer: vi.fn().mockResolvedValue({ output: answer, totalTokens: 1250 }),
  };
  const controller = new AbortController();
  return { deps, controller, run: () => runQuickResearchQuestion(controller.signal, deps) };
}
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("bounded automatic research worker", () => {
  it("does nothing and spends nothing when no question is due", async () => {
    const { deps, run } = setup();
    deps.leaseQuickQuestion.mockResolvedValue(null);
    expect(await run()).toEqual({ status: "idle" });
    expect(deps.readResearchActor).not.toHaveBeenCalled();
    expect(deps.assertAiConfigured).not.toHaveBeenCalled();
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
  });

  it("stores an honest empty answer without AI configuration or spend", async () => {
    const { deps, run } = setup();
    deps.findQuickEvidence.mockResolvedValue([]);
    expect(await run()).toEqual({ status: "complete" });
    expect(deps.assertAiConfigured).not.toHaveBeenCalled();
    expect(deps.generateAnswer).not.toHaveBeenCalled();
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.finishQuickQuestion).toHaveBeenCalledWith(job, expect.objectContaining({
      answer: { findings: [], limitations: expect.arrayContaining([expect.stringContaining("More source material may be needed")]) },
      evidence: [], evidenceHash: quickEvidenceHash([]), modelId: "none",
    }));
  });

  it("skips a daily AI answer only when the same exact evidence set still has a current answer", async () => {
    const { deps, run } = setup();
    const second = { ...passage, passageId: id(10) };
    const evidenceHash = quickEvidenceHash([passage, second]);
    const monitored = { ...job, hasCurrentAnswer: true, lastEvidenceHash: evidenceHash };
    deps.leaseQuickQuestion.mockResolvedValue(monitored);
    deps.findQuickEvidence.mockResolvedValue([second, passage]);
    expect(await run()).toEqual({ status: "unchanged" });
    expect(deps.finishQuickUnchanged).toHaveBeenCalledWith(monitored, evidenceHash);
    expect(deps.assertAiConfigured).not.toHaveBeenCalled();
    expect(deps.generateAnswer).not.toHaveBeenCalled();
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
  });

  it("regenerates an invalidated answer even when its previous hash matches", async () => {
    const { deps, run } = setup();
    deps.leaseQuickQuestion.mockResolvedValue({ ...job, lastEvidenceHash: quickEvidenceHash([passage]), hasCurrentAnswer: false });
    expect(await run()).toEqual({ status: "complete" });
    expect(deps.finishQuickUnchanged).not.toHaveBeenCalled();
    expect(deps.generateAnswer).toHaveBeenCalledTimes(1);
  });

  it.each(["client", "unknown"] as const)("checks that the owner is still a director before reading or spending (%s)", async (role) => {
    const { deps, run } = setup();
    deps.readResearchActor.mockResolvedValue({ userId: job.owner, role });
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.findQuickEvidence).not.toHaveBeenCalled();
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion).toHaveBeenCalledWith(job, "Research access is no longer available for this question.", true);
  });

  it("fails closed if access is unavailable or withdrawn during evidence lookup", async () => {
    const { deps, run } = setup();
    deps.readResearchActor.mockResolvedValueOnce({ userId: job.owner, role: "director" })
      .mockResolvedValueOnce({ userId: job.owner, role: "client" });
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.generateAnswer).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion).toHaveBeenCalledWith(job, "Research access is no longer available for this question.", true);
  });

  it("keeps monitoring enabled when checking the director role fails transiently", async () => {
    const { deps, run } = setup();
    deps.readResearchActor.mockRejectedValue(new Error("actor_unavailable"));
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion.mock.calls[0]).toHaveLength(2);
  });

  it("fences the evidence attachment before reserving spend and reuses the leased run", async () => {
    const { deps, run } = setup();
    deps.attachQuickEvidence.mockResolvedValue(false);
    expect(await run()).toEqual({ status: "lease_lost" });
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion).not.toHaveBeenCalled();
  });

  it("uses one bounded answer and a conservative charge, then asks the repository to recheck its refs", async () => {
    const { deps, run } = setup();
    expect(await run()).toEqual({ status: "complete" });
    expect(deps.reserveResearchModel).toHaveBeenCalledExactlyOnceWith({ sourceId: passage.sourceId, runId: job.runId, tokens: 30000, pence: 200 });
    expect(deps.generateAnswer).toHaveBeenCalledTimes(1);
    expect(deps.attachQuickEvidence).toHaveBeenCalledWith(job, [passage]);
    expect(deps.settleResearchModel).toHaveBeenCalledExactlyOnceWith("reservation-1", { tokens: 1250, pence: 200 });
    expect(deps.finishQuickQuestion).toHaveBeenCalledWith(job, expect.objectContaining({
      evidence: [passage], evidenceHash: quickEvidenceHash([passage]),
      modelId: "test-model", promptVersion: QUICK_RESEARCH_PROMPT_VERSION,
    }));
    expect(deps.readResearchActor.mock.invocationCallOrder[1]).toBeLessThan(deps.reserveResearchModel.mock.invocationCallOrder[0]);
    expect(deps.attachQuickEvidence.mock.invocationCallOrder[0]).toBeLessThan(deps.reserveResearchModel.mock.invocationCallOrder[0]);
    expect(deps.settleResearchModel.mock.invocationCallOrder[0]).toBeLessThan(deps.finishQuickQuestion.mock.invocationCallOrder[0]);
  });

  it("does not spend when AI configuration is missing, but saves a useful failure state", async () => {
    const { deps, run } = setup();
    deps.assertAiConfigured.mockImplementation(() => { throw new Error("SECRET config URL"); });
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.reserveResearchModel).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion).toHaveBeenCalledWith(job, "Automatic research is not configured yet.");
  });

  it("cannot start another model call after a reclaimed run has exhausted its cap", async () => {
    const { deps, run } = setup();
    deps.reserveResearchModel.mockRejectedValue(new Error("run_budget"));
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.generateAnswer).not.toHaveBeenCalled();
    expect(deps.settleResearchModel).not.toHaveBeenCalled();
    expect(deps.reserveResearchModel.mock.calls[0][0].runId).toBe(job.runId);
  });

  it.each([undefined, NaN, -1, 1.5, 40000])("keeps token accounting within its ceiling for invalid or excessive usage (%s)", async (totalTokens) => {
    const { deps, run } = setup();
    deps.generateAnswer.mockResolvedValue({ output: answer, totalTokens });
    expect(await run()).toEqual({ status: "complete" });
    expect(deps.settleResearchModel).toHaveBeenCalledWith("reservation-1", { tokens: 30000, pence: 200 });
  });

  it("retains the full charge on provider failure without logging or storing source text", async () => {
    const { deps, run } = setup();
    deps.generateAnswer.mockRejectedValue(new Error(`Provider failed: SECRET ${passage.text}`));
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.settleResearchModel).toHaveBeenCalledExactlyOnceWith("reservation-1", null);
    expect(deps.finishQuickQuestion).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion.mock.calls[0][1]).not.toMatch(/SECRET|35 days/);
  });

  it("rejects a quotation outside the model's exact clipped text and retains the charge", async () => {
    const { deps, run } = setup();
    deps.findQuickEvidence.mockResolvedValue([{ ...passage, text: passage.text + " Preamble. ".repeat(1000) + "Hidden unrelated sentence." }]);
    deps.generateAnswer.mockResolvedValue({ output: {
      ...answer, findings: [{ ...answer.findings[0], quotation: "Hidden unrelated sentence." }],
    }, totalTokens: 1250 });
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.settleResearchModel).toHaveBeenCalledExactlyOnceWith("reservation-1", null);
    expect(deps.finishQuickQuestion).not.toHaveBeenCalled();
  });

  it("answers using the relevant exact excerpt late in a long stored passage", async () => {
    const { deps, run } = setup();
    deps.findQuickEvidence.mockResolvedValue([{ ...passage, text: "Preamble. ".repeat(1000) + passage.text }]);
    expect(await run()).toEqual({ status: "complete" });
    expect(deps.generateAnswer.mock.calls[0][0]).toContain(passage.text);
    const committed = deps.finishQuickQuestion.mock.calls[0][1];
    expect(committed.evidence[0].text).toContain(answer.findings[0].quotation);
    expect(committed.answer.findings).toEqual(answer.findings);
  });

  it("returns lease_lost when the repository refuses stale or withdrawn refs at completion", async () => {
    const { deps, run } = setup();
    deps.finishQuickQuestion.mockResolvedValue(false);
    expect(await run()).toEqual({ status: "lease_lost" });
    expect(deps.settleResearchModel).toHaveBeenCalledWith("reservation-1", { tokens: 1250, pence: 200 });
    expect(deps.failQuickQuestion).not.toHaveBeenCalled();
  });

  it("does not overwrite another lease if unchanged completion loses its fencing check", async () => {
    const { deps, run } = setup();
    deps.leaseQuickQuestion.mockResolvedValue({ ...job, hasCurrentAnswer: true, lastEvidenceHash: quickEvidenceHash([passage]) });
    deps.finishQuickUnchanged.mockResolvedValue(false);
    expect(await run()).toEqual({ status: "lease_lost" });
    expect(deps.generateAnswer).not.toHaveBeenCalled();
    expect(deps.failQuickQuestion).not.toHaveBeenCalled();
  });

  it("retains reservation accounting when settlement or recording fails", async () => {
    const { deps, run } = setup();
    deps.settleResearchModel.mockRejectedValue(new Error("database unavailable SECRET"));
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.settleResearchModel).toHaveBeenLastCalledWith("reservation-1", null);
    expect(deps.failQuickQuestion).toHaveBeenCalledTimes(1);
    expect(deps.finishQuickQuestion).not.toHaveBeenCalled();
  });

  it("stops before leasing when the request is already cancelled", async () => {
    const { deps, controller, run } = setup();
    controller.abort();
    expect(await run()).toEqual({ status: "failed" });
    expect(deps.leaseQuickQuestion).not.toHaveBeenCalled();
  });

  it("honours parent cancellation during generation even if the provider ignores abort", async () => {
    const { deps, controller, run } = setup();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let suppliedSignal: AbortSignal | undefined;
    deps.generateAnswer.mockImplementation((_, signal) => {
      suppliedSignal = signal;
      started();
      return new Promise(() => {});
    });
    const pending = run();
    await ready;
    controller.abort();
    expect(await pending).toEqual({ status: "failed" });
    expect(suppliedSignal?.aborted).toBe(true);
    expect(deps.settleResearchModel).toHaveBeenCalledWith("reservation-1", null);
    expect(deps.finishQuickQuestion).not.toHaveBeenCalled();
  });

  it("aborts at 80 seconds, settles conservatively and clears its timer", async () => {
    vi.useFakeTimers();
    const { deps, run } = setup();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    deps.generateAnswer.mockImplementation(() => {
      started();
      return new Promise(() => {});
    });
    const pending = run();
    await ready;
    await vi.advanceTimersByTimeAsync(80000);
    expect(await pending).toEqual({ status: "failed" });
    expect(deps.settleResearchModel).toHaveBeenCalledWith("reservation-1", null);
    expect(deps.failQuickQuestion).toHaveBeenCalledWith(job, "The research check did not finish in time. Please try again.");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses the existing language model with structured output, no tools and no automatic retry", async () => {
    const { deps, controller } = setup();
    const { generateAnswer: _generateAnswer, ...overrides } = deps;
    void _generateAnswer;
    vi.mocked(generateText).mockResolvedValue({ output: answer, totalUsage: { totalTokens: 1250 } } as never);
    expect(await runQuickResearchQuestion(controller.signal, overrides)).toEqual({ status: "complete" });
    expect(generateText).toHaveBeenCalledExactlyOnceWith({
      model: "test-model", system: QUICK_RESEARCH_SYSTEM,
      prompt: prepareQuickAnswer(job.question, [passage]).prompt,
      output: "structured-output", maxOutputTokens: QUICK_RESEARCH_MAX_OUTPUT_TOKENS,
      maxRetries: 0, abortSignal: expect.any(AbortSignal),
    });
  });
});
