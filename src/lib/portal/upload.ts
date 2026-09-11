import { addActivity } from "@/lib/db/activity";
import { insertDocument } from "@/lib/db/documents";
import type { DocumentScope } from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/env";
import { extractUploadText } from "@/lib/research/extract-text";
import { isAllowedUpload, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, sanitizeFileName } from "./files";
import { putObject } from "./s3";

export async function storePortalDocument(input: {
  file: File;
  scope: DocumentScope;
  pursuitId?: string | null;
  uploadedBy: string;
  title?: string;
}) {
  if (!isStorageConfigured()) {
    throw new Error("VeriCase S3 is not configured");
  }
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_LABEL}`);
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
  // Extract before writing to S3 so a failure here leaves nothing behind in the store.
  const extractedText = await extractUploadText(input.file);
  const body = Buffer.from(await input.file.arrayBuffer());
  const stored = await putObject(pathname, body, input.file.type || "application/octet-stream");

  const row = await insertDocument({
      id,
      scope: input.scope,
      pursuitId: input.scope === "pursuit" ? input.pursuitId ?? null : null,
      title: input.title?.trim() || fileName,
      blobUrl: stored.url,
      blobPathname: stored.key,
      fileName,
      mime: input.file.type || "application/octet-stream",
      size: input.file.size,
      extractedText,
      uploadedBy: input.uploadedBy,
  });

  if (row.scope === "pursuit" && row.pursuitId) {
    await addActivity({
      pursuitId: row.pursuitId,
      kind: "file_added",
      actorId: input.uploadedBy,
      body: `Added ${row.title}`,
      meta: { documentId: row.id, title: row.title },
    });
  }

  return row;
}
