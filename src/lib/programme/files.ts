import { extensionOf, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/portal/files";

export { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL };

/** Programme ingest is a dedicated path; these types stay off the pursuit file list. */
export const PROGRAMME_EXTENSIONS = [".pp", ".xml", ".xer", ".csv", ".json", ".txt", ".pdf"] as const;

const PROGRAMME_EXT = new Set<string>(PROGRAMME_EXTENSIONS);

const PROGRAMME_MIME = new Set([
  "application/pdf",
  "application/xml",
  "text/xml",
  "text/csv",
  "application/json",
  "text/plain",
  "application/octet-stream",
  "application/vnd.sema",
  "application/x-primavera",
]);

export function isAllowedProgrammeUpload(fileName: string, mime: string): boolean {
  const ext = extensionOf(fileName);
  if (!PROGRAMME_EXT.has(ext)) return false;
  return mime === "" || PROGRAMME_MIME.has(mime);
}

export function programmeAcceptAttribute(): string {
  return PROGRAMME_EXTENSIONS.join(",");
}

export function programmeUploadHint(): string {
  return `Asta .pp / XML, P6 .xer, MSP XML, CSV, JSON, programme PDF · up to ${MAX_UPLOAD_LABEL}`;
}
