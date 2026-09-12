import { NextResponse } from "next/server";
import { completeUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClientUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).parts : null;
  if (!Array.isArray(raw)) return NextResponse.json({ error: "Expected parts" }, { status: 400 });
  const parts = raw
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({ partNumber: Number(entry.partNumber), etag: typeof entry.etag === "string" ? entry.etag : "" }));

  const { id } = await context.params;
  const result = await completeUpload(gate.identity, id, parts);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
