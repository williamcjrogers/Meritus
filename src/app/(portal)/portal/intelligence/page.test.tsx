import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { requireWorkspacePage } from "@/lib/portal/auth";
import { intelligenceServiceConfig } from "@/lib/intelligence/config";
import IntelligencePage from "./page";

vi.mock("@/lib/portal/auth", () => ({ requireWorkspacePage: vi.fn() }));
vi.mock("@/lib/intelligence/config", () => ({ intelligenceServiceConfig: vi.fn() }));

beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireWorkspacePage).mockResolvedValue("user_director"); });

it("guards the page before reading runtime configuration", async () => {
  vi.mocked(requireWorkspacePage).mockRejectedValue(new Error("redirect:/sign-in"));
  await expect(IntelligencePage()).rejects.toThrow("redirect:/sign-in");
  expect(requireWorkspacePage).toHaveBeenCalledExactlyOnceWith("/portal/intelligence");
  expect(intelligenceServiceConfig).not.toHaveBeenCalled();
});

it("passes only a configured flag to the client, never the service URL or key", async () => {
  vi.mocked(intelligenceServiceConfig).mockReturnValue({ origin: "https://private.example", secret: "private secret" });
  const page = await IntelligencePage();
  expect(page.props).toEqual({ configured: true });
  render(page);
  expect(screen.getByTitle("Meritus Intelligence analyst desk")).toBeInTheDocument();
});

it("shows unavailable configuration honestly", async () => {
  vi.mocked(intelligenceServiceConfig).mockReturnValue(null);
  render(await IntelligencePage());
  expect(screen.getByRole("status")).toHaveTextContent("The analyst desk is not connected yet");
});
