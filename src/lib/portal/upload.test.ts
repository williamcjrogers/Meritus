// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  insertDocument: vi.fn(),
  addActivity: vi.fn(),
  extractUploadText: vi.fn(),
}));

vi.mock("./s3", () => ({ putObject: mocks.put }));
vi.mock("@/lib/db/documents", () => ({ insertDocument: mocks.insertDocument }));
vi.mock("@/lib/db/activity", () => ({ addActivity: mocks.addActivity }));
vi.mock("@/lib/env", () => ({ isStorageConfigured: () => true }));
vi.mock("@/lib/research/extract-text", () => ({ extractUploadText: mocks.extractUploadText }));

import { storePortalDocument } from "./upload";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.put.mockResolvedValue({
    url: "s3://vericase-docs/meritus/portal/x",
    key: "meritus/portal/x",
  });
  mocks.extractUploadText.mockResolvedValue("Letter text");
  mocks.insertDocument.mockImplementation(async (values: Record<string, unknown>) => ({
    ...values,
    createdAt: new Date("2026-09-09T10:15:00Z"),
  }));
  mocks.addActivity.mockResolvedValue({});
});

describe("storePortalDocument", () => {
  it("logs file_added by the uploader when the scope is a pursuit", async () => {
    const file = new File(["%PDF"], "Letter of claim.pdf", { type: "application/pdf" });
    const row = await storePortalDocument({
      file,
      scope: "pursuit",
      pursuitId: "p1",
      uploadedBy: "user_wr",
    });

    expect(mocks.addActivity).toHaveBeenCalledTimes(1);
    expect(mocks.addActivity).toHaveBeenCalledWith({
      pursuitId: "p1",
      kind: "file_added",
      actorId: "user_wr",
      body: "Added Letter of claim.pdf",
      meta: { documentId: row.id, title: "Letter of claim.pdf" },
    });
  });

  it("does not log activity for library documents", async () => {
    const file = new File(["%PDF"], "Template.pdf", { type: "application/pdf" });
    await storePortalDocument({ file, scope: "library", uploadedBy: "user_wr" });
    expect(mocks.addActivity).not.toHaveBeenCalled();
  });

  it("accepts an .eml and stores its extracted text", async () => {
    const file = new File(["From: a@b.c\r\n\r\nHi"], "chain.eml", { type: "message/rfc822" });
    await storePortalDocument({ file, scope: "pursuit", pursuitId: "p1", uploadedBy: "user_wr" });
    expect(mocks.insertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "chain.eml",
        extractedText: "Letter text",
        blobUrl: "s3://vericase-docs/meritus/portal/x",
        blobPathname: "meritus/portal/x",
      })
    );
    expect(mocks.put).toHaveBeenCalledWith(
      expect.stringContaining("portal/pursuit/p1/"),
      expect.any(Buffer),
      "message/rfc822"
    );
  });

  it("extracts text before writing to S3 so a failed extraction leaves nothing behind", async () => {
    mocks.extractUploadText.mockRejectedValue(new Error("file unreadable"));
    const file = new File(["%PDF"], "Letter of claim.pdf", { type: "application/pdf" });
    await expect(
      storePortalDocument({ file, scope: "pursuit", pursuitId: "p1", uploadedBy: "user_wr" })
    ).rejects.toThrow("file unreadable");
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.insertDocument).not.toHaveBeenCalled();
  });

  it("rejects a type outside the allow-list before touching S3", async () => {
    const file = new File(["MZ"], "setup.exe", { type: "application/octet-stream" });
    await expect(
      storePortalDocument({ file, scope: "pursuit", pursuitId: "p1", uploadedBy: "user_wr" })
    ).rejects.toThrow("File type not allowed");
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.addActivity).not.toHaveBeenCalled();
  });
});
