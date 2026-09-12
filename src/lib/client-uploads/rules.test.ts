import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_UPLOAD_BYTES,
  MAX_PARTS,
  PART_SIZE,
  clientObjectPath,
  isAllowedClientUpload,
  parseCompletedParts,
  parseCreateInput,
  parsePartNumbers,
  planParts,
} from "./rules";

describe("isAllowedClientUpload", () => {
  it("accepts documents, spreadsheets, email, archives, images and programmes", () => {
    for (const name of ["bundle.PDF", "notes.docx", "old.doc", "costs.xlsx", "chain.msg", "mailbox.pst", "site.zip", "photo.heic", "prog.pp", "prog.xer", "plan.mpp", "drawing.dwg"]) {
      expect(isAllowedClientUpload(name)).toBe(true);
    }
  });
  it("refuses executables, scripts and names without an extension", () => {
    for (const name of ["setup.exe", "run.bat", "tool.js", "app.dmg", "noext"]) {
      expect(isAllowedClientUpload(name)).toBe(false);
    }
  });
});

describe("planParts", () => {
  it("uses 32 MiB parts and rounds up", () => {
    expect(planParts(1)).toEqual({ partSize: PART_SIZE, partCount: 1 });
    expect(planParts(PART_SIZE)).toEqual({ partSize: PART_SIZE, partCount: 1 });
    expect(planParts(PART_SIZE + 1)).toEqual({ partSize: PART_SIZE, partCount: 2 });
    expect(planParts(100 * 1000 * 1000).partCount).toBe(3);
  });
  it("stays inside the S3 part limit at the cap", () => {
    expect(planParts(MAX_CLIENT_UPLOAD_BYTES).partCount).toBeLessThanOrEqual(MAX_PARTS);
  });
});

describe("clientObjectPath", () => {
  it("puts the file under the domain with a uuid prefix and a sanitised name", () => {
    expect(clientObjectPath("example-firm.co.uk", "abc", 'Trial "bundle" v2.pdf')).toBe("clients/example-firm.co.uk/abc-Trial _bundle_ v2.pdf");
  });
});

describe("parseCreateInput", () => {
  it("accepts a plausible file", () => {
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 10, mime: "application/pdf" })).toEqual({
      ok: true,
      input: { fileName: "bundle.pdf", size: 10, mime: "application/pdf" },
    });
  });
  it("defaults a missing type and refuses bad input", () => {
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 10 })).toEqual({ ok: true, input: { fileName: "bundle.pdf", size: 10, mime: "application/octet-stream" } });
    expect(parseCreateInput({ fileName: "bundle.pdf", size: 0 })).toEqual({ ok: false, error: "The file is empty" });
    expect(parseCreateInput({ fileName: "bundle.pdf", size: MAX_CLIENT_UPLOAD_BYTES + 1 })).toEqual({ ok: false, error: "Files are limited to 50 GB" });
    expect(parseCreateInput({ fileName: "tool.exe", size: 5 })).toEqual({ ok: false, error: "That file type is not accepted" });
    expect(parseCreateInput(null)).toEqual({ ok: false, error: "A file name and size are required" });
  });
});

describe("parsePartNumbers", () => {
  it("accepts up to 200 distinct integers inside the plan", () => {
    expect(parsePartNumbers({ partNumbers: [1, 3] }, 3)).toEqual({ ok: true, partNumbers: [1, 3] });
    expect(parsePartNumbers({ partNumbers: [0] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: [4] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: [1, 1] }, 3).ok).toBe(false);
    expect(parsePartNumbers({ partNumbers: Array.from({ length: 201 }, (_, i) => i + 1) }, 300).ok).toBe(false);
  });
});

describe("parseCompletedParts", () => {
  it("needs every part once with an etag", () => {
    expect(parseCompletedParts({ parts: [{ partNumber: 2, etag: "b" }, { partNumber: 1, etag: "a" }] }, 2)).toEqual({
      ok: true,
      parts: [{ partNumber: 1, etag: "a" }, { partNumber: 2, etag: "b" }],
    });
    expect(parseCompletedParts({ parts: [{ partNumber: 1, etag: "a" }] }, 2)).toEqual({ ok: false, error: "Expected 2 parts" });
    expect(parseCompletedParts({ parts: [{ partNumber: 1, etag: "" }, { partNumber: 2, etag: "b" }] }, 2).ok).toBe(false);
  });
});
