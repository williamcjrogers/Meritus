import { extensionOf, isAllowedUpload, sanitizeFileName } from "@/lib/portal/files";
import { normaliseDomain } from "@/lib/portal/domains";

/** Browser uploads go straight to the archive, so this can be larger than a Vercel request body. */
export const MAX_CLIENT_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_CLIENT_UPLOAD_LABEL = "100 MB";

const EXTRA_EXT = new Set([".zip", ".csv", ".doc", ".xls"]);
const EXTRA_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
]);

export function isAllowedClientUpload(fileName: string, mime: string): boolean {
  if (isAllowedUpload(fileName, mime)) return true;
  const ext = extensionOf(fileName);
  if (!EXTRA_EXT.has(ext)) return false;
  return mime === "" || mime === "application/octet-stream" || EXTRA_MIME.has(mime);
}

export function parsePrepareInput(input: {
  fileName?: unknown;
  mime?: unknown;
  size?: unknown;
}): { ok: true; fileName: string; mime: string; size: number } | { ok: false; error: string } {
  const fileName = typeof input.fileName === "string" ? sanitizeFileName(input.fileName.trim()) : "";
  if (!fileName) return { ok: false, error: "Enter a file name" };

  const size = typeof input.size === "number" ? input.size : Number(input.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "The file is empty" };
  if (size > MAX_CLIENT_UPLOAD_BYTES) return { ok: false, error: `File exceeds ${MAX_CLIENT_UPLOAD_LABEL}` };

  const mime = typeof input.mime === "string" ? input.mime.trim() : "";
  if (!isAllowedClientUpload(fileName, mime || "application/octet-stream")) {
    return { ok: false, error: "File type not allowed" };
  }

  return { ok: true, fileName, mime: mime || "application/octet-stream", size };
}

/**
 * Namespace inside the existing VeriCase bucket so dumps do not collide with evidence.
 * Prefix comes from that tenant's settings and may be empty.
 */
export function clientObjectKey(input: { prefix: string; domain: string; fileId: string; fileName: string }): string {
  const prefix = input.prefix.replace(/^\/+|\/+$/g, "");
  const domain = normaliseDomain(input.domain);
  const fileId = input.fileId.replace(/[^a-zA-Z0-9-]/g, "");
  const fileName = sanitizeFileName(input.fileName);
  const parts = [prefix, "meritusvia", "client", domain, fileId, fileName].filter(Boolean);
  return parts.join("/");
}

export function contentDisposition(fileName: string): string {
  const ascii = sanitizeFileName(fileName).replace(/"/g, "");
  return `attachment; filename="${ascii}"`;
}

export type ClientFileSummary = {
  id: string;
  title: string;
  fileName: string;
  size: number;
  createdAt: Date;
  email: string;
};

export function summariseClientFile(row: {
  id: string;
  title: string;
  fileName: string;
  size: number;
  createdAt: Date;
  email: string;
}): ClientFileSummary {
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    size: row.size,
    createdAt: row.createdAt,
    email: row.email,
  };
}
