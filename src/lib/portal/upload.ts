import { put } from "@vercel/blob";
import { insertDocument } from "@/lib/db/documents";
import type { DocumentScope } from "@/lib/db/schema";
import { isBlobConfigured } from "@/lib/env";
import { extractUploadText } from "@/lib/research/extract-text";
import { isAllowedUpload, MAX_UPLOAD_BYTES, sanitizeFileName } from "./files";

export async function storePortalDocument(input: {
  file: File;
  scope: DocumentScope;
  pursuitId?: string | null;
  uploadedBy: string;
  title?: string;
}) {
  if (!isBlobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds 25MB");
  }
  if (!isAllowedUpload(input.file.name, input.file.type || "application/octet-stream")) {
    throw new Error("File type not allowed");
  }
  if (input.scope === "pursuit" && !input.pursuitId) {
    throw new Error("A pursuit is required for pursuit documents");
  }

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(input.file.name);
  const pathname = `portal/${input.scope}/${input.pursuitId ?? "firm"}/${id}-${fileName}`;
  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: false,
  });
  const extractedText = await extractUploadText(input.file);

  const row = await insertDocument({
      id,
      scope: input.scope,
      pursuitId: input.scope === "pursuit" ? input.pursuitId ?? null : null,
      title: input.title?.trim() || fileName,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      fileName,
      mime: input.file.type || "application/octet-stream",
      size: input.file.size,
      extractedText,
      uploadedBy: input.uploadedBy,
  });

  return row;
}
