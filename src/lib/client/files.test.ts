import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_UPLOAD_BYTES,
  clientObjectKey,
  contentDisposition,
  isAllowedClientUpload,
  parsePrepareInput,
} from "./files";

describe("isAllowedClientUpload", () => {
  it("accepts the portal types and dump extras", () => {
    expect(isAllowedClientUpload("letter.pdf", "application/pdf")).toBe(true);
    expect(isAllowedClientUpload("bundle.zip", "application/zip")).toBe(true);
    expect(isAllowedClientUpload("export.csv", "text/csv")).toBe(true);
    expect(isAllowedClientUpload("virus.exe", "application/octet-stream")).toBe(false);
  });
});

describe("parsePrepareInput", () => {
  it("accepts a named pdf", () => {
    expect(parsePrepareInput({ fileName: " Letter.pdf ", mime: "application/pdf", size: 1200 })).toEqual({
      ok: true,
      fileName: "Letter.pdf",
      mime: "application/pdf",
      size: 1200,
    });
  });

  it("refuses an empty or oversized file", () => {
    expect(parsePrepareInput({ fileName: "a.pdf", mime: "application/pdf", size: 0 }).ok).toBe(false);
    expect(
      parsePrepareInput({
        fileName: "a.pdf",
        mime: "application/pdf",
        size: MAX_CLIENT_UPLOAD_BYTES + 1,
      }).ok
    ).toBe(false);
  });
});

describe("clientObjectKey", () => {
  it("namespaces dumps under meritusvia/client and the company domain", () => {
    expect(
      clientObjectKey({
        prefix: "wr2",
        domain: "BREE.co.uk",
        fileId: "abc-123",
        fileName: "Letter of claim.pdf",
      })
    ).toBe("wr2/meritusvia/client/bree.co.uk/abc-123/Letter of claim.pdf");
  });

  it("omits an empty prefix and strips path traversal from the name", () => {
    expect(
      clientObjectKey({
        prefix: "",
        domain: "bree.co.uk",
        fileId: "id1",
        fileName: "../../secret.pdf",
      })
    ).toBe("meritusvia/client/bree.co.uk/id1/.._.._secret.pdf");
  });
});

describe("contentDisposition", () => {
  it("quotes a sanitised file name", () => {
    expect(contentDisposition('Letter "one".pdf')).toBe('attachment; filename="Letter _one_.pdf"');
  });
});
