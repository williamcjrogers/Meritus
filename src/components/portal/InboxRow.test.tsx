import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pursuit } from "@/lib/db/schema";
import { InboxRow } from "./InboxRow";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const now = new Date("2026-09-09T10:00:00Z");

function makePursuit(overrides: Partial<Pursuit> = {}): Pursuit {
  return {
    id: "p1",
    firm: "Brewster Bye Architects",
    contactName: "Jane Partner",
    contactEmail: "jane@bba.co.uk",
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: "Technical / defects dispute",
    approximateValue: "£1m – £5m",
    forum: "Litigation",
    summary: null,
    source: "site_form",
    sourceDetail: null,
    ownerId: null,
    stage: "enquiry",
    stageChangedAt: new Date("2026-09-09T08:00:00Z"),
    nextAction: null,
    nextActionDue: null,
    createdBy: "site",
    createdAt: new Date("2026-09-09T08:00:00Z"),
    updatedAt: new Date("2026-09-09T08:00:00Z"),
    ...overrides,
  };
}

describe("InboxRow", () => {
  it("renders the enquiry facts and links the firm to the pursuit", () => {
    render(<InboxRow pursuit={makePursuit()} directors={[]} now={now} onTake={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Brewster Bye Architects" })).toHaveAttribute("href", "/portal/pursuits/p1");
    expect(screen.getByText(/Technical \/ defects dispute · £1m – £5m · Litigation/)).toBeInTheDocument();
    expect(screen.getByText(/2 hours ago/)).toBeInTheDocument();
  });

  it("calls onTake with the id", async () => {
    const onTake = vi.fn().mockResolvedValue({ ok: true });
    render(<InboxRow pursuit={makePursuit()} directors={[]} now={now} onTake={onTake} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Take" }));
    expect(onTake).toHaveBeenCalledWith("p1");
  });

  it("reveals a reason field and calls onDecline with it", async () => {
    const onDecline = vi.fn().mockResolvedValue({ ok: true });
    render(<InboxRow pursuit={makePursuit()} directors={[]} now={now} onTake={vi.fn()} onDecline={onDecline} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    const confirm = screen.getByRole("button", { name: "Decline" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason for declining"), "Outside our sectors");
    await userEvent.click(confirm);
    expect(onDecline).toHaveBeenCalledWith("p1", "Outside our sectors");
  });

  it("shows the taken-by state when Take is refused", async () => {
    const onTake = vi.fn().mockResolvedValue({ ok: false, error: "Taken by MD a moment ago" });
    render(<InboxRow pursuit={makePursuit()} directors={[]} now={now} onTake={onTake} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Take" }));
    expect(await screen.findByText("Taken by MD a moment ago")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take" })).not.toBeInTheDocument();
  });

  it("shows related pursuits and a failed alert", () => {
    render(
      <InboxRow
        pursuit={makePursuit()}
        related={[{ id: "p0", firm: "Brewster Bye", stage: "declined", date: "14 Aug 2026" }]}
        alert={{ error: "Resend 403" }}
        directors={[]}
        now={now}
        onTake={vi.fn()}
        onDecline={vi.fn()}
      />
    );
    expect(screen.getByText(/Previously:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brewster Bye" })).toHaveAttribute("href", "/portal/pursuits/p0");
    expect(screen.getByText(/declined, 14 Aug 2026/)).toBeInTheDocument();
    expect(screen.getByText("Alert not sent")).toBeInTheDocument();
  });
});
