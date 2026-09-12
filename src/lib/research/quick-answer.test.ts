// @vitest-environment node
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  emptyQuickAnswer,
  prepareQuickAnswer,
  QUICK_RESEARCH_COVERAGE_NOTE,
  QUICK_RESEARCH_MAX_PROMPT_BYTES,
  QUICK_RESEARCH_SYSTEM,
  quickEvidenceHash,
  validateQuickAnswer,
} from "./quick-answer";
import type { EvidencePassage } from "./workflow-types";
import { extractEnvelope } from "./extract/pipeline";
import { paymentEvidence } from "./sources/payment-practices";
import type { SourceEnvelope } from "./contracts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const passage: EvidencePassage = {
  documentId: id(1), versionId: id(2), passageId: id(3), sourceId: id(4),
  title: "Payment record", url: "https://example.test/payment",
  locator: { page: 1 }, text: "The company reported paying invoices in 35 days.",
  retrievedAt: "2026-09-12T00:00:00Z", publishedAt: null, eventAt: null,
  attribution: "Published record",
};
const finding = {
  text: "The record states that invoices were paid in 35 days.",
  kind: "observation" as const,
  quotation: "paying invoices in 35 days",
  evidence: [{ documentId: id(1), versionId: id(2), passageId: id(3) }],
};
function sourceEnvelope(body: string, contentType: string, provider: string): SourceEnvelope {
  return {
    sourceId: passage.sourceId, providerId: "synthetic-record", url: passage.url,
    retrievedAt: passage.retrievedAt, publishedAt: "2026-09-01T00:00:00Z",
    updatedAt: null, eventAt: "2026-08-31T00:00:00Z", contentType,
    body: new TextEncoder().encode(body), metadata: { provider },
  };
}

