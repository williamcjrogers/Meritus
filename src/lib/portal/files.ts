import type { DocumentRow } from "@/lib/db/schema";

/** Vercel functions refuse request bodies above 4.5 MB, so the desk stops a little under it. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

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
  if (!ALLOWED_EXT.has(ext)) return false;
  // The declared type only corroborates the extension; a generic or missing type is accepted.
  return mime === "" || mime === "application/octet-stream" || ALLOWED_MIME.has(mime);
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

/** What the browser needs about a file: never the extracted text itself. */
export type DocumentSummary = {
  id: string;
  title: string;
  size: number;
  createdAt: Date;
  hasText: boolean;
};

export function summariseDocument(doc: DocumentRow): DocumentSummary {
  return { id: doc.id, title: doc.title, size: doc.size, createdAt: doc.createdAt, hasText: hasReadableText(doc) };
}

/** RFC 6266: a plain ASCII filename for old agents and the UTF-8 form for everyone else. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
