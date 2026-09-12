import { NextResponse } from "next/server";
import { abortUpload, describeUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  const { id } = await context.params;
  const result = await describeUpload(gate.identity, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, context: Context) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  const { id } = await context.params;
  const result = await abortUpload(gate.identity, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