describe("quick research evidence boundaries", () => {
  it("hashes sorted exact document, version and passage tuples independent of order and duplicates", () => {
    const second = { ...passage, passageId: id(5) };
    expect(quickEvidenceHash([passage, second])).toBe(quickEvidenceHash([second, passage, passage]));
    expect(quickEvidenceHash([passage])).not.toBe(quickEvidenceHash([{ ...passage, versionId: id(9) }]));
    expect(quickEvidenceHash([passage])).not.toBe(quickEvidenceHash([{ ...passage, documentId: id(9) }]));
    expect(quickEvidenceHash([passage])).not.toBe(quickEvidenceHash([{ ...passage, passageId: id(9) }]));
    expect(quickEvidenceHash([])).toMatch(/^[a-f0-9]{64}$/);
  });

  it("caps passage count, escaped prompt bytes and source text even for control characters", () => {
    const passages = Array.from({ length: 30 }, (_, i) => ({
      ...passage,
      passageId: id(i + 100),
      title: "\u0000".repeat(100000),
      text: "\u0000".repeat(100000),
      locator: { privateMetadata: "must not appear".repeat(100000) },
    }));
    const { evidence, prompt } = prepareQuickAnswer("\u0000".repeat(2000), passages);
    expect(evidence).toHaveLength(12);
    expect(Buffer.byteLength(prompt + QUICK_RESEARCH_SYSTEM)).toBeLessThanOrEqual(QUICK_RESEARCH_MAX_PROMPT_BYTES);
    expect(prompt).not.toContain("privateMetadata");
    const supplied = JSON.parse(prompt).passages;
    expect(supplied.map((p: { text: string }) => p.text)).toEqual(evidence.map((p) => p.text));
    expect(evidence.every((p) => passages[0].text.startsWith(p.text))).toBe(true);
  });

  it("preserves exact Unicode substrings and exposes no unseen suffix", () => {
    const text = "Payment 💷 café. ".repeat(1000) + "Hidden result";
    const { evidence, prompt } = prepareQuickAnswer("What happened?", [{ ...passage, text }]);
    expect(text.startsWith(evidence[0].text)).toBe(true);
    expect(prompt).not.toContain("Hidden result");
    expect(evidence[0].text).not.toContain("\ufffd");
    expect(JSON.parse(prompt).passages[0].text).toBe(evidence[0].text);
  });

  it("includes metric labels and dates from the actual payment extraction, even when each passage is a scalar", async () => {
    const row = {
      "Company name": "Acme Construction Ltd",
      "Company number": "00001234",
      "Start date": "2026-01-01",
      "End date": "2026-06-30",
      "Average time to pay": "35",
      "Percentage paid beyond agreed terms": "27",
    };
    const envelope = sourceEnvelope(JSON.stringify(row), "application/json", "payment-practices");
    const extracted = await extractEnvelope(envelope);
    expect(extracted.passages).toEqual(paymentEvidence(row).passages);
    const evidence = extracted.passages.map((value, i) => ({
      ...passage, ...value, passageId: id(i + 20),
      publishedAt: envelope.publishedAt, eventAt: envelope.eventAt,
    }));
    const { prompt } = prepareQuickAnswer("How long does Acme Construction take to pay?", evidence);
    const supplied = JSON.parse(prompt).passages;
    expect(supplied).toContainEqual(expect.objectContaining({
      text: "35", locator: { kind: "field", value: "Average time to pay" },
      sourceId: passage.sourceId, attribution: passage.attribution,
      retrievedAt: passage.retrievedAt, publishedAt: envelope.publishedAt, eventAt: envelope.eventAt,
    }));
    expect(supplied).toContainEqual(expect.objectContaining({ text: "27", locator: { kind: "field", value: "Percentage paid beyond agreed terms" } }));
    expect(supplied).toContainEqual(expect.objectContaining({ text: "2026-01-01", locator: { kind: "field", value: "Start date" } }));
    expect(supplied).toContainEqual(expect.objectContaining({ text: "2026-06-30", locator: { kind: "field", value: "End date" } }));
  });

  it("preserves Companies House and procurement JSON paths so identical scalar numbers stay distinguishable", async () => {
    const envelope = sourceEnvelope(JSON.stringify({
      company_number: "00001234", company_status: "active",
      tender: { value: { amount: 350000, currency: "GBP" } },
    }), "application/json", "companies-house");
    const extracted = await extractEnvelope(envelope);
    const { prompt } = prepareQuickAnswer("What do the company and tender records state?", extracted.passages.map((value, i) => ({ ...passage, ...value, passageId: id(i + 30) })));
    const supplied = JSON.parse(prompt).passages;
    expect(supplied).toContainEqual(expect.objectContaining({ text: "active", locator: { kind: "field", value: "/company_status" } }));
    expect(supplied).toContainEqual(expect.objectContaining({ text: "350000", locator: { kind: "field", value: "/tender/value/amount" } }));
    expect(supplied).toContainEqual(expect.objectContaining({ text: "GBP", locator: { kind: "field", value: "/tender/value/currency" } }));
  });

  it("retains a late matching exact excerpt from an actual whole-body text extraction", async () => {
    const text = "Unrelated introductory history. ".repeat(2000) + passage.text;
    const extracted = await extractEnvelope(sourceEnvelope(text, "text/plain", "manual-upload"));
    expect(extracted.passages).toHaveLength(1);
    const { evidence, prompt } = prepareQuickAnswer("How quickly were invoices paid?", [{ ...passage, ...extracted.passages[0] }]);
    expect(evidence[0].text).toContain(passage.text);
    expect(text.includes(evidence[0].text)).toBe(true);
    expect(JSON.parse(prompt).passages[0]).toMatchObject({ locator: { kind: "field", value: "body" }, text: evidence[0].text });
    expect(validateQuickAnswer({ findings: [finding], limitations: [] }, evidence).findings).toEqual([finding]);
  });

  it("retains a late paid-invoices excerpt when the question asks about a payment record", async () => {
    const statement = "The contractor paid invoices in 35 days.";
    const text = "Preamble. ".repeat(1000) + statement;
    const extracted = await extractEnvelope(sourceEnvelope(text, "text/plain", "manual-upload"));
    const { evidence, prompt } = prepareQuickAnswer("What does the payment record show?", [{ ...passage, ...extracted.passages[0] }]);
    expect(evidence[0].text).toContain(statement);
    expect(text.includes(evidence[0].text)).toBe(true);
    expect(JSON.parse(prompt).passages[0].text).toContain(statement);
    expect(validateQuickAnswer({ findings: [{ ...finding, text: statement, quotation: statement }], limitations: [] }, evidence).findings[0].quotation).toBe(statement);
  });

  it.each([
    ["What does the invoice record show?", "There are invoices outstanding."],
    ["What do the invoices show?", "An invoice remains outstanding."],
    ["What does the defect record show?", "The record lists defects in the roof."],
    ["What do the defects show?", "The record describes a defect in the roof."],
  ])("retains a late singular or plural match for %s", (question, statement) => {
    const text = "Preamble. ".repeat(1000) + statement;
    const { evidence } = prepareQuickAnswer(question, [{ ...passage, text }]);
    expect(evidence[0].text).toContain(statement);
    expect(text.includes(evidence[0].text)).toBe(true);
  });

  it("keeps late Unicode page matches as exact substrings within the byte cap", () => {
    const text = "💷 café 中文. ".repeat(2000) + passage.text;
    const { evidence, prompt } = prepareQuickAnswer("How quickly were invoices paid?", [{ ...passage, text, locator: { kind: "page", value: "14" } }]);
    expect(text.includes(evidence[0].text)).toBe(true);
    expect(evidence[0].text).not.toContain("\ufffd");
    expect(evidence[0].text).toContain(passage.text);
    expect(JSON.parse(prompt).passages[0].locator).toEqual({ kind: "page", value: "14" });
    expect(Buffer.byteLength(prompt + QUICK_RESEARCH_SYSTEM)).toBeLessThanOrEqual(QUICK_RESEARCH_MAX_PROMPT_BYTES);
  });

  it("bounds escaped locator labels and metadata without copying arbitrary locator properties", () => {
    const passages = Array.from({ length: 12 }, (_, i) => ({
      ...passage, passageId: id(i + 100),
      locator: { kind: "field", value: "\u0000".repeat(100000), privateMetadata: "omit me" },
      title: "\u0000".repeat(100000), attribution: "\u0000".repeat(100000), text: "\u0000".repeat(100000),
      retrievedAt: "\u0000".repeat(1000), publishedAt: "\u0000".repeat(1000), eventAt: "\u0000".repeat(1000),
    }));
    const { prompt, evidence } = prepareQuickAnswer("\u0000".repeat(2000), passages);
    expect(evidence).toHaveLength(12);
    expect(prompt).not.toContain("privateMetadata");
    expect(Buffer.byteLength(prompt + QUICK_RESEARCH_SYSTEM)).toBeLessThanOrEqual(QUICK_RESEARCH_MAX_PROMPT_BYTES);
  });

  it("skips blank passages and duplicate passage IDs", () => {
    const result = prepareQuickAnswer("question", [
      { ...passage, passageId: id(8), text: " \n " },
      passage, passage,
    ]);
    expect(result.evidence).toEqual([passage]);
  });

  it("returns an honest empty result and missing coverage without fabricating findings", () => {
    expect(emptyQuickAnswer().findings).toEqual([]);
    expect(emptyQuickAnswer().limitations.join(" ")).toContain("This does not establish that no relevant records exist");
    expect(emptyQuickAnswer().limitations).toContain(QUICK_RESEARCH_COVERAGE_NOTE);
  });
});

