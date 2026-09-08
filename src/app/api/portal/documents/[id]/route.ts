import { del, get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getDocument } from "@/lib/db/queries";
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

  await del(document.blobUrl);
  await requireDb().delete(documents).where(eq(documents.id, id));
  return NextResponse.json({ ok: true });
}
