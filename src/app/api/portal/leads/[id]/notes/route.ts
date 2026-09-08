import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { addNote, getLead, listNotes } from "@/lib/db/queries";

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
  return NextResponse.json({ notes: await listNotes(id) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { body?: string };
  const text = body.body?.trim();
  if (!text) return NextResponse.json({ error: "Note body is required" }, { status: 400 });

  const note = await addNote({
    leadId: id,
    authorId: gate.userId,
    body: text,
    source: "human",
  });
  return NextResponse.json({ note }, { status: 201 });
}
