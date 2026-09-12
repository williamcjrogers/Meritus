import { NextResponse } from "next/server";
import { deleteDocumentRow, getDocument } from "@/lib/db/documents";
import { addActivity } from "@/lib/db/activity";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { isStorageConfigured } from "@/lib/env";
import { DIRECT_DOWNLOAD_BYTES, contentDisposition } from "@/lib/portal/files";
import { deleteObjects } from "@/lib/portal/s3";
import { getObjectStream, presignDownload } from "@/lib/portal/s3-transfer";

export const dynamic = "force-dynamic";
/** Streaming a file of up to 100 MiB on a slow link can take minutes. */
export const maxDuration = 300;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (document.size > DIRECT_DOWNLOAD_BYTES) {
    const url = await presignDownload(document.blobPathname, document.fileName);
    return NextResponse.redirect(url, 302);
  }

  const object = await getObjectStream(document.blobPathname);
  if (!object) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": document.mime,
    "Content-Disposition": contentDisposition(document.fileName),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  if (object.size !== null) headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isStorageConfigured()) return setupResponse("VeriCase S3 is not configured");

  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The database is authoritative: remove the row first so a listed file can never point at a missing object.
  await deleteDocumentRow(id);
  if (document.pursuitId) {
    await addActivity({
      pursuitId: document.pursuitId,
      kind: "file_removed",
      actorId: gate.userId,
      body: `Removed ${document.title}`,
      meta: { documentId: document.id, title: document.title },
    });
  }
  try {
    await deleteObjects([document.blobPathname]);
  } catch (error) {
    console.warn("S3 delete failed", { documentId: document.id, error: error instanceof Error ? error.name : "unknown" });
  }
  return NextResponse.json({ ok: true });
}
