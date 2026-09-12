import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { uploadFile } from "@/lib/client/upload";
import { browserTransport } from "@/lib/client/transport";
import { ClientUploadDesk } from "./ClientUploadDesk";

vi.mock("@/lib/client/upload", () => ({ uploadFile: vi.fn() }));
vi.mock("@/lib/client/transport", () => ({ browserTransport: {} }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const mockedUploadFile = vi.mocked(uploadFile);

beforeEach(() => {
  mockedUploadFile.mockReset();
  refresh.mockReset();
});

function selectInput(): HTMLInputElement {
  return screen.getByLabelText(/choose files/i) as HTMLInputElement;
}

describe("ClientUploadDesk", () => {
  it("uploads a chosen file, reports progress and refreshes on completion", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    let resolveUpload!: (value: { id: string; title: string; size: number }) => void;
    mockedUploadFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(<ClientUploadDesk />);
    const file = new File(["a bundle of documents"], "bundle.pdf", { type: "application/pdf" });
    await userEvent.upload(selectInput(), file);

    expect(mockedUploadFile).toHaveBeenCalledTimes(1);
    const [calledFile, calledTransport, options] = mockedUploadFile.mock.calls[0];
    expect(calledFile).toBe(file);
    expect(calledTransport).toBe(browserTransport);
    expect(options?.onSession).toEqual(expect.any(Function));
    expect(options?.onProgress).toEqual(expect.any(Function));

    expect(getItemSpy).toHaveBeenCalledWith(expect.stringMatching(/^meritus-upload:/));

    act(() => {
      options?.onProgress?.(0.5);
    });
    expect(screen.getByText(/50%/)).toBeInTheDocument();

    await act(async () => {
      resolveUpload({ id: "doc1", title: "bundle.pdf", size: file.size });
    });

    expect(await screen.findByText(/received/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    getItemSpy.mockRestore();
  });

  it("shows the failure and retries the same file on demand", async () => {
    mockedUploadFile.mockRejectedValueOnce(new Error("The connection dropped while uploading"));
    mockedUploadFile.mockResolvedValueOnce({ id: "doc2", title: "bundle.pdf", size: 5 });

    render(<ClientUploadDesk />);
    const file = new File(["a bundle of documents"], "bundle.pdf", { type: "application/pdf" });
    await userEvent.upload(selectInput(), file);

    expect(await screen.findByText("The connection dropped while uploading")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });

    await userEvent.click(retryButton);

    await waitFor(() => expect(mockedUploadFile).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/received/i)).toBeInTheDocument();
  });
});

it("does not claim receipt when byte transfer is complete but confirmation is pending", async () => {
  mockedUploadFile.mockImplementation((_file, _transport, options) => { options?.onProgress?.(1); return new Promise(() => {}); });
  render(<ClientUploadDesk />);
  await userEvent.upload(selectInput(), new File(["contents"], "bundle.pdf", { type: "application/pdf" }));
  expect(screen.getByText(/confirming receipt/i)).toBeInTheDocument();
  expect(screen.queryByText(/Received/)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
});
