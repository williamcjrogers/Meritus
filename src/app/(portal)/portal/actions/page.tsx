import Link from "next/link";
import { z } from "zod";
import { ActionRegister } from "@/components/portal/actions/ActionRegister";
import { parseActionQuery } from "@/lib/actions/filters";
import { readActionView, readActionViews } from "@/lib/db/desk-actions";
import { readDirectorDirectory } from "@/lib/portal/directors";
import { requireResearchDirector } from "@/lib/research/roles";
export const dynamic = "force-dynamic";
export default async function ActionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actorId = await requireResearchDirector();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  const query = parseActionQuery(params);
  const now = new Date();
  const editId = z.uuid().safeParse(params.get("edit"));
  const [result, directory, initialAction] = await Promise.all([readActionViews(query, actorId, now).then(data => ({ ok: true as const, data })).catch(() => ({ ok: false as const })), readDirectorDirectory(), editId.success ? readActionView(editId.data).catch(() => null) : Promise.resolve(null)]);
  if (!result.ok) return <section className="action-register"><h1>Actions</h1><p role="alert">Could not load actions.</p><Link href={`/portal/actions?${params.toString()}`}>Retry</Link></section>;
  return <ActionRegister key={params.toString()} {...result.data} initialAction={initialAction} initialActionError={params.has("edit") && !initialAction ? "Could not open this action. It may be unavailable or you may not have access." : null} query={query} directory={directory} now={now.toISOString()} />;
}
