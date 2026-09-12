/**
 * The client file drop, server side. Every entry point resolves the caller's active domain and
 * touches only uploads that belong to it. Nothing here reads a file's contents.
 */

import { findActiveClientDomain } from "@/lib/db/client-domains";
import { getClientUpload, insertClientUpload, listStaleClientUploads, updateClientUpload } from "@/lib/db/client-uploads";
import { insertDocument } from "@/lib/db/documents";
import type { ClientDomain, ClientUpload, ClientUploadStatus } from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/env";
import type { ClientIdentity } from "@/lib/portal/auth";
import { sanitizeFileName, summariseDocument, type DocumentSummary } from "@/lib/portal/files";
import { deleteObjects, objectKey } from "@/lib/portal/s3";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  listUploadedParts,
  presignUploadPart,
  s3Url,
  type UploadedPart,
} from "@/lib/portal/s3-transfer";
import {
  MAX_CLIENT_UPLOAD_BYTES,
  MAX_CLIENT_UPLOAD_LABEL,
  STALE_UPLOAD_MS,
  clientObjectPath,
  isAllowedClientUpload,
  parseCompletedParts,
  parsePartNumbers,
  planParts,
  type CompletedPart,
  type CreateInput,
} from "./rules";

export type ServiceError = { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

function fail(status: ServiceError["status"], error: string): ServiceError {
  return { ok: false, status, error };
}

async function activeDomain(identity: ClientIdentity): Promise<ClientDomain | ServiceError> {
  if (!identity.domain) return fail(403, "No client domain");
  const domain = await findActiveClientDomain(identity.domain);
  if (!domain) return fail(403, "Access for this domain has ended");
  return domain;
}

async function ownedUpload(
  identity: ClientIdentity,
  id: string
): Promise<{ upload: ClientUpload; domain: ClientDomain } | ServiceError> {
  const domain = await activeDomain(identity);
  if ("ok" in domain) return domain;
  const upload = await getClientUpload(id);
  if (!upload || upload.clientDomainId !== domain.id) return fail(404, "Upload not found");
  if (upload.status !== "pending") return fail(409, "Upload already finished");
  return { upload, domain };
}

export async function createUpload(
  identity: ClientIdentity,
  input: CreateInput,
  now: Date = new Date()
): Promise<{ ok: true; id: string; key: string; partSize: number; partCount: number } | ServiceError> {
  if (!isStorageConfigured()) return fail(503, "VeriCase S3 is not configured");
  const domain = await activeDomain(identity);
  if ("ok" in domain) return domain;
  if (input.size <= 0) return fail(400, "The file is empty");
  if (input.size > MAX_CLIENT_UPLOAD_BYTES) return fail(400, `Files are limited to ${MAX_CLIENT_UPLOAD_LABEL}`);
  if (!isAllowedClientUpload(input.fileName)) return fail(400, "That file type is not accepted");

  await sweepStaleUploads(now).catch(() => 0);

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(input.fileName);
  const key = objectKey(clientObjectPath(domain.domain, id, fileName));
  const mime = input.mime || "application/octet-stream";
  const plan = planParts(input.size);
  const { uploadId } = await createMultipartUpload(key, mime);
  await insertClientUpload({
    id,
    clientDomainId: domain.id,
    pursuitId: domain.pursuitId,
    userId: identity.userId,
    uploaderEmail: identity.email,
    key,
    uploadId,
    fileName,
    mime,
    size: input.size,
    partSize: plan.partSize,
    status: "pending",
  });
  return { ok: true, id, key, partSize: plan.partSize, partCount: plan.partCount };
}

export async function signParts(
  identity: ClientIdentity,
  id: string,
  partNumbers: number[]
): Promise<{ ok: true; urls: Record<string, string> } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { partCount } = planParts(owned.upload.size, owned.upload.partSize);
  const parsed = parsePartNumbers({ partNumbers }, partCount);
  if (!parsed.ok) return fail(400, parsed.error);
  const urls: Record<string, string> = {};
  await Promise.all(
    parsed.partNumbers.map(async (n) => {
      urls[String(n)] = await presignUploadPart(owned.upload.key, owned.upload.uploadId, n);
    })
  );
  return { ok: true, urls };
}

export async function describeUpload(
  identity: ClientIdentity,
  id: string
): Promise<
  | { ok: true; id: string; status: ClientUploadStatus; partSize: number; partCount: number; parts: UploadedPart[] }
  | ServiceError
> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { partCount } = planParts(owned.upload.size, owned.upload.partSize);
  const parts = await listUploadedParts(owned.upload.key, owned.upload.uploadId);
  return { ok: true, id, status: owned.upload.status, partSize: owned.upload.partSize, partCount, parts };
}

export async function completeUpload(
  identity: ClientIdentity,
  id: string,
  parts: CompletedPart[]
): Promise<{ ok: true; document: DocumentSummary } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  const { upload, domain } = owned;
  const { partCount } = planParts(upload.size, upload.partSize);
  const parsed = parseCompletedParts({ parts }, partCount);
  if (!parsed.ok) return fail(400, parsed.error);
  const ordered = parsed.parts;

  await completeMultipartUpload(upload.key, upload.uploadId, ordered);
  const head = await headObject(upload.key);
  if (!head || head.size !== upload.size) {
    try {
      await deleteObjects([upload.key]);
    } catch (error) {
      console.warn("Client uploads: could not remove a mismatched object", { uploadId: upload.id, error: error instanceof Error ? error.name : "unknown" });
    }
    await updateClientUpload(upload.id, { status: "aborted" });
    return fail(409, "The uploaded size does not match the file");
  }

  // Claim the row first: a second complete call for the same upload finds it no longer pending.
  const documentId = crypto.randomUUID();
  if (!(await updateClientUpload(upload.id, { status: "complete", documentId }))) {
    return fail(409, "Upload already finished");
  }
  const row = await insertDocument({
    id: documentId,
    scope: upload.pursuitId ? "pursuit" : "client",
    pursuitId: upload.pursuitId,
    clientDomainId: domain.id,
    title: upload.fileName,
    blobUrl: s3Url(upload.key),
    blobPathname: upload.key,
    fileName: upload.fileName,
    mime: upload.mime,
    size: upload.size,
    extractedText: null,
    uploadedBy: upload.userId,
    uploaderEmail: upload.uploaderEmail,
  });
  return { ok: true, document: summariseDocument(row) };
}

export async function abortUpload(identity: ClientIdentity, id: string): Promise<{ ok: true } | ServiceError> {
  const owned = await ownedUpload(identity, id);
  if ("ok" in owned) return owned;
  await abortMultipartUpload(owned.upload.key, owned.upload.uploadId);
  await updateClientUpload(owned.upload.id, { status: "aborted" });
  return { ok: true };
}

/** Aborts uploads left pending for a day, so abandoned parts stop costing money. Returns how many. */
export async function sweepStaleUploads(now: Date = new Date()): Promise<number> {
  const stale = await listStaleClientUploads(new Date(now.getTime() - STALE_UPLOAD_MS));
  let swept = 0;
  for (const upload of stale) {
    try {
      await abortMultipartUpload(upload.key, upload.uploadId);
      await updateClientUpload(upload.id, { status: "aborted" });
      swept += 1;
    } catch (error) {
      console.warn("Client uploads: sweep failed", { uploadId: upload.id, error: error instanceof Error ? error.name : "unknown" });
    }
  }
  return swept;
}
