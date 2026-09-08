import { put } from "@vercel/blob";
import { requireDb } from "@/lib/db";
import { documents, type DocumentScope } from "@/lib/db/schema";
import { isBlobConfigured } from "@/lib/env";
import { extractUploadText } from "@/lib/research/extract-text";
import { isAllowedUpload, MAX_UPLOAD_BYTES, sanitizeFileName } from "./files";

export async function storePortalDocument(input: {
  file: File;
  scope: DocumentScope;
  leadId?: string | null;
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
  if (input.scope === "lead" && !input.leadId) {
    throw new Error("Lead is required for lead documents");
  }

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(input.file.name);
  const pathname = `portal/${input.scope}/${input.leadId ?? "firm"}/${id}-${fileName}`;
  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: false,
  });
  const extractedText = await extractUploadText(input.file);

  const db = requireDb();
  const [row] = await db
    .insert(documents)
    .values({
      id,
      scope: input.scope,
      leadId: input.scope === "lead" ? input.leadId ?? null : null,
      title: input.title?.trim() || fileName,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      fileName,
      mime: input.file.type || "application/octet-stream",
      size: input.file.size,
      extractedText,
      uploadedBy: input.uploadedBy,
    })
    .returning();

  return row;
}
