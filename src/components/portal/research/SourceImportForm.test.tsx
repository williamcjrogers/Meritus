import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { SourceImportForm } from "./SourceImportForm";

const source = {
  id: "00000000-0000-4000-8000-000000000001",
  label: "Project records",
  provider: "research-import",
  status: "ready",
} as SourceSettings;
const previewResult = { rows: [{ id: "1", text: "Project update" }], errors: [] };

beforeEach(() => {
  // jsdom does not serialise user-event's selected files into native FormData.
  const NativeFormData = globalThis.FormData;
  vi.stubGlobal("FormData", class extends NativeFormData {
    constructor(form?: HTMLFormElement) {
      super(form);
      const fileInput = form?.elements.namedItem("file") as HTMLInputElement | null;
      const selectedFile = fileInput?.files?.[0];
      if (selectedFile) this.set("file", selectedFile);
    }
  });
});

afterEach(() => vi.unstubAllGlobals());

async function fillForm() {
  fireEvent.change(screen.getByLabelText("Registered source"), { target: { value: source.id } });
  await userEvent.upload(
    screen.getByLabelText("Research file"),
    new File(["record_id,description\n1,Project update"], "research.csv", { type: "text/csv" }),
  );
  fireEvent.change(screen.getByLabelText("Research question"), { target: { value: "What do the records show about this organisation?" } });
  fireEvent.change(screen.getByLabelText("Public subject"), { target: { value: "Example Construction Limited" } });
  fireEvent.change(screen.getByLabelText("Record ID column"), { target: { value: "record_id" } });
  fireEvent.change(screen.getByLabelText("Text column"), { target: { value: "description" } });
}

async function previewFile() {
  submitForm("Preview file");
  await screen.findByText(/No mapping errors found/);
  expect(screen.getByRole("button", { name: "Start import" })).toBeEnabled();
}

function submitForm(name: string) {
  const button = screen.getByRole("button", { name });
  // Exercise React's handler directly because jsdom also treats uploaded files
  // as missing when running native required-field validation.
  fireEvent(button.closest("form")!, new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: button }));
}

