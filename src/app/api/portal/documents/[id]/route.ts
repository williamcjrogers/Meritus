import { NextResponse } from "next/server";
import { deleteDocumentRow, getDocument } from "@/lib/db/documents";
import { addActivity } from "@/lib/db/activity";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { isStorageConfigured } from "@/lib/env";
import { deleteObjects, getObject } from "@/lib/portal/s3";

export const dynamic = "force-dynamic";

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

  const body = await getObject(document.blobPathname);
  if (!body) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": document.mime,
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
    },
  });
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
    console.warn("S3 delete failed", document.blobPathname, error);
  }
  return NextResponse.json({ ok: true });
}
