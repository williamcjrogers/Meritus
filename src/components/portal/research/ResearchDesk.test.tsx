import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResearchWorkspace } from "./ResearchWorkspace";
import { ResearchDesk } from "./ResearchDesk";
import type { ResearchDeskData } from "@/lib/research/quick-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const documentId = "00000000-0000-4000-8000-000000000001";
const questionId = "00000000-0000-4000-8000-000000000002";
const sample = (): ResearchDeskData => ({ questions: [], opportunities: [{ documentId, versionId: "v1", passageId: "p1", title: "Example construction award", source: "Example source", provider: "find-tender", excerpt: "A construction project award was published.", url: "https://example.com", publishedAt: "2026-09-12", retrievedAt: "2026-09-12", reason: "Construction and procurement context", saved: false }], collection: { enabledSources: 2, lastCollectedAt: "2026-09-12", needsAttention: 0 } });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("opens the everyday desk by default without loading technical setup lists", async () => {
  const fetcher = vi.fn(async () => Response.json(sample())); vi.stubGlobal("fetch", fetcher);
  render(<ResearchWorkspace mode="investigations" />);
  expect(await screen.findByRole("heading", { name: "Example construction award" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Your research question" })).toBeVisible();
  expect(screen.queryByLabelText("Scope")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Supporting passages")).not.toBeInTheDocument();
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledWith("/api/portal/research/quick?view=new", { cache: "no-store" });
  fireEvent.click(screen.getByRole("button", { name: "New to review" }));
  expect(screen.getByRole("heading", { name: "Example construction award" })).toBeVisible();
});

it("retries a failed start with the same request ID and retained question", async () => {
  const posted: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
    if (init.method === "POST") { posted.push(JSON.parse(String(init.body))); if (posted.length === 1) throw new Error("Connection interrupted"); return Response.json({ id: questionId, status: "queued" }); }
    return Response.json(sample());
  }));
  render(<ResearchDesk />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "What construction payment issues need review?" } });
  fireEvent.click(screen.getByRole("button", { name: "Research this →" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
  expect(screen.getByRole("textbox")).toHaveValue("What construction payment issues need review?");
  fireEvent.click(screen.getByRole("button", { name: "Research this →" }));
  await screen.findByText(/Research started. Your answer will appear below/);
  expect(posted).toHaveLength(2); expect(posted[0]).toEqual(posted[1]);
  expect(posted[0]).toEqual({ requestId: expect.any(String), question: "What construction payment issues need review?", monitoring: false });
  expect(screen.getByRole("textbox")).toHaveValue("");
});

it("does not offer to repeat a successful paid request after its refresh fails", async () => {
  let submitted = false;
  const fetcher = vi.fn(async (_url, init: RequestInit) => {
    if (init.method === "POST") { submitted = true; return Response.json({ id: questionId, status: "queued" }); }
    if (submitted) throw new Error("refresh failed");
    return Response.json(sample());
  }); vi.stubGlobal("fetch", fetcher);
  render(<ResearchDesk />); await screen.findByText("Example construction award");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "What changed in construction payment?" } });
  fireEvent.click(screen.getByRole("button", { name: "Research this →" }));
  await screen.findByText(/Research started. Your answer will appear below/);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be refreshed");
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1));
});

it("polls for progress without starting any paid work", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => Response.json(sample())); vi.stubGlobal("fetch", fetcher);
  await act(async () => { render(<ResearchDesk />); });
  await act(async () => { vi.advanceTimersByTime(120000); });
  expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  for (const call of fetcher.mock.calls as unknown as [string, RequestInit][]) expect(call[1].method ?? "GET").toBe("GET");
});

it("saves and dismisses records and loads the saved view", async () => {
  const state = sample(); const actions: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === "PATCH") { const body = JSON.parse(String(init.body)); actions.push([url, body]); if (body.action === "save") state.opportunities[0].saved = true; else state.opportunities = []; return Response.json({ saved: true }); }
    return Response.json({ ...state, opportunities: state.opportunities.filter(item => item.saved === url.endsWith("saved")) });
  }));
  render(<ResearchDesk />); await screen.findByText("Example construction award");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("No matching records to show yet.");
  fireEvent.click(screen.getByRole("button", { name: "Saved" }));
  await screen.findByText("Example construction award");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  await screen.findByText("Nothing saved yet.");
  expect(actions).toEqual([[`/api/portal/research/opportunities/${documentId}`, { action: "save" }], [`/api/portal/research/opportunities/${documentId}`, { action: "dismiss" }]]);
});

