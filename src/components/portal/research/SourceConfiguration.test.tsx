import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { SourceConfiguration } from "./SourceConfiguration";

const source: SourceSettings = {
  id: "company-source",
  label: "Companies House",
  provider: "companies-house",
  status: "paused",
  selection: { companyNumber: "SC000123" },
  dailyRequests: 723,
  dailyTokens: 135791,
  dailyPence: 2039,
  credentialConfigured: true,
  lastSuccessAt: null,
  nextDueAt: "2026-09-12T00:00:00Z",
  configurationError: null,
  attribution: "Contains public sector information.",
  termsUrl: "https://example.com/terms",
  termsVersion: "Version 3",
  rightsId: "rights-source",
};

function saveChanges() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("SourceConfiguration", () => {
  it.each(["paused", "unavailable"])("preserves an existing %s status and all limits when saving", async (status) => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, status }} save={save} />);

    expect(screen.getByLabelText("Use this source")).toHaveValue(status);
    expect(screen.getByText("Advanced limits").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Licence and technical details").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Daily AI spending limit (£)")).toHaveValue("20.39");
    saveChanges();

    await waitFor(() => expect(save).toHaveBeenCalledWith("sources/company-source", {
      status,
      dailyRequests: 723,
      dailyTokens: 135791,
      dailyPence: 2039,
      selection: { companyNumber: "SC000123" },
    }, "PATCH"));
    expect(await screen.findByRole("status")).toHaveTextContent("Changes saved.");
  });

  it.each([["0.29", 29], ["1.01", 101], ["12.3", 1230], ["10000", 1_000_000]])("converts £%s exactly to integer pence", async (amount, pence) => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={source} save={save} />);
    fireEvent.change(screen.getByLabelText("Daily AI spending limit (£)"), { target: { value: amount } });
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ dailyPence: pence }), "PATCH"));
  });

  it.each(["", "1.001", "-1", "10000.01", "1e3"])("rejects invalid GBP input %j and reveals the control", async (amount) => {
    const save = vi.fn();
    render(<SourceConfiguration source={source} save={save} />);
    fireEvent.change(screen.getByLabelText("Daily AI spending limit (£)"), { target: { value: amount } });
    saveChanges();
    expect(await screen.findByRole("alert")).toHaveTextContent(/daily budget/i);
    expect(screen.getByText("Advanced limits").closest("details")).toHaveAttribute("open");
    expect(save).not.toHaveBeenCalled();
  });

  it("shows only the Companies House selection and normalises short numeric numbers", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={source} save={save} />);
    expect(screen.queryByRole("group", { name: "Gazette notices to include" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Company number"), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText("Use this source"), { target: { value: "ready" } });
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: "ready", selection: { companyNumber: "00012345" } }), "PATCH"));
  });

  it("allows an unconfigured Companies House source to remain paused without inventing a company number", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, selection: {} }} save={save} />);
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: "paused", selection: { companyNumber: "" } }), "PATCH"));
  });

  it("offers named Gazette notice types and sends the selected codes", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, provider: "gazette", label: "The Gazette", status: "ready", selection: { noticeTypes: ["2443"] } }} save={save} />);
    expect(screen.queryByLabelText("Company number")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByRole("checkbox", { name: "Appointment of liquidators (creditors' voluntary)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Petitions to wind up (companies)" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Petitions to wind up (companies)" }));
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ selection: { noticeTypes: ["2443", "2450"] } }), "PATCH"));
  });

  it("does not preselect Gazette choices and explains an empty enabled selection without requiring code knowledge", async () => {
    const save = vi.fn();
    render(<SourceConfiguration source={{ ...source, provider: "gazette", status: "ready", selection: {} }} save={save} />);
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    saveChanges();
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose at least one notice type");
    expect(save).not.toHaveBeenCalled();
  });

  it("preserves existing additional Gazette codes and their saved order", async () => {
    const save = vi.fn().mockResolvedValue({});
    const savedNoticeTypes = ["9998", "2450", "9999", "2443"];
    render(<SourceConfiguration source={{ ...source, provider: "gazette", status: "ready", selection: { noticeTypes: savedNoticeTypes } }} save={save} />);
    expect(screen.getByText("Additional notice types").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Additional notice codes")).toHaveValue("9998, 9999");
    expect(screen.getByRole("checkbox", { name: "Appointment of administrators" })).not.toBeChecked();
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ selection: { noticeTypes: savedNoticeTypes } }), "PATCH"));
  });

  it("lets the user remove a named Gazette type without discarding additional codes", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, provider: "gazette", status: "ready", selection: { noticeTypes: ["9999", "2443", "2450"] } }} save={save} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Appointment of liquidators (creditors' voluntary)" }));
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ selection: { noticeTypes: ["9999", "2450"] } }), "PATCH"));
  });

  it("validates additional Gazette codes without losing the named choices", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, provider: "gazette", status: "ready", selection: { noticeTypes: ["2443"] } }} save={save} />);
    const notices = screen.getByLabelText("Additional notice codes");
    fireEvent.change(notices, { target: { value: "invalid" } });
    saveChanges();
    expect(await screen.findByRole("alert")).toHaveTextContent("Additional notice codes must each contain four digits");
    expect(screen.getByText("Additional notice types").closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("checkbox", { name: "Appointment of liquidators (creditors' voluntary)" })).toBeChecked();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(notices, { target: { value: "9998, 9999" } });
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ selection: { noticeTypes: ["2443", "9998", "9999"] } }), "PATCH"));
  });

  it("does not send irrelevant selection settings for other sources", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SourceConfiguration source={{ ...source, provider: "find-case-law", selection: { order: "-transformation" } }} save={save} />);
    expect(screen.queryByLabelText("Company number")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Gazette notices to include" })).not.toBeInTheDocument();
    saveChanges();
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1]).not.toHaveProperty("selection");
  });

  it("keeps the user's choices when the server rejects a save", async () => {
    const save = vi.fn().mockRejectedValue(new Error("credential missing"));
    render(<SourceConfiguration source={source} save={save} />);
    fireEvent.change(screen.getByLabelText("Company number"), { target: { value: "SC987654" } });
    fireEvent.change(screen.getByLabelText("Use this source"), { target: { value: "ready" } });
    saveChanges();
    expect(await screen.findByRole("alert")).toHaveTextContent("credential missing");
    expect(screen.getByLabelText("Company number")).toHaveValue("SC987654");
    expect(screen.getByLabelText("Use this source")).toHaveValue("ready");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts with the new source's saved values when switching source", () => {
    const save = vi.fn();
    const { rerender } = render(<SourceConfiguration source={source} save={save} />);
    fireEvent.change(screen.getByLabelText("Company number"), { target: { value: "unsaved" } });
    rerender(<SourceConfiguration source={{ ...source, id: "other-source", status: "ready", selection: { companyNumber: "12345678" } }} save={save} />);
    expect(screen.getByLabelText("Use this source")).toHaveValue("ready");
    expect(screen.getByLabelText("Company number")).toHaveValue("12345678");
  });
});
