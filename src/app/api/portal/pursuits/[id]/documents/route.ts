import { NextResponse } from "next/server";
import { getPursuit } from "@/lib/db/pursuits";
import { isBlobConfigured } from "@/lib/env";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { storePortalDocument } from "@/lib/portal/upload";

export const dynamic = "force-dynamic";

/** Multipart upload of one file to a pursuit; the store logs `file_added`. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isBlobConfigured()) return setupResponse("BLOB_READ_WRITE_TOKEN is not configured");

  const { id } = await context.params;
  const pursuit = await getPursuit(id);
  if (!pursuit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  const title = form.get("title");

  try {
    const document = await storePortalDocument({
      file,
      scope: "pursuit",
      pursuitId: pursuit.id,
      uploadedBy: gate.userId,
      title: typeof title === "string" ? title : undefined,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
