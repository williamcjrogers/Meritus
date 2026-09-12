import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sourceRegistration } from "@/lib/research/source-registration";
import { SourceRegistrationForm } from "./SourceRegistrationForm";

const rights = [{ id: "00000000-0000-4000-8000-000000000001", holder: "QCS", material: "Publisher research material" }];

function chooseType(provider: string) {
  fireEvent.change(screen.getByLabelText("What are you adding?"), { target: { value: provider } });
}

function fillCommon() {
  for (const [label, value] of [
    ["Source name", "Example accounts"],
    ["Publisher website domain", "WWW.EXAMPLE.COM"],
    ["Research purpose", "Review published accounts"],
    ["Earliest records to retrieve", "2026-01-01"],
    ["Recorded licence or permission", rights[0].id],
    ["Source terms web address", "https://www.example.com/terms"],
    ["Required credit to the publisher", "Contains information from Example plc"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("source registration", () => {
  it("shows only the type choice initially and helps users record missing permission", () => {
    const onRecordLicence = vi.fn();
    render(<SourceRegistrationForm rights={[]} save={vi.fn()} onRecordLicence={onRecordLicence} />);
    expect(screen.queryByLabelText("Source name")).not.toBeInTheDocument();
    chooseType("research-import");
    expect(screen.getByText(/No licences or permissions have been recorded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add source" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Record a licence or permission" }));
    expect(onRecordLicence).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Publication web address")).not.toBeInTheDocument();
  });

  it("registers a publication with converted GBP and hours, retaining paused-success feedback", async () => {
    const save = vi.fn().mockResolvedValue({ id: "new-source" });
    const onComplete = vi.fn();
    render(<SourceRegistrationForm rights={rights} save={save} onRecordLicence={vi.fn()} onComplete={onComplete} />);
    chooseType("publications");
    fillCommon();
    fireEvent.change(screen.getByLabelText("Publication web address"), { target: { value: "https://www.example.com/accounts" } });
    fireEvent.change(screen.getByLabelText("Publication category"), { target: { value: "accounts" } });
    fireEvent.change(screen.getByLabelText("Who or what is the publication about?"), { target: { value: "Example plc" } });
    fireEvent.click(screen.getByText("Advanced: refresh frequency and daily limits"));
    fireEvent.change(screen.getByLabelText("Refresh every (hours)"), { target: { value: "12.5" } });
    fireEvent.change(screen.getByLabelText("Maximum AI cost per day (£)"), { target: { value: "7.35" } });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const [path, body] = save.mock.calls[0];
    expect(path).toBe("sources");
    expect(sourceRegistration.parse(body)).toMatchObject({
      provider: "publications", hosts: ["www.example.com"], status: "paused", accessMethod: "public_https",
      selection: { url: "https://www.example.com/accounts", kind: "accounts", subjectId: "Example plc" },
      dailyPence: 735, cadenceSeconds: 45000, freshnessSeconds: 90000,
      dailyRequests: 100, dailyTokens: 100000, requestLimit: 10, windowSeconds: 60,
      backfillStart: "2026-01-01T00:00:00.000Z",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Your source is paused");
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "View source overview" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("only submits the Building Safety Regulator selection after changing source type", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceRegistrationForm rights={rights} save={save} onRecordLicence={vi.fn()} />);
    chooseType("publications");
    fireEvent.change(screen.getByLabelText("Publication category"), { target: { value: "news" } });
    fireEvent.change(screen.getByLabelText("Who or what is the publication about?"), { target: { value: "Old subject" } });
    chooseType("building-safety");
    expect(screen.queryByLabelText("Publication category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Who or what is the publication about?")).not.toBeInTheDocument();
    fillCommon();
    fireEvent.change(screen.getByLabelText("Publication web address"), { target: { value: "https://www.gov.uk/building-safety" } });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(sourceRegistration.parse(save.mock.calls[0][1])).toMatchObject({
      provider: "building-safety", accessMethod: "public_https", status: "paused",
      selection: { publicationUrl: "https://www.gov.uk/building-safety" },
      cadenceSeconds: 86400, dailyPence: 1000,
    });
    expect(save.mock.calls[0][1].selection).toEqual({ publicationUrl: "https://www.gov.uk/building-safety" });
  });

  it.each(["research-import", "commercial-import", "court-listings", "bailii"])("preserves licensed import registration for %s without publication-only fields", async (provider) => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceRegistrationForm rights={rights} save={save} onRecordLicence={vi.fn()} />);
    chooseType(provider);
    fillCommon();
    expect(screen.queryByLabelText("Publication web address")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Publication category")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(sourceRegistration.parse(save.mock.calls[0][1])).toMatchObject({
      provider, accessMethod: "licensed_import", selection: {}, status: "paused", rightsId: rights[0].id,
      dailyRequests: 100, dailyTokens: 100000, dailyPence: 1000, cadenceSeconds: 86400,
    });
  });

  it("keeps entered values when saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Recorded permission has expired"));
    render(<SourceRegistrationForm rights={rights} save={save} onRecordLicence={vi.fn()} />);
    chooseType("research-import");
    fillCommon();
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recorded permission has expired");
    expect(screen.getByLabelText("Source name")).toHaveValue("Example accounts");
    expect(screen.getByRole("button", { name: "Add source" })).toBeEnabled();
  });
});
