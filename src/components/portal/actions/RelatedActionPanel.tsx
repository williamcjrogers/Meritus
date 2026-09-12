import Link from "next/link";
import { requireResearchDirector } from "@/lib/research/roles";
import { readRelatedActions } from "@/lib/db/desk-actions";
import { readDirectorDirectory } from "@/lib/portal/directors";
import { actionQueryHref } from "@/lib/actions/filters";
import type { WorkLink } from "@/lib/actions/types";
import { RelatedActions } from "./RelatedActions";

/** Keep a failed action read from hiding the related work itself. */
export async function RelatedActionPanel({ link }: { link: WorkLink }) {
  await requireResearchDirector();
  try {
    const [rows, directory] = await Promise.all([readRelatedActions(link), readDirectorDirectory()]);
    return <RelatedActions link={link} rows={rows} directory={directory} />;
  } catch {
    return <section className="action-register mt-8" aria-label="Related actions"><h2>Actions</h2><p role="status">Could not load actions for this record.</p><Link className="btn-quiet" href={actionQueryHref({ scope: "team", filter: "all", link, page: 1, pageSize: 50 })}>Open related actions</Link></section>;
  }
}