it("shows a cited draft and pauses daily checks without starting another answer", async () => {
  const state = sample();
  state.questions.push({ id: questionId, question: "What construction awards changed?", status: "complete", monitoring: true, createdAt: "2026-09-12", lastCheckedAt: "2026-09-12", nextCheckAt: "2026-09-13", error: null, answer: { findings: [{ text: "An award may be worth reviewing.", kind: "inference", quotation: "A construction project award was published.", evidence: [{ documentId, versionId: "v1", passageId: "p1" }] }], limitations: ["This is a draft from collected records."] }, evidence: [{ documentId, versionId: "v1", passageId: "p1", sourceId: "s1", title: "Example construction award", text: "A construction project award was published.", url: "https://example.com", locator: {}, retrievedAt: "2026-09-12", publishedAt: null, eventAt: null, attribution: "Example" }] });
  const fetcher = vi.fn(async (_url, init: RequestInit) => { if (init.method === "PATCH") { state.questions[0].monitoring = false; return Response.json({ saved: true }); } return Response.json(state); }); vi.stubGlobal("fetch", fetcher);
  render(<ResearchDesk />); await screen.findByText("Draft answer · for review");
  const answer = screen.getByRole("heading", { name: "What construction awards changed?" }).closest("article")!;
  expect(within(answer).getByText("Interpretation of the evidence")).toBeVisible();
  fireEvent.click(within(answer).getByText("View supporting evidence"));
  expect(within(answer).getByRole("link", { name: "Example construction award" })).toHaveAttribute("href", "/portal/research/evidence/p1");
  fireEvent.click(screen.getByRole("button", { name: "Pause daily updates" }));
  await screen.findByRole("button", { name: "Keep updated daily" });
  expect(fetcher).toHaveBeenCalledWith(`/api/portal/research/quick/${questionId}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ monitoring: false }) }));
  expect(fetcher.mock.calls.some(([, init]) => init.method === "POST")).toBe(false);
});

it("pauses a failed question's existing monitor before offering its replacement", async () => {
  const state = sample();
  state.questions.push({ id: questionId, question: "What has changed in payment records?", status: "failed", monitoring: true, createdAt: "2026-09-12", lastCheckedAt: "2026-09-12", nextCheckAt: "2026-09-13", error: "The answer could not be completed.", answer: null, evidence: [] });
  const mutations: [string, unknown][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === "PATCH") { mutations.push([url, JSON.parse(String(init.body))]); state.questions[0].monitoring = false; return Response.json({ saved: true }); }
    if (init.method === "POST") { mutations.push([url, JSON.parse(String(init.body))]); return Response.json({ id: "replacement", status: "queued" }); }
    return Response.json(state);
  }));
  render(<ResearchDesk />); await screen.findByText("Needs attention");
  fireEvent.click(screen.getByRole("button", { name: "Try this question again" }));
  await screen.findByText(/The previous daily updates are paused/);
  expect(mutations).toEqual([[`/api/portal/research/quick/${questionId}`, { monitoring: false }]]);
  expect(screen.getByRole("textbox")).toHaveValue("What has changed in payment records?");
  expect(screen.getByRole("checkbox", { name: "Keep this question updated daily" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Research this →" }));
  await screen.findByText(/Research started. This question will also be checked daily/);
  expect(mutations[1]).toEqual(["/api/portal/research/quick", { requestId: expect.any(String), question: "What has changed in payment records?", monitoring: true }]);
});

it("offers an updated answer when withdrawn evidence makes a completed answer unavailable", async () => {
  const state = sample();
  state.questions.push({ id: questionId, question: "What changed in construction?", status: "complete", monitoring: false, createdAt: "2026-09-12", lastCheckedAt: "2026-09-12", nextCheckAt: null, error: "Source evidence changed or is unavailable.", answer: null, evidence: [] });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(state)));
  render(<ResearchDesk />); await screen.findByText("Needs attention");
  expect(screen.queryByText("Answer ready")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try this question again" }));
  expect(screen.getByRole("textbox")).toHaveValue("What changed in construction?");
});

it("explains the daily question limit and keeps the question for retry", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => init.method === "POST" ? Response.json({ error: "research_monitor_limit" }, { status: 409 }) : Response.json(sample())));
  render(<ResearchDesk />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Which payment changes should we review?" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Keep this question updated daily" }));
  fireEvent.click(screen.getByRole("button", { name: "Research this →" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Pause an existing daily update");
  expect(screen.getByRole("textbox")).toHaveValue("Which payment changes should we review?");
});

it("links every displayed payment field to its exact source passage", async () => {
  const state = sample();
  state.opportunities[0].excerpt = "Company: Example Construction Ltd\nAverage time to pay: 45\nPercentage of invoices paid late: 70";
  state.opportunities[0].evidence = [{ passageId: "name", label: "Company" }, { passageId: "days", label: "Average time to pay" }, { passageId: "late", label: "Percentage of invoices paid late" }];
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(state)));
  render(<ResearchDesk />); await screen.findByText("Read the evidence");
  fireEvent.click(screen.getByText("Read the evidence", { exact: true }));
  expect(screen.getByRole("link", { name: "Average time to pay" })).toHaveAttribute("href", "/portal/research/evidence/days");
  expect(screen.getByRole("link", { name: "Percentage of invoices paid late" })).toHaveAttribute("href", "/portal/research/evidence/late");
});
