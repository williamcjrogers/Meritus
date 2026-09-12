/** What a client may send and how it is cut into S3 parts. Pure: safe in the browser and in tests. */
import { extensionOf, sanitizeFileName } from "@/lib/portal/files";

export const MAX_CLIENT_UPLOAD_BYTES = 50 * 1024 ** 3;
export const MAX_CLIENT_UPLOAD_LABEL = "50 GB";
export const PART_SIZE = 32 * 1024 * 1024;
export const MAX_PARTS = 10_000;
export const MAX_SIGN_BATCH = 200;
export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const CLIENT_ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".rtf", ".odt", ".txt", ".md",
  ".xls", ".xlsx", ".csv", ".ods",
  ".ppt", ".pptx",
  ".eml", ".msg", ".pst", ".mbox",
  ".zip", ".7z", ".rar",
  ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".gif",
  ".mp4", ".mov", ".m4a", ".mp3",
  ".pp", ".xer", ".mpp", ".xml", ".json",
  ".dwg", ".dxf", ".ifc",
]);

export const CLIENT_ALLOWED_LABEL =
  "Documents, spreadsheets, presentations, email files, archives, images, recordings, programmes and drawings";

export function isAllowedClientUpload(fileName: string): boolean {
  return CLIENT_ALLOWED_EXT.has(extensionOf(fileName));
}

export function planParts(size: number, partSize: number = PART_SIZE): { partSize: number; partCount: number } {
  const partCount = Math.max(1, Math.ceil(size / partSize));
  if (partCount > MAX_PARTS) throw new Error("Too many parts");
  return { partSize, partCount };
}

export function clientObjectPath(domain: string, id: string, fileName: string): string {
  return `clients/${domain}/${id}-${sanitizeFileName(fileName)}`;
}

export type CreateInput = { fileName: string; size: number; mime: string };

export function parseCreateInput(body: unknown): { ok: true; input: CreateInput } | { ok: false; error: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const fileName = typeof record?.fileName === "string" ? record.fileName.trim() : "";
  const size = typeof record?.size === "number" && Number.isFinite(record.size) ? Math.floor(record.size) : NaN;
  if (!fileName || Number.isNaN(size)) return { ok: false, error: "A file name and size are required" };
  if (size <= 0) return { ok: false, error: "The file is empty" };
  if (size > MAX_CLIENT_UPLOAD_BYTES) return { ok: false, error: `Files are limited to ${MAX_CLIENT_UPLOAD_LABEL}` };
  if (!isAllowedClientUpload(fileName)) return { ok: false, error: "That file type is not accepted" };
  const mime = typeof record?.mime === "string" && record.mime ? record.mime.slice(0, 120) : "application/octet-stream";
  return { ok: true, input: { fileName, size, mime } };
}

function isPartNumber(value: unknown, partCount: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= partCount;
}

export function parsePartNumbers(
  body: unknown,
  partCount: number
): { ok: true; partNumbers: number[] } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).partNumbers : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SIGN_BATCH) {
    return { ok: false, error: `Ask for between 1 and ${MAX_SIGN_BATCH} parts` };
  }
  const partNumbers = raw.filter((n) => isPartNumber(n, partCount)) as number[];
  if (partNumbers.length !== raw.length || new Set(partNumbers).size !== partNumbers.length) {
    return { ok: false, error: "Part numbers must be distinct and inside the plan" };
  }
  return { ok: true, partNumbers };
}

export type CompletedPart = { partNumber: number; etag: string };

export function parseCompletedParts(
  body: unknown,
  partCount: number
): { ok: true; parts: CompletedPart[] } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).parts : null;
  if (!Array.isArray(raw) || raw.length !== partCount) return { ok: false, error: `Expected ${partCount} parts` };
  const parts: CompletedPart[] = [];
  for (const entry of raw) {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const partNumber = record?.partNumber;
    const etag = typeof record?.etag === "string" ? record.etag.trim() : "";
    if (!isPartNumber(partNumber, partCount) || !etag) return { ok: false, error: "Every part needs a number and an etag" };
    parts.push({ partNumber, etag });
  }
  parts.sort((a, b) => a.partNumber - b.partNumber);
  if (parts.some((part, index) => part.partNumber !== index + 1)) return { ok: false, error: "Every part must appear exactly once" };
  return { ok: true, parts };
}
