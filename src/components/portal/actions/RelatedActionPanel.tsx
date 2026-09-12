import Link from "next/link";
import { requireWorkspacePage } from "@/lib/portal/auth";
import { recoverPageAccessError } from "@/lib/portal/page-access";
import { readRelatedActions } from "@/lib/db/desk-actions";
import { readDirectorDirectory } from "@/lib/portal/directors";
import { actionQueryHref } from "@/lib/actions/filters";
import type { WorkLink } from "@/lib/actions/types";
import { RelatedActions } from "./RelatedActions";

/** Keep a failed action read from hiding the related work itself. */
export async function RelatedActionPanel({ link }: { link: WorkLink }) {
  await requireWorkspacePage();
  try {
    const [rows, directory] = await Promise.all([readRelatedActions(link), readDirectorDirectory()]);
    return <RelatedActions link={link} rows={rows} directory={directory} />;
  } catch (error) {
    await recoverPageAccessError(error);
    return <section className="action-register mt-8" aria-label="Related actions"><h2>Actions</h2><p role="status">Could not load actions for this record.</p><Link className="app-button app-button--ghost" href={actionQueryHref({ scope: "team", filter: "all", link, page: 1, pageSize: 50 })}>Open related actions</Link></section>;
  }
}
