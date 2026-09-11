import { Eyebrow } from "@/components/portal/Eyebrow";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { requireClientUser } from "@/lib/client/auth";
import { clerkPrimaryEmail } from "@/lib/client/invite";
import { stampClientRoleIfNeeded } from "@/lib/client/stamp";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { attachClerkUserToMatters, listMattersForClient } from "@/lib/db/client-matters";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientDeskPage() {
  if (!isClerkConfigured() || !isDatabaseConfigured()) {
    return <SetupNotice title="Client desk is not configured yet" />;
  }

  const user = await requireClientUser();
  await stampClientRoleIfNeeded(user);
  const email = clerkPrimaryEmail(user);
  if (email) {
    try {
      await attachClerkUserToMatters(email, user.id);
    } catch {
      // Grant bind is best-effort; the desk still lists by email.
    }
  }

  let matters;
  let domain;
  try {
    matters = email ? await listMattersForClient({ email, clerkUserId: user.id }) : [];
    domain = email ? await findClientDomainForEmail(email) : null;
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <Eyebrow rule={false}>Your matters</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Shared with you</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          A director named these VeriCase WR2.0 workspaces for your login. Matter files stay in
          that tenant’s S3. This desk does not download files, mint signed URLs, or show object
          keys.
        </p>
        {domain ? (
          <p className="mt-2 text-[13px] text-ink/70">
            Recognised client domain: <span className="font-medium text-green">{domain.domain}</span>
            {domain.vericaseWorkspaceName ? ` · ${domain.vericaseWorkspaceName}` : ""}
          </p>
        ) : null}
      </header>

      {matters.length === 0 ? (
        <div className="panel-brackets border border-green/10 bg-parchment px-6 py-10">
          <p className="font-serif text-2xl text-green">No matters shared yet</p>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink/70">
            When counsel invites you, the named workspace will appear here. Files remain in
            VeriCase S3 — this site is not a second archive.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-green/10 border border-green/10 bg-parchment">
          {matters.map((matter) => (
            <li key={matter.id} className="px-4 py-4">
              <p className="font-serif text-xl text-green">
                {matter.vericaseWorkspaceName || "Named workspace"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink/55">
                Workspace {matter.vericaseWorkspaceId}
              </p>
              <p className="mt-2 text-[13px] text-ink/70">
                Files remain in VeriCase WR2.0 S3. Ask your solicitor if you need a document from
                the file.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
