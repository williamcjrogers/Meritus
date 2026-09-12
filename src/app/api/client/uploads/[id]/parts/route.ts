import { NextResponse } from "next/server";
import { MAX_SIGN_BATCH } from "@/lib/client-uploads/rules";
import { signParts } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

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
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).partNumbers : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SIGN_BATCH || !raw.every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: `Ask for between 1 and ${MAX_SIGN_BATCH} parts` }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await signParts(gate.identity, id, raw as number[]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
