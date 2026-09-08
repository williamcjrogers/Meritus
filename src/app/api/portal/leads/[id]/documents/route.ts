import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { getLead, listDocuments } from "@/lib/db/queries";
import { storePortalDocument } from "@/lib/portal/upload";
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

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ documents: await listDocuments({ scope: "lead", leadId: id }) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isBlobConfigured()) return setupResponse("BLOB_READ_WRITE_TOKEN is not configured");

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  try {
    const document = await storePortalDocument({
      file,
      scope: "lead",
      leadId: id,
      uploadedBy: gate.userId,
      title: String(form.get("title") ?? ""),
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
