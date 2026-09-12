import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Brief } from "@/lib/db/schema";
import { BriefPanel, type BriefRunSummary } from "./BriefPanel";

const directors = [{ id: "u1", name: "William Rogers", email: "w@x.com", initials: "WR" }];

const subject = { name: "Kubik Construction Ltd", number: "04812345", target: "party" as const };

function makeBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    id: "b1",
    pursuitId: "p1",
    status: "complete",
    facts: {
      subject: "Kubik Construction Ltd",
      match: "confirmed",
      companyName: "KUBIK CONSTRUCTION LIMITED",
      companyNumber: "04812345",
      status: "active",
      incorporatedOn: "2003-06-12",
      registeredAddress: "1 Saxton Lane, Leeds",
      sicCodes: ["41201"],
      officers: [{ name: "J Bye", role: "director", appointedOn: "2003-06-12" }],
      chargesCount: 2,
      accountsOverdue: false,
      fetchedAt: "2026-09-09T13:00:00Z",
      source: "Companies House",
    },
    analysis: [
      {
        text: "Two charges registered in 2024",
        kind: "fact",
        source: "companies_house",
        url: "https://find-and-update.company-information.service.gov.uk/company/04812345",
      },
      { text: "Likely the architect on Saxton Lane", kind: "inference", source: "web", url: "https://example.com/saxton" },
      { text: "Web research unavailable", kind: "fact", source: "reasoning", url: null },
    ],
    summary: "A Leeds contractor with two recent charges.",
    sources: ["https://example.com/saxton"],
    error: null,
    createdBy: "u1",
    createdAt: new Date("2026-09-09T13:02:00Z"),
    ...overrides,
  };
}

