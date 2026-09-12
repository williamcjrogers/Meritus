import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/db/research-workflow", async (original) => ({
  ...(await original<typeof import("@/lib/db/research-workflow")>()),
  researchEvidence: vi.fn(),
  readResearchPassage: vi.fn(),
}));
vi.mock("./case-law/service", () => ({
  searchCaseLaw: vi.fn(),
  readCaseLaw: vi.fn(),
}));
import { researchAssistantTools } from "./assistant";
import {
  researchEvidence,
  readResearchPassage,
} from "@/lib/db/research-workflow";
import { searchCaseLaw } from "./case-law/service";
import type { EvidencePassage } from "./workflow-types";
const id = "00000000-0000-4000-8000-000000000001";
const passage: EvidencePassage = {
  documentId: id,
  versionId: id,
  passageId: id,
  sourceId: id,
  title: "Judgment",
  text: "The appeal was allowed.",
  locator: { kind: "paragraph", value: "12" },
  url: "https://example.test",
  retrievedAt: "2026-09-12T00:00:00Z",
  publishedAt: null,
  eventAt: null,
  attribution: "QCS",
};
beforeEach(() => {
  vi.mocked(researchEvidence).mockResolvedValue([passage]);
  vi.mocked(readResearchPassage).mockResolvedValue(passage);
  vi.mocked(searchCaseLaw).mockResolvedValue([
    {
      documentId: id,
      versionId: id,
      title: "Judgment",
      identifiers: [],
      passageIds: [id],
      coverage: [],
    },
  ]);
});
it("refuses reads for IDs the assistant has not retrieved", async () => {
  const tools = researchAssistantTools(id, new Map());
  const read = tools.read_passage.execute as (v: {
    passageId: string;
  }) => Promise<unknown>;
  expect(await read({ passageId: id })).toEqual({
    error: "Passage was not returned by this investigation",
  });
  expect(readResearchPassage).not.toHaveBeenCalled();
});
it("exposes typed case lookup and validates final draft quotations without granting review", async () => {
  const seen = new Map<string, EvidencePassage>(),
    tools = researchAssistantTools(id, seen);
  const lookup = tools.search_case_law.execute as (v: {
    query: string;
  }) => Promise<unknown>;
  await lookup({ query: "appeal" });
  expect(seen.get(id)).toEqual(passage);
  const draft = tools.draft_finding.execute as unknown as (
    v: unknown,
  ) => Promise<{ valid: boolean; reviewed: boolean }>;
  expect(
    await draft({
      findings: [
        {
          kind: "observation",
          text: "Dismissed",
          quotation: "appeal was dismissed",
          evidence: [{ documentId: id, versionId: id, passageId: id }],
        },
      ],
      limitations: [],
    }),
  ).toMatchObject({ valid: false, reviewed: false });
});
it("limits tool reads across concurrent or repeated calls", async () => {
  const tools = researchAssistantTools(id, new Map());
  const search = tools.search_investigation.execute as (v: {
    query: string;
  }) => Promise<unknown>;
  for (let i = 0; i < 4; i++) await search({ query: "test" });
  await expect(search({ query: "test" })).rejects.toMatchObject({
    code: "assistant_tool_limit",
  });
});
