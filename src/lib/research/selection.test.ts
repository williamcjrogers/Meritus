import { it, expect } from "vitest";
import { investigationPayload,semanticImportSelection } from "./selection";
import { RESEARCH_SOURCE_TEMPLATES } from "./source-catalogue";
const scope = {
  kind: "organisation" as const,
  subject: "Synthetic Construction",
  entityId: null,
  jurisdiction: "England and Wales",
  from: "2026-01-01",
  to: "2026-09-12",
  sources: [],
};
it("builds valid provider-specific selections for every ready catalogue source", () => {
  for (const s of RESEARCH_SOURCE_TEMPLATES.filter((s) => s.status === "ready"))
    expect(() =>
      investigationPayload(s.provider, s.selection, scope, null),
    ).not.toThrow();
});
it("does not leak unsupported query keys into population feeds or Companies House", () => {
  expect(
    investigationPayload("find-a-tender", {}, scope, null).selection,
  ).toEqual({});
  expect(
    investigationPayload("companies-house", {}, scope, "00000001").selection,
  ).toEqual({ companyNumber: "00000001" });
});
it("requires a verified or explicitly configured company number and notice population", () => {
  expect(() =>
    investigationPayload("companies-house", {}, scope, null),
  ).toThrow();
  expect(() => investigationPayload("gazette", {}, scope, null)).toThrow();
  expect(
    investigationPayload("gazette", { noticeTypes: ["2443"] }, scope, null)
      .selection,
  ).toEqual({ noticeTypes: ["2443"] });
});
it("preserves a validated immutable import selection without public-query pollution", () => {
  const selection = {
    objectKey: "private/research/import/file",
    format: "csv",
    mapping: { text: "Text" },
    snapshotId: "snapshot",
    partIndex: 0,
    partCount: 1,
  };
  expect(
    investigationPayload("research-import", selection, scope, null).selection,
  ).toEqual(selection);
});

it('identifies retried imports by content and mapping rather than temporary storage keys',()=>{const a={objectKey:'first/research/key',snapshotId:'same',format:'csv',mapping:{text:'Text'}};expect(semanticImportSelection(a)).toEqual(semanticImportSelection({...a,objectKey:'second/research/key'}));expect(semanticImportSelection(a)).not.toEqual(semanticImportSelection({...a,mapping:{text:'Other'}}));});
