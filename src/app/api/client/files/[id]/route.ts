import { NextResponse } from "next/server";
import { requireClientDumpUser } from "@/lib/client/auth";
import { contentDisposition } from "@/lib/client/files";
import { deleteDumpObject, readDumpObject } from "@/lib/client/storage";
import { deleteClientFileRow, getClientFile } from "@/lib/db/client-files";
import { isVericaseStorageConfigured } from "@/lib/env";
import { requireDatabaseOr503, setupResponse } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientDumpUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isVericaseStorageConfigured()) {
    return setupResponse("Storage is not connected");
  }

  const { id } = await context.params;
  const row = await getClientFile(id);
  if (!row || row.domain !== gate.user.domain || row.status !== "ready") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await readDumpObject(row.storageKey);
  if (!object) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new Response(object.stream, {
    headers: {
      "Content-Type": row.mime || object.contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(row.fileName),
    },
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientDumpUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isVericaseStorageConfigured()) {
    return setupResponse("Storage is not connected");
  }

  const { id } = await context.params;
  const row = await getClientFile(id);
  if (!row || row.domain !== gate.user.domain) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteClientFileRow(id);
  try {
    await deleteDumpObject(row.storageKey);
  } catch (error) {
    console.warn("[client] archive delete failed", id, error);
  }
  return NextResponse.json({ ok: true });
}
