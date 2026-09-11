import { NextResponse } from "next/server";
import { requireClientDumpUser } from "@/lib/client/auth";
import { clientObjectKey, parsePrepareInput } from "@/lib/client/files";
import { createDumpUpload, vericaseStoragePrefix } from "@/lib/client/storage";
import { insertClientFile } from "@/lib/db/client-files";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = parsePrepareInput(
    body && typeof body === "object" ? (body as { fileName?: unknown; mime?: unknown; size?: unknown }) : {}
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const storageKey = clientObjectKey({
    prefix: vericaseStoragePrefix(),
    domain: gate.user.domain,
    fileId: id,
    fileName: parsed.fileName,
  });

  try {
    const upload = await createDumpUpload({ storageKey, mime: parsed.mime });
    await insertClientFile({
      id,
      domain: gate.user.domain,
      clerkUserId: gate.user.userId,
      email: gate.user.email,
      title: parsed.fileName,
      fileName: parsed.fileName,
      mime: parsed.mime,
      size: parsed.size,
      storageKey,
      status: "pending",
    });
    return NextResponse.json({ id, upload }, { status: 201 });
  } catch (error) {
    console.error("[client] prepare dump failed", error);
    return NextResponse.json({ error: "Could not start the upload" }, { status: 500 });
  }
}
