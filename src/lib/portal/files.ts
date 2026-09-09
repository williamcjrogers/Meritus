import type { DocumentRow } from "@/lib/db/schema";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "message/rfc822",
  "application/vnd.ms-outlook",
]);

const ALLOWED_EXT = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".eml",
  ".msg",
]);

export function isAllowedUpload(fileName: string, mime: string): boolean {
  const ext = extensionOf(fileName);
  if (ALLOWED_MIME.has(mime)) return true;
  return ALLOWED_EXT.has(ext);
}

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
}

/** True when the questions drawer can read the document, shown as the "text" or "no text" tag. */
export function hasReadableText(doc: Pick<DocumentRow, "extractedText">): boolean {
  return typeof doc.extractedText === "string" && doc.extractedText.trim().length > 0;
}
