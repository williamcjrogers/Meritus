import { describe, expect, it } from "vitest";
import { isAllowedUpload } from "@/lib/portal/files";
import { isAllowedProgrammeUpload, programmeAcceptAttribute } from "./files";

describe("programme upload allow-list", () => {
  it("accepts Asta, P6, MSP, CSV, JSON and programme PDFs", () => {
    expect(isAllowedProgrammeUpload("Rev 10d.pp", "application/octet-stream")).toBe(true);
    expect(isAllowedProgrammeUpload("export.xml", "application/xml")).toBe(true);
    expect(isAllowedProgrammeUpload("baseline.xer", "")).toBe(true);
    expect(isAllowedProgrammeUpload("bars.csv", "text/csv")).toBe(true);
    expect(isAllowedProgrammeUpload("snap.json", "application/json")).toBe(true);
    expect(isAllowedProgrammeUpload("gantt.pdf", "application/pdf")).toBe(true);
    expect(isAllowedProgrammeUpload("notes.txt", "text/plain")).toBe(true);
  });

  it("rejects types that are not programmes, and does not widen the pursuit file list", () => {
    expect(isAllowedProgrammeUpload("setup.exe", "application/octet-stream")).toBe(false);
    expect(isAllowedProgrammeUpload("photo.png", "image/png")).toBe(false);
    expect(isAllowedProgrammeUpload("letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    expect(isAllowedUpload("Rev 10d.pp", "application/octet-stream")).toBe(false);
    expect(isAllowedUpload("baseline.xer", "application/octet-stream")).toBe(false);
    expect(programmeAcceptAttribute()).toContain(".pp");
  });
});
