import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelatedActionPanel } from "./RelatedActionPanel";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn(), directory: vi.fn() }));
vi.mock("@/lib/research/roles", () => ({ requireResearchDirector: mocks.guard }));
vi.mock("@/lib/db/desk-actions", () => ({ readRelatedActions: mocks.read }));
vi.mock("@/lib/portal/directors", () => ({ readDirectorDirectory: mocks.directory }));
vi.mock("./RelatedActions", () => ({ RelatedActions: ({ link }: { link: { id: string; kind: string } }) => <div>Actions for {link.kind}: {link.id}</div> }));

describe("related record action boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockResolvedValue("director"); mocks.read.mockResolvedValue([]); mocks.directory.mockResolvedValue({ available: true, directors: [] }); });
  it.each(["programme", "prospect", "investigation"] as const)("preserves the exact %s parent identity", async kind => {
    render(await RelatedActionPanel({ link: { kind, id: "stable-parent-id" } }));
    expect(mocks.read).toHaveBeenCalledWith({ kind, id: "stable-parent-id" });
    expect(screen.getByText(`Actions for ${kind}: stable-parent-id`)).toBeVisible();
  });
  it("rejects clients before reading any action or director names", async () => {
    mocks.guard.mockRejectedValue(new Error("Director access required"));
    await expect(RelatedActionPanel({ link: { kind: "general" } })).rejects.toThrow("Director access required");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.directory).not.toHaveBeenCalled();
  });
  it("keeps the work page usable when its actions cannot be read", async () => {
    mocks.read.mockRejectedValue(new Error("Database unavailable"));
    render(await RelatedActionPanel({ link: { kind: "programme", id: "stable-programme" } }));
    expect(screen.getByRole("status")).toHaveTextContent("Could not load actions");
    expect(screen.getByRole("link", { name: "Open related actions" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=all&link=programme&linkId=stable-programme");
  });
});
