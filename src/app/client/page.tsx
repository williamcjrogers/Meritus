import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientUploadDesk } from "@/components/client/ClientUploadDesk";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { Panel } from "@/components/portal/Panel";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { findActiveClientDomain } from "@/lib/db/client-domains";
import { listClientDocuments } from "@/lib/db/documents";
import { isClerkConfigured, isDatabaseConfigured, isStorageConfigured } from "@/lib/env";
import { shortDate } from "@/lib/portal/dates";
import { formatBytes } from "@/lib/portal/files";
import { resolveIdentity } from "@/lib/portal/roles";

export const dynamic = "force-dynamic";

function signOut() {
  return (
    <SignOutButton redirectUrl="/access">
      <button type="button" className="btn-quiet text-[12px]">Sign out</button>
    </SignOutButton>
  );
}

export default async function ClientDeskPage() {
  if (!isClerkConfigured() || !isDatabaseConfigured() || !isStorageConfigured()) return <SetupNotice />;

  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/access");
  const identity = await resolveIdentity(userId, sessionClaims);

  if (identity.role === "director") {
    return (
      <div className="max-w-xl">
        <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
        <h1 className="font-serif text-3xl text-green">This is the clients' desk</h1>
        <p className="mt-3 text-[14px] text-ink/70">
          Directors manage client domains and see what has arrived at{" "}
          <Link href="/portal/clients" className="text-green underline hover:text-brass">Clients</Link> on the pursuit desk.
        </p>
      </div>
    );
  }
  if (!identity.domain) redirect("/access/denied");

  const domain = await findActiveClientDomain(identity.domain);
  if (!domain) {
    return (
      <div className="max-w-xl">
        <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
        <h1 className="font-serif text-3xl text-green">Access for {identity.domain} has ended</h1>
        <p className="mt-3 text-[14px] text-ink/70">If you still need to send documents, contact Meritus at enquiries@meritusvia.com.</p>
        <div className="mt-6">{signOut()}</div>
      </div>
    );
  }

  const files = await listClientDocuments(domain.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow rule={false} className="mb-3">Upload desk</Eyebrow>
          <h1 className="font-serif text-3xl text-green">{domain.firm}</h1>
          <p className="mt-2 font-mono text-[11px] tracking-[0.12em] text-ink/70">
            {identity.email ?? identity.domain} · files go straight to Meritus
          </p>
        </div>
        {signOut()}
      </div>

      <Panel eyebrow="Send documents">
        <ClientUploadDesk />
      </Panel>

      <Panel eyebrow="What your firm has sent">
        {files.length === 0 ? (
          <p className="text-[14px] text-ink/70">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-green/10">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-4 py-3 text-[13px]">
                <span className="min-w-0 truncate text-green">{file.title}</span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                  {formatBytes(file.size)} · {shortDate(file.createdAt)}
                  {file.uploaderEmail ? ` · ${file.uploaderEmail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
