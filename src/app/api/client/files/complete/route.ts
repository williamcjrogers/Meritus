import { NextResponse } from "next/server";
import { requireClientDumpUser } from "@/lib/client/auth";
import { dumpObjectExists } from "@/lib/client/storage";
import { getClientFile, markClientFileReady } from "@/lib/db/client-files";
import { isVericaseStorageConfigured } from "@/lib/env";
import { requireDatabaseOr503, setupResponse } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireClientDumpUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isVericaseStorageConfigured()) {
    return setupResponse("Storage is not connected");
  }

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "File id is required" }, { status: 400 });

  const row = await getClientFile(id);
  if (!row || row.domain !== gate.user.domain) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status === "ready") {
    return NextResponse.json({ ok: true });
  }

  const exists = await dumpObjectExists(row.storageKey);
  if (!exists) {
    return NextResponse.json({ error: "The file is not in the archive yet" }, { status: 409 });
  }

  const ready = await markClientFileReady(id);
  if (!ready) {
    return NextResponse.json({ error: "Could not finish the upload" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
