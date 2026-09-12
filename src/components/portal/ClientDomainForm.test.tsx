import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addClientDomainAction } from "@/lib/portal/client-actions";
import type { PursuitOption } from "./ClientDomainList";
import { ClientDomainForm } from "./ClientDomainForm";

vi.mock("@/lib/portal/client-actions", () => ({
  addClientDomainAction: vi.fn(),
}));

const pursuits: PursuitOption[] = [
  { id: "p1", firm: "Example Firm LLP", stage: "enquiry" },
  { id: "p2", firm: "Second Firm Ltd", stage: "live" },
];

const mockedAddClientDomainAction = vi.mocked(addClientDomainAction);

describe("ClientDomainForm", () => {
  it("submits the domain, firm and chosen pursuit", async () => {
    mockedAddClientDomainAction.mockResolvedValue({ ok: true, domain: "example-firm.co.uk" });
    render(<ClientDomainForm pursuits={pursuits} />);

    await userEvent.type(screen.getByLabelText(/company email domain/i), "example-firm.co.uk");
    await userEvent.type(screen.getByLabelText(/^firm/i), "Example Firm LLP");
    await userEvent.selectOptions(screen.getByLabelText(/pursuit/i), "p1");
    await userEvent.click(screen.getByRole("button", { name: /add domain/i }));

    expect(await screen.findByText(/example-firm\.co\.uk can now request links/i)).toBeInTheDocument();
    expect(mockedAddClientDomainAction).toHaveBeenCalledTimes(1);
    const formData = mockedAddClientDomainAction.mock.calls[0][1];
    expect(formData.get("domain")).toBe("example-firm.co.uk");
    expect(formData.get("firm")).toBe("Example Firm LLP");
    expect(formData.get("pursuitId")).toBe("p1");
  });

  it("shows the error copy when the action refuses the domain", async () => {
    mockedAddClientDomainAction.mockResolvedValue({ ok: false, error: "That domain is already listed" });
    render(<ClientDomainForm pursuits={pursuits} />);

    await userEvent.type(screen.getByLabelText(/company email domain/i), "example-firm.co.uk");
    await userEvent.type(screen.getByLabelText(/^firm/i), "Example Firm LLP");
    await userEvent.click(screen.getByRole("button", { name: /add domain/i }));

    expect(await screen.findByText("That domain is already listed")).toBeInTheDocument();
  });
});
