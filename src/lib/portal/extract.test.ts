// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mammothMock = vi.hoisted(() => ({ extractRawText: vi.fn() }));
const pdfMock = vi.hoisted(() => ({ getText: vi.fn(), destroy: vi.fn() }));
vi.mock("mammoth", () => ({ default: mammothMock }));
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = pdfMock.getText;
    destroy = pdfMock.destroy;
  },
}));

import { extractUploadText } from "@/lib/research/extract-text";
import { hasReadableText, isAllowedUpload } from "./files";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SIMPLE_EML = [
  "From: Jane Partner <jane@bba.co.uk>",
  "To: William Rogers <william@meritusvia.com>",
  "Date: Tue, 09 Sep 2026 09:02:00 +0100",
  "Subject: Curtain wall defects",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Please see the attached letter of claim.",
  "",
].join("\r\n");

const HTML_ONLY_EML = [
  "From: jane@bba.co.uk",
  "To: william@meritusvia.com",
  "Subject: Scope",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<html><body><p>The <b>appointment</b> is attached.</p></body></html>",
  "",
].join("\r\n");

const ALTERNATIVE_EML = [
  "From: jane@bba.co.uk",
  "To: william@meritusvia.com",
  "Subject: Both parts",
  'Content-Type: multipart/alternative; boundary="b1"',
  "",
  "--b1",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Plain part wins.",
  "--b1",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Html part loses.</p>",
  "--b1--",
  "",
].join("\r\n");

beforeEach(() => {
  mammothMock.extractRawText.mockReset();
  pdfMock.getText.mockReset();
  pdfMock.destroy.mockReset().mockResolvedValue(undefined);
});

describe("extractUploadText for .eml", () => {
  it("writes From, To, Date and Subject as a header block, then the text part", async () => {
    const file = new File([SIMPLE_EML], "chain.eml", { type: "message/rfc822" });
    const text = await extractUploadText(file);
    expect(text).not.toBeNull();
    const [header, body] = (text as string).split("\n\n");
    expect(header.split("\n")).toEqual([
      "From: Jane Partner <jane@bba.co.uk>",
      "To: William Rogers <william@meritusvia.com>",
      "Date: 09 September 2026 09:02",
      "Subject: Curtain wall defects",
    ]);
    expect(body.trim()).toBe("Please see the attached letter of claim.");
  });

  it("recognises the extension when the browser sends no mime type", async () => {
    const file = new File([SIMPLE_EML], "chain.eml", { type: "" });
    const text = await extractUploadText(file);
    expect(text).toContain("Subject: Curtain wall defects");
  });

  it("prefers the plain text part of a multipart message", async () => {
    const file = new File([ALTERNATIVE_EML], "both.eml", { type: "message/rfc822" });
    const text = await extractUploadText(file);
    expect(text).toContain("Plain part wins.");
    expect(text).not.toContain("Html part loses.");
  });

  it("falls back to the html part with tags removed", async () => {
    const file = new File([HTML_ONLY_EML], "scope.eml", { type: "message/rfc822" });
    const text = await extractUploadText(file);
    expect(text).toContain("The appointment is attached.");
    expect(text).not.toContain("<b>");
  });
});

describe("extractUploadText for .docx", () => {
  it("passes the file buffer to mammoth and returns the raw text", async () => {
    mammothMock.extractRawText.mockResolvedValue({
      value: "Appointment terms\n\nClause 1",
      messages: [],
    });
    const file = new File(["fake zip bytes"], "Appointment.docx", { type: DOCX_MIME });
    const text = await extractUploadText(file);
    expect(text).toBe("Appointment terms\n\nClause 1");
    expect(mammothMock.extractRawText).toHaveBeenCalledTimes(1);
    const arg = mammothMock.extractRawText.mock.calls[0][0] as { buffer: Buffer };
    expect(Buffer.isBuffer(arg.buffer)).toBe(true);
    expect(arg.buffer.toString()).toBe("fake zip bytes");
  });

  it("returns null when the document has no text", async () => {
    mammothMock.extractRawText.mockResolvedValue({ value: "   \n", messages: [] });
    const file = new File(["fake zip bytes"], "Blank.docx", { type: DOCX_MIME });
    expect(await extractUploadText(file)).toBeNull();
  });

  it("returns null rather than throwing when mammoth cannot read the file", async () => {
    mammothMock.extractRawText.mockRejectedValue(new Error("not a zip"));
    const file = new File(["nonsense"], "Broken.docx", { type: DOCX_MIME });
    expect(await extractUploadText(file)).toBeNull();
  });
});

describe("extractUploadText for .pdf", () => {
  it("returns the parsed text and releases the parser", async () => {
    pdfMock.getText.mockResolvedValue({ text: "Letter of claim\n" });
    const file = new File(["%PDF"], "Letter.pdf", { type: "application/pdf" });
    expect(await extractUploadText(file)).toBe("Letter of claim");
    expect(pdfMock.destroy).toHaveBeenCalledTimes(1);
  });

  it("returns null rather than throwing when the pdf cannot be read", async () => {
    pdfMock.getText.mockRejectedValue(new Error("Invalid PDF structure"));
    const file = new File(["not a pdf"], "Broken.pdf", { type: "application/pdf" });
    expect(await extractUploadText(file)).toBeNull();
    expect(pdfMock.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("extractUploadText for other types", () => {
  it("stores .msg without text", async () => {
    const file = new File(["outlook bytes"], "Chain.msg", { type: "application/vnd.ms-outlook" });
    expect(await extractUploadText(file)).toBeNull();
  });

  it("stores .xlsx and images without text", async () => {
    expect(await extractUploadText(new File(["x"], "Costs.xlsx", { type: XLSX_MIME }))).toBeNull();
    expect(await extractUploadText(new File(["x"], "Site.png", { type: "image/png" }))).toBeNull();
  });

  it("reads .txt as it is and stores a blank file without text", async () => {
    const file = new File(["Plain note"], "note.txt", { type: "text/plain" });
    expect(await extractUploadText(file)).toBe("Plain note");
    const blank = new File(["  \n\n"], "blank.txt", { type: "text/plain" });
    expect(await extractUploadText(blank)).toBeNull();
  });
});

describe("isAllowedUpload", () => {
  it("accepts .eml and .msg by extension and by mime", () => {
    expect(isAllowedUpload("chain.eml", "message/rfc822")).toBe(true);
    expect(isAllowedUpload("chain.eml", "application/octet-stream")).toBe(true);
    expect(isAllowedUpload("Chain.MSG", "application/vnd.ms-outlook")).toBe(true);
    expect(isAllowedUpload("chain.msg", "application/octet-stream")).toBe(true);
  });

  it("rejects executables and unknown types", () => {
    expect(isAllowedUpload("setup.exe", "application/octet-stream")).toBe(false);
    expect(isAllowedUpload("setup.exe", "application/x-msdownload")).toBe(false);
    expect(isAllowedUpload("archive.zip", "application/zip")).toBe(false);
  });
});

describe("hasReadableText", () => {
  it("is true only when extracted text has content", () => {
    expect(hasReadableText({ extractedText: "Letter of claim" })).toBe(true);
    expect(hasReadableText({ extractedText: "   \n" })).toBe(false);
    expect(hasReadableText({ extractedText: "" })).toBe(false);
    expect(hasReadableText({ extractedText: null })).toBe(false);
  });
});
