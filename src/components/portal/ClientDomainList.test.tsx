import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClientDomain } from "@/lib/db/schema";
import { linkClientDomainAction, removeClientDomainAction } from "@/lib/portal/client-actions";
import { ClientDomainList, type ClientFileSummary, type PursuitOption } from "./ClientDomainList";

vi.mock("@/lib/portal/client-actions", () => ({
  linkClientDomainAction: vi.fn(),
  removeClientDomainAction: vi.fn(),
}));

const mockedLinkClientDomainAction = vi.mocked(linkClientDomainAction);
const mockedRemoveClientDomainAction = vi.mocked(removeClientDomainAction);

function makeDomain(overrides: Partial<ClientDomain> = {}): ClientDomain {
  return {
    id: "d1",
    domain: "example-firm.co.uk",
    firm: "Example Firm LLP",
    pursuitId: "p1",
    createdBy: "user_1",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    removedAt: null,
    ...overrides,
  };
}

const pursuits: PursuitOption[] = [
  { id: "p1", firm: "Example Firm LLP", stage: "enquiry" },
  { id: "p2", firm: "Third Firm plc", stage: "live" },
];

const domains: ClientDomain[] = [
  makeDomain({ id: "d1", domain: "example-firm.co.uk", firm: "Example Firm LLP", pursuitId: "p1" }),
  makeDomain({ id: "d2", domain: "second-firm.co.uk", firm: "Second Firm Ltd", pursuitId: null }),
];

const files: Record<string, ClientFileSummary[]> = {
  d1: [
    {
      id: "f1",
      title: "Bundle.pdf",
      size: 2048,
      createdAt: new Date("2026-09-05T10:00:00Z"),
      uploaderEmail: "jane@example-firm.co.uk",
    },
  ],
};

beforeEach(() => {
  mockedLinkClientDomainAction.mockReset().mockResolvedValue({ ok: true });
  mockedRemoveClientDomainAction.mockReset().mockResolvedValue({ ok: true });
});

describe("ClientDomainList", () => {
  it("shows the empty state when there are no domains", () => {
    render(<ClientDomainList domains={[]} pursuits={pursuits} files={{}} />);
    expect(screen.getByText(/no client domains yet/i)).toBeInTheDocument();
  });

  it("links a domain to a pursuit when the select changes", async () => {
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const selects = screen.getAllByLabelText(/pursuit/i);
    // d2 is not linked, so this select starts at "Not linked".
    await userEvent.selectOptions(selects[1], "p1");
    expect(mockedLinkClientDomainAction).toHaveBeenCalledWith("d2", "p1");
  });

  it("unlinks a domain when 'Not linked' is chosen", async () => {
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const selects = screen.getAllByLabelText(/pursuit/i);
    // d1 starts linked to p1, so choosing "Not linked" is a real change.
    await userEvent.selectOptions(selects[0], "");
    expect(mockedLinkClientDomainAction).toHaveBeenCalledWith("d1", null);
  });

  it("removes a domain once the confirmation is accepted", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await userEvent.click(removeButtons[0]);
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedRemoveClientDomainAction).toHaveBeenCalledWith("d1");
    confirmSpy.mockRestore();
  });

  it("does not remove a domain when the confirmation is declined", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await userEvent.click(removeButtons[0]);
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedRemoveClientDomainAction).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows the server's error when removal fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedRemoveClientDomainAction.mockResolvedValue({ ok: false, error: "That domain is no longer listed" });
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await userEvent.click(removeButtons[0]);
    expect(await screen.findByText("That domain is no longer listed")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("renders a sent file as a link to its document, with the uploader's email", () => {
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    const link = screen.getByRole("link", { name: "Bundle.pdf" });
    expect(link).toHaveAttribute("href", "/api/portal/documents/f1");
    expect(screen.getByText(/jane@example-firm\.co\.uk/)).toBeInTheDocument();
  });

  it("shows 'nothing sent yet' for a domain with no files", () => {
    render(<ClientDomainList domains={domains} pursuits={pursuits} files={files} />);
    expect(screen.getByText("Nothing sent yet.")).toBeInTheDocument();
  });
});
