import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { createLead, listLeads } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const rows = await listLeads();
  return NextResponse.json({ leads: rows });
}

export async function POST(request: Request) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const body = (await request.json()) as {
    companyName?: string;
    companyNumber?: string;
    contactName?: string;
    contactEmail?: string;
    source?: string;
  };

  const companyName = body.companyName?.trim();
  if (!companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const lead = await createLead({
    id: crypto.randomUUID(),
    companyName,
    companyNumber: body.companyNumber?.trim() || null,
    contactName: body.contactName?.trim() || null,
    contactEmail: body.contactEmail?.trim() || null,
    source: body.source?.trim() || null,
    status: "new",
    createdBy: gate.userId,
  });

  return NextResponse.json({ lead }, { status: 201 });
}
