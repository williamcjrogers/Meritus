import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { getLead, listNotes, latestResearch, listDocuments, updateLead } from "@/lib/db/queries";
import { isLeadStatus } from "@/lib/portal/status";
import { normalizeWebsite } from "@/lib/research/urls";

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

  const [leadNotes, research, files] = await Promise.all([
    listNotes(id),
    latestResearch(id),
    listDocuments({ scope: "lead", leadId: id }),
  ]);

  return NextResponse.json({ lead, notes: leadNotes, research, documents: files });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const body = (await request.json()) as {
    companyName?: string;
    companyNumber?: string | null;
    website?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    source?: string | null;
    status?: string;
  };

  if (body.status && !isLeadStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const lead = await updateLead(id, {
    companyName: body.companyName,
    companyNumber: body.companyNumber,
    website: body.website !== undefined ? normalizeWebsite(body.website) : undefined,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    source: body.source,
    status: body.status && isLeadStatus(body.status) ? body.status : undefined,
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}
