import { NextResponse } from "next/server";
import { requireClientDumpUser } from "@/lib/client/auth";
import { summariseClientFile } from "@/lib/client/files";
import { listReadyClientFiles } from "@/lib/db/client-files";
import { requireDatabaseOr503 } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireClientDumpUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const files = await listReadyClientFiles(gate.user.domain);
  return NextResponse.json({ files: files.map(summariseClientFile) });
}
