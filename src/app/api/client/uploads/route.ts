import { NextResponse } from "next/server";
import { parseCreateInput } from "@/lib/client-uploads/rules";
import { createUpload } from "@/lib/client-uploads/service";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const parsed = parseCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createUpload(gate.identity, parsed.input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
