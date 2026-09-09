import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Pursuit } from "@/lib/db/schema";
import { Board } from "./Board";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const now = new Date("2026-09-09T10:00:00Z");

function makePursuit(overrides: Partial<Pursuit>): Pursuit {
  return {
    id: "p",
    firm: "Firm",
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: "Quantum / final account dispute",
    approximateValue: "Under £1m",
    forum: null,
    summary: null,
    source: "referral",
    sourceDetail: null,
    ownerId: "u1",
    stage: "enquiry",
    stageChangedAt: new Date("2026-09-06T10:00:00Z"),
    nextAction: null,
    nextActionDue: null,
    createdBy: "u1",
    createdAt: new Date("2026-09-06T10:00:00Z"),
    updatedAt: new Date("2026-09-06T10:00:00Z"),
    ...overrides,
  };
}

const directors = [{ id: "u1", name: "William Rogers", email: "w@x.com", initials: "WR" }];

describe("Board", () => {
  it("renders three columns with counts, overdue marking and the empty next action", () => {
    const columns = {
      enquiry: [makePursuit({ id: "a", firm: "Newton Wood", nextAction: "Call Matt Bruce", nextActionDue: "2026-09-12" })],
      scoping: [makePursuit({ id: "b", firm: "Acme Scaffolding", stage: "scoping", nextAction: "Chase reply", nextActionDue: "2026-09-01" })],
      proposal: [],
    };
    render(<Board columns={columns} counts={{ enquiry: 1, scoping: 1, proposal: 0 }} directors={directors} now={now} onMove={vi.fn()} />);

    const enquiry = screen.getByRole("region", { name: "Enquiry column" });
    expect(within(enquiry).getByText("(1)")).toBeInTheDocument();
    expect(within(enquiry).getByRole("link", { name: "Newton Wood" })).toHaveAttribute("href", "/portal/pursuits/a");
    expect(within(enquiry).getByText("WR")).toBeInTheDocument();
    expect(within(enquiry).getByText("3 days")).toBeInTheDocument();
    expect(within(enquiry).getByText("Sat 12 Sep")).toBeInTheDocument();

    const scoping = screen.getByRole("region", { name: "Scoping column" });
    expect(within(scoping).getByText("overdue")).toBeInTheDocument();

    const proposal = screen.getByRole("region", { name: "Proposal column" });
    expect(within(proposal).getByText("(0)")).toBeInTheDocument();
    expect(within(proposal).getByText("Nothing at proposal")).toBeInTheDocument();
  });

  it("shows 'No next action' when a card has none", () => {
    render(
      <Board columns={{ enquiry: [makePursuit({ id: "c" })], scoping: [], proposal: [] }} counts={{ enquiry: 1, scoping: 0, proposal: 0 }} directors={directors} now={now} onMove={vi.fn()} />
    );
    expect(screen.getByText("No next action")).toBeInTheDocument();
  });
});
