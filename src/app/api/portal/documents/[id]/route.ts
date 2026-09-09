import { del, get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { deleteDocumentRow, getDocument } from "@/lib/db/documents";
import { addActivity } from "@/lib/db/activity";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { isBlobConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isBlobConfigured()) return setupResponse("BLOB_READ_WRITE_TOKEN is not configured");

  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blob = await get(document.blobUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new Response(blob.stream, {
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
  if (!isBlobConfigured()) return setupResponse("BLOB_READ_WRITE_TOKEN is not configured");

  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await del(document.blobUrl);
  } catch (error) {
    console.warn("blob delete failed", document.blobPathname, error);
  }
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
  return NextResponse.json({ ok: true });
}
