import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { listDocuments } from "@/lib/db/documents";
import { storePortalDocument } from "@/lib/portal/upload";
import { isBlobConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  return NextResponse.json({ documents: await listDocuments({ scope: "library" }) });
}

async function handlePost(request: Request) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isBlobConfigured()) return setupResponse("BLOB_READ_WRITE_TOKEN is not configured");

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  try {
    const document = await storePortalDocument({
      file,
      scope: "library",
      uploadedBy: gate.userId,
      title: String(form.get("title") ?? ""),
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Any failure, including one from a parser that cannot load, comes back as JSON with its reason. */
export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("upload failed", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
