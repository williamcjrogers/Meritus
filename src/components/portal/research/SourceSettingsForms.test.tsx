import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { SourceSettingsForms } from "./SourceSettingsForms";
import { ResearchWorkspace } from "./ResearchWorkspace";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
const source = (overrides: Partial<SourceSettings>): SourceSettings => ({
  id: "source-one", label: "Find Case Law", provider: "find-case-law", status: "ready", selection: {},
  lastSuccessAt: null, nextDueAt: "2026-09-12T12:00:00Z", configurationError: null, attribution: "Publisher credit",
  termsUrl: "https://example.com/terms", termsVersion: "1", rightsId: "right-one", dailyRequests: 100,
  dailyTokens: 100000, dailyPence: 1000, credentialConfigured: false, ...overrides,
});
const sources = [source({}), source({ id: "source-two", label: "Companies House", provider: "companies-house", status: "paused" })];

it("starts with useful source information and keeps administration forms and requests out of the overview", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Your research sources" })).toBeInTheDocument();
  expect(screen.getByText("Ready to collect")).toBeInTheDocument();
  expect(screen.getAllByText("No collection recorded")).toHaveLength(2);
  expect(screen.getByText(/Choose the company to collect/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Licence holder")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("What are you adding?")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Daily model tokens")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("filters sources by purpose and by attention status", () => {
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  fireEvent.click(screen.getByText("Find or filter sources"));
  fireEvent.change(screen.getByLabelText("Find a source"), { target: { value: "filings" } });
  expect(screen.getByRole("heading", { name: "Companies House" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Find Case Law" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Find a source"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Show"), { target: { value: "ready" } });
  expect(screen.queryByRole("heading", { name: "Companies House" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Find Case Law" })).toBeInTheDocument();
});

it("shows only one chosen task and loads licences when adding a source", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal("fetch", fetch);
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Import a file" }));
  expect(screen.getByRole("heading", { name: "Import a file" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Your research sources" })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Add a source" })[0]);
  expect(await screen.findByLabelText("What are you adding?")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/portal/research/rights", { cache: "no-store" });
  expect(screen.queryByRole("heading", { name: "Import a file" })).not.toBeInTheDocument();
});

it("shows unavailable document records only on request and preserves the collection limit", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json([
    { id: "ok", source: "Find Case Law", canonical_url: "https://example.com/available", status: "available" },
    { id: "withdrawn", source: "Find Case Law", canonical_url: "https://example.com/withdrawn", status: "withdrawn" },
  ])); vi.stubGlobal("fetch", fetch);
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  fireEvent.click(screen.getByText("Administration"));
  fireEvent.click(screen.getByRole("button", { name: "Document checks" }));
  expect(await screen.findByText("https://example.com/withdrawn")).toBeInTheDocument();
  expect(screen.queryByText("https://example.com/available")).not.toBeInTheDocument();
  expect(screen.getByText(/up to 200 recently updated/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Include available documents" }));
  expect(screen.getByText("https://example.com/available")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledOnce();
});

it("loads the sources page without duplicate source requests or unrelated directory calls", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json(sources)); vi.stubGlobal("fetch", fetch);
  render(<ResearchWorkspace mode="sources" />);
  await screen.findByRole("heading", { name: "Your research sources" });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledWith("/api/portal/research/sources", { cache: "no-store" });
  expect(screen.getByRole("link", { name: "Sources" })).toHaveAttribute("aria-current", "page");
});

it("preserves a source draft while the user visits the licence form", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json([{ id: "right-one", holder: "QCS", material: "Example permission" }])));
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  fireEvent.change(await screen.findByLabelText("What are you adding?"), { target: { value: "publications" } });
  fireEvent.change(screen.getByLabelText("Source name"), { target: { value: "My annual report" } });
  fireEvent.click(screen.getByRole("button", { name: "Record another licence or permission" }));
  await screen.findByRole("heading", { name: "Licences and permissions" });
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  expect(await screen.findByLabelText("Source name")).toHaveValue("My annual report");
  expect(screen.getByLabelText("What are you adding?")).toHaveValue("publications");
});

it("keeps successful registration after a refresh failure and permits another source afterwards", async () => {
  let reads = 0;
  const fetch = vi.fn().mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ id: "new-source" });
    if (++reads === 2) return Response.json({ error: "Refresh temporarily unavailable" }, { status: 503 });
    return Response.json([{ id: "right-one", holder: "QCS", material: "Example permission" }]);
  }); vi.stubGlobal("fetch", fetch);
  render(<SourceSettingsForms sources={sources} reload={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  fireEvent.change(await screen.findByLabelText("What are you adding?"), { target: { value: "research-import" } });
  for (const [label, value] of [
    ["Source name", "Example data"], ["Publisher website domain", "example.com"],
    ["Research purpose", "Review published records"], ["Earliest records to retrieve", "2026-01-01"],
    ["Recorded licence or permission", "right-one"], ["Source terms web address", "https://example.com/terms"],
    ["Required credit to the publisher", "Example publisher"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Add source" }));
  expect(await screen.findByRole("heading", { name: "Source added" })).toBeInTheDocument();
  expect(screen.getByText(/Your change was saved, but/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add source" })).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Source overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  expect(await screen.findByLabelText("What are you adding?")).toHaveValue("");
});