function run(status: BriefRunSummary["status"], error: string | null = null): BriefRunSummary {
  return { id: "r1", status, error, createdAt: "2026-09-09T13:05:00Z" };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function renderPanel(props: Partial<React.ComponentProps<typeof BriefPanel>> = {}) {
  const onAsk = vi.fn();
  const onPick = vi.fn().mockResolvedValue({ ok: true });
  const onComplete = vi.fn();
  render(
    <BriefPanel
      pursuitId="p1"
      subject={subject}
      initial={{ latestRun: null, brief: null }}
      directors={directors}
      onAsk={onAsk}
      onPick={onPick}
      onComplete={onComplete}
      {...props}
    />
  );
  return { onAsk, onPick, onComplete };
}

describe("BriefPanel states", () => {
  it("none: offers to build the brief, with the register search only when the number is unknown", () => {
    const { rerender } = render(
      <BriefPanel pursuitId="p1" subject={subject} initial={{ latestRun: null, brief: null }} directors={directors} onAsk={vi.fn()} onPick={vi.fn()} />
    );
    expect(screen.getByText("No brief yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build the brief" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find on Companies House" })).not.toBeInTheDocument();

    rerender(
      <BriefPanel pursuitId="p1" subject={{ ...subject, number: null }} initial={{ latestRun: null, brief: null }} directors={directors} onAsk={vi.fn()} onPick={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Find on Companies House" })).toBeInTheDocument();
  });

  it("running: shows the progress line and no build button", () => {
    renderPanel({ initial: { latestRun: run("running"), brief: null } });
    expect(screen.getByText(/Building the brief/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Build the brief" })).not.toBeInTheDocument();
  });

  it("complete: renders the facts, the analysis, the summary, the attribution and the actions", () => {
    const { onAsk } = renderPanel({ initial: { latestRun: run("complete"), brief: makeBrief() } });
    expect(screen.getByText("KUBIK CONSTRUCTION LIMITED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Companies House/ })).toHaveAttribute(
      "href",
      "https://find-and-update.company-information.service.gov.uk/company/04812345"
    );
    expect(screen.getByText(/1 Saxton Lane, Leeds/)).toBeInTheDocument();
    expect(screen.getByText(/J Bye/)).toBeInTheDocument();

    const analysis = screen.getByRole("list", { name: "Analysis" });
    expect(within(analysis).getAllByText("Fact")).toHaveLength(1);
    expect(within(analysis).getAllByText("Interpretation")).toHaveLength(1);
    expect(within(analysis).getByText("Two charges registered in 2024")).toBeInTheDocument();
    expect(within(analysis).queryByText("Web research unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("Web research unavailable")).toBeInTheDocument();

    expect(screen.getByText("A Leeds contractor with two recent charges.")).toBeInTheDocument();
    expect(screen.getByText("Generated 09 September 2026 by WR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it("failed with no earlier brief: shows the reason and Retry", () => {
    renderPanel({ initial: { latestRun: run("failed", "Analysis model timed out"), brief: null } });
    expect(screen.getByText("Analysis model timed out")).toHaveClass("text-danger");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Build the brief" })).not.toBeInTheDocument();
  });

  it("complete with a regenerate running: keeps the brief and shows a notice", () => {
    renderPanel({ initial: { latestRun: run("running"), brief: makeBrief() } });
    expect(screen.getByText("A Leeds contractor with two recent charges.")).toBeInTheDocument();
    expect(screen.getByText(/Rebuilding the brief/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
  });

  it("complete with a failed regenerate: keeps the brief and shows the reason with Retry", () => {
    renderPanel({ initial: { latestRun: run("failed", "Timed out, try again"), brief: makeBrief() } });
    expect(screen.getByText("A Leeds contractor with two recent charges.")).toBeInTheDocument();
    expect(screen.getByText("Timed out, try again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("unconfirmed facts: lists the candidates with a Pick button each", async () => {
    const { onPick } = renderPanel({
      subject: { ...subject, number: null },
      initial: {
        latestRun: run("complete"),
        brief: makeBrief({
          facts: {
            subject: "Kubik Construction",
            match: "unconfirmed",
            candidates: [
              { number: "04812345", title: "KUBIK CONSTRUCTION LIMITED", status: "active", address: "Leeds" },
              { number: "09999999", title: "KUBIK CONSTRUCTION (NORTH) LIMITED", status: "dissolved", address: "Bradford" },
            ],
            sicCodes: [],
            officers: [],
            fetchedAt: "2026-09-09T13:00:00Z",
            source: "Companies House",
          },
        }),
      },
    });
    const picks = screen.getAllByRole("button", { name: /^Pick/ });
    expect(picks).toHaveLength(2);
    await userEvent.click(picks[0]);
    expect(onPick).toHaveBeenCalledWith("04812345");
  });
});

describe("BriefPanel start errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the route's error when the build cannot start", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Vercel AI Gateway is not configured", code: "SETUP" }, 503))
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Build the brief" }));
    expect(await screen.findByText("Vercel AI Gateway is not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build the brief" })).toBeInTheDocument();
  });
});

describe("BriefPanel polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls every three seconds while running and gives up after two minutes", async () => {
    const fetchMock = vi.fn(async (url: string) => (url ? jsonResponse({ latestRun: run("running"), brief: null }) : jsonResponse({}, 404)));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel({ initial: { latestRun: run("running"), brief: null } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/portal/pursuits/p1/brief");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(screen.getByText("Timed out, try again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(41);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("builds on request, then shows the brief when the poll reports it complete", async () => {
    const brief = makeBrief();
    const wire = { ...brief, createdAt: brief.createdAt.toISOString() };
    let polls = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ id: "r2" }, 202);
      polls += 1;
      return polls < 2
        ? jsonResponse({ latestRun: { ...run("running"), id: "r2" }, brief: null })
        : jsonResponse({ latestRun: { ...run("complete"), id: "r2" }, brief: wire });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Build the brief" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText(/Building the brief/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_500);
    });
    expect(screen.getByText("A Leeds contractor with two recent charges.")).toBeInTheDocument();
    expect(screen.getByText("Generated 09 September 2026 by WR")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
