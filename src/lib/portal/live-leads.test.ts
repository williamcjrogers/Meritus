import { describe, expect, it, vi } from "vitest";
import { readPursuitActions } from "@/lib/db/desk-actions";
import { viewFixture } from "@/lib/actions/view-fixture.test-support";
import { pursuitFixture } from "./live-lead-fixtures.test-support";
import { readLiveLeads } from "./live-leads";
vi.mock("@/lib/db/desk-actions", () => ({ readPursuitActions: vi.fn() }));
describe("live lead projection", () => {
  it("batches lead IDs and ignores a closed nomination without conflating review and action dates", async () => {
    const lead = pursuitFixture({ id: "p1", stage: "dormant", ownerId: "lead-owner", reviewDue: "2026-09-20", nextAction: "Obsolete", nextActionDue: "2025-01-01" });
    const action = viewFixture({ id: "open", ownerId: "action-owner", dueDate: "2026-09-14", link: { kind: "pursuit", id: "p1" } });
    vi.mocked(readPursuitActions).mockResolvedValue([viewFixture({ id: "closed", isPrimary: true, state: "completed", link: action.link }), action]);
    const result = await readLiveLeads([lead, pursuitFixture({ id: "p2" })]);
    expect(readPursuitActions).toHaveBeenCalledExactlyOnceWith(["p1", "p2"]);
    expect(result[0]).toEqual({ pursuit: lead, nextAction: action, reviewDue: "2026-09-20" });
    expect(result[1].nextAction).toBeNull();
  });
});
