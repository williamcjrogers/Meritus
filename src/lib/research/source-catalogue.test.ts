// @vitest-environment node
import { expect, it } from "vitest";
import { QCS_CASE_LAW_AGREEMENT, QCS_CASE_LAW_RIGHTS_ID, RESEARCH_SOURCE_TEMPLATES } from "./source-catalogue";
import { validateSourceSelection } from "./sources/selection";
it("records the supplied signed QCS authority without granting rights to unrelated providers", () => {
  expect(QCS_CASE_LAW_AGREEMENT.holder).toBe("Quantum Commercial Solutions Limited");
  expect(QCS_CASE_LAW_AGREEMENT.agreementHash).toBe("b05f5c2943043d07a2952f7722a94b3188367f16efd6581afd0e3016bf5daf6f");
  expect(RESEARCH_SOURCE_TEMPLATES.filter(s => s.rightsId === QCS_CASE_LAW_RIGHTS_ID).map(s => s.provider)).toEqual(["find-case-law"]);
});
it("every ready built-in source has a valid connector selection", () => {
  for (const source of RESEARCH_SOURCE_TEMPLATES.filter(s => s.status === "ready")) {
    expect(validateSourceSelection(source.provider, source.selection).valid, source.label).toBe(true);
  }
});