describe("quick research grounded answers", () => {
  it("retains explicit observation, allegation and inference labels and adds partial-coverage wording", () => {
    for (const kind of ["observation", "allegation", "inference"] as const) {
      const answer = validateQuickAnswer({ findings: [{ ...finding, kind }], limitations: [] }, [passage]);
      expect(answer.findings[0].kind).toBe(kind);
      expect(answer.limitations).toContain(QUICK_RESEARCH_COVERAGE_NOTE);
    }
  });

  it.each(["observation", "allegation", "inference"] as const)("rejects a %s without references", (kind) => {
    expect(() => validateQuickAnswer({ findings: [{ ...finding, kind, evidence: [] }], limitations: [] }, [passage])).toThrow("quick_missing_evidence");
  });

  it.each([undefined, "", "  ", "paying invoices in 20 days", "paying  invoices in 35 days"])("rejects a missing, invented or non-verbatim quotation (%s)", (quotation) => {
    expect(() => validateQuickAnswer({ findings: [{ ...finding, quotation }], limitations: [] }, [passage])).toThrow("quick_unsupported_quote");
  });

  it.each(["documentId", "versionId", "passageId"] as const)("rejects an unsupplied exact %s", (key) => {
    expect(() => validateQuickAnswer({
      findings: [{ ...finding, evidence: [{ ...finding.evidence[0], [key]: id(9) }] }], limitations: [],
    }, [passage])).toThrow("quick_unknown_evidence");
  });

  it("rejects a quotation found only after the supplied clipped text", () => {
    const { evidence } = prepareQuickAnswer("question", [{ ...passage, text: "Beginning. ".repeat(1000) + finding.quotation }]);
    expect(() => validateQuickAnswer({ findings: [finding], limitations: [] }, evidence)).toThrow("quick_unsupported_quote");
  });

  it("rejects excessive output and an attempt to mark a finding verified", () => {
    expect(() => validateQuickAnswer({ findings: Array(9).fill(finding), limitations: [] }, [passage])).toThrow("quick_answer_too_large");
    expect(() => validateQuickAnswer({ findings: [{ ...finding, text: "x".repeat(501) }], limitations: [] }, [passage])).toThrow("quick_answer_too_large");
    expect(() => validateQuickAnswer({ findings: [{ ...finding, verified: true }], limitations: [] }, [passage])).toThrow();
  });
});