describe("SourceImportForm", () => {
  it("requires a successful preview and sends single-file defaults without exposing split fields", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(previewResult));
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.queryByLabelText("Total number of parts")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Original file hash")).not.toBeInTheDocument();
    await fillForm();
    await previewFile();
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/portal/research/imports");
    expect(init!.method).toBe("POST");
    const form = init!.body as FormData;
    expect(form.get("action")).toBe("preview");
    expect(form.get("sourceId")).toBe(source.id);
    expect(form.get("partCount")).toBe("1");
    expect(form.get("partIndex")).toBe("1");
    expect(form.get("snapshotHash")).toBe("");
    expect(form.get("requestId")).toMatch(/^[a-f0-9-]{36}$/);
    expect((form.get("file") as File).name).toBe("research.csv");
  });

  it("invalidates a successful preview after research details, mappings, source, format or file change", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(previewResult)));
    const alternativeSource = { ...source, id: "00000000-0000-4000-8000-000000000002", label: "Other records" };
    render(<SourceImportForm sources={[source, alternativeSource]} reload={vi.fn()} />);
    await fillForm();
    for (const [label, value] of [
      ["Research question", "What changed this year?"],
      ["Public subject", "Other Construction Limited"],
      ["Record ID column", "record_reference"],
      ["Text column", "record_text"],
      ["Title column", "record_title"],
      ["Registered source", alternativeSource.id],
      ["File format", "json"],
    ]) {
      await previewFile();
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
      expect(screen.queryByText(/No mapping errors found/)).not.toBeInTheDocument();
    }
    await previewFile();
    await userEvent.upload(screen.getByLabelText("Research file"), new File(["[]"], "replacement.json", { type: "application/json" }));
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  it("retains mapping corrections and keeps import blocked when preview reports errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      rows: [],
      errors: [{ row: 2, field: "mapping", message: "Missing mapped field text: description" }],
    })));
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    submitForm("Preview file");
    expect(await screen.findByRole("status")).toHaveTextContent("1 error needs correcting");
    expect(screen.getByText("Missing mapped field text: description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.getByLabelText("Text column")).toHaveValue("description");
  });

  it("rejects files larger than 4 MiB before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    await userEvent.upload(screen.getByLabelText("Research file"), new File([
      new Uint8Array(4 * 1024 * 1024 + 1),
    ], "too-large.csv", { type: "text/csv" }));
    submitForm("Preview file");
    expect(screen.getByRole("alert")).toHaveTextContent("This file exceeds 4 MiB.");
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not reuse an older preview after a later preview request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(previewResult))
      .mockResolvedValueOnce(Response.json({ error: "registered_import_source_required" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    await previewFile();
    submitForm("Preview file");
    expect(await screen.findByRole("alert")).toHaveTextContent("registered import source required");
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview file" })).toBeEnabled();
  });

  it("cannot submit an import before preview even if native form submission bypasses the disabled button", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    const button = screen.getByRole("button", { name: "Start import" });
    const form = button.closest("form")!;
    fireEvent(form, new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: button }));
    expect(screen.getByRole("alert")).toHaveTextContent("Preview this file and correct any errors");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires split-file details, submits them, and restores single-file defaults when unchecked", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(previewResult));
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    await previewFile();
    const splitChoice = screen.getByRole("checkbox", { name: "This file is one part of a larger, split file" });
    fireEvent.click(splitChoice);
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.getByLabelText("Original file hash")).toBeRequired();
    fireEvent.change(screen.getByLabelText("Total number of parts"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Part number (starts at 1)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Original file hash"), { target: { value: "a".repeat(64) } });
    await previewFile();
    const splitPayload = fetchMock.mock.calls[1][1]!.body as FormData;
    expect(splitPayload.get("partCount")).toBe("3");
    expect(splitPayload.get("partIndex")).toBe("2");
    expect(splitPayload.get("snapshotHash")).toBe("a".repeat(64));
    fireEvent.change(screen.getByLabelText("Part number (starts at 1)"), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    fireEvent.click(splitChoice);
    await previewFile();
    const wholePayload = fetchMock.mock.calls[2][1]!.body as FormData;
    expect(wholePayload.get("partCount")).toBe("1");
    expect(wholePayload.get("partIndex")).toBe("1");
    expect(wholePayload.get("snapshotHash")).toBe("");
  });

  it("does not enable import when details change while a preview request is pending", async () => {
    let resolvePreview!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolvePreview = resolve; })));
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    submitForm("Preview file");
    expect(screen.getByRole("button", { name: "Checking file…" })).toBeDisabled();
    expect(screen.getByLabelText("Research question")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Research question"), { target: { value: "Changed during preview" } });
    await act(async () => resolvePreview(Response.json(previewResult)));
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.queryByText(/No mapping errors found/)).not.toBeInTheDocument();
  });

  it("keeps the request ID and validated preview when retrying a failed import", async () => {
    const fetchMock = vi.fn(async (_path: string, init: RequestInit) => {
      const payload = init.body as FormData;
      if (payload.get("action") === "preview") return Response.json(previewResult);
      throw new Error("Network interrupted");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} />);
    await fillForm();
    await previewFile();
    for (let attempt = 0; attempt < 2; attempt++) {
      submitForm("Start import");
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network interrupted"));
      expect(screen.getByRole("button", { name: "Start import" })).toBeEnabled();
    }
    const payloads = fetchMock.mock.calls.map(([, init]) => init.body as FormData);
    expect(payloads.map((payload) => payload.get("action"))).toEqual(["preview", "import", "import"]);
    expect(new Set(payloads.map((payload) => payload.get("requestId"))).size).toBe(1);
  });

  it("reports busy state for requests and releases it after success or failure, without reporting validation failures", async () => {
    let resolvePreview!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolvePreview = resolve; }))
      .mockRejectedValueOnce(new Error("Network interrupted"));
    const onBusyChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SourceImportForm sources={[source]} reload={vi.fn()} onBusyChange={onBusyChange} />);

    submitForm("Start import");
    expect(onBusyChange).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await fillForm();
    submitForm("Preview file");
    expect(onBusyChange.mock.calls).toEqual([[true]]);
    await act(async () => resolvePreview(Response.json(previewResult)));
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);

    submitForm("Start import");
    expect(onBusyChange.mock.calls).toEqual([[true], [false], [true]]);
    await screen.findByText("Network interrupted");
    expect(onBusyChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  it("offers source registration when no source supports file imports", () => {
    const onAddSource = vi.fn();
    render(<SourceImportForm sources={[{ ...source, provider: "publications" }]} reload={vi.fn()} onAddSource={onAddSource} />);
    expect(screen.getByText("Add a source before importing a file.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Research file")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    expect(onAddSource).toHaveBeenCalledOnce();
  });

  it("links to the sources page when no registration callback is provided", () => {
    render(<SourceImportForm sources={[]} reload={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Go to sources" })).toHaveAttribute("href", "/portal/research/sources");
  });
});
