import { ClientDomainForm } from "@/components/portal/ClientDomainForm";
import { ClientDomainList } from "@/components/portal/ClientDomainList";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { InviteClientForm } from "@/components/portal/InviteClientForm";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { listClientDomains } from "@/lib/db/client-domains";
import { listClientMatters } from "@/lib/db/client-matters";
import type { ClientDomain, ClientMatter } from "@/lib/db/schema";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let domains: ClientDomain[];
  let matters: ClientMatter[];
  try {
    [domains, matters] = await Promise.all([listClientDomains(), listClientMatters()]);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Eyebrow rule={false}>Client login</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Clients</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          Invite a client by email and name the VeriCase WR2.0 workspace they may see. Files stay
          in that tenant’s S3 — this desk does not upload, download, or mint signed URLs. Clients
          never reach the pursuit desk.
        </p>
      </div>

      <section className="panel-brackets max-w-xl border border-green/10 bg-parchment p-6">
        <Eyebrow className="mb-4">Invite a client</Eyebrow>
        <InviteClientForm />
      </section>

      <section>
        <Eyebrow className="mb-4">Granted matters</Eyebrow>
        {matters.length === 0 ? (
          <p className="text-[14px] text-ink/70">No client matters granted yet.</p>
        ) : (
          <ul className="divide-y divide-green/10 border border-green/10 bg-parchment">
            {matters.map((matter) => (
              <li key={matter.id} className="px-4 py-3 text-[13px]">
                <p className="font-medium text-green">
                  {matter.vericaseWorkspaceName || "Unnamed workspace"}
                </p>
                <p className="text-ink/70">
                  {matter.email}
                  {matter.clerkUserId ? " · signed in" : " · invitation pending"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink/55">
                  Workspace {matter.vericaseWorkspaceId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-brackets max-w-xl border border-green/10 bg-parchment p-6">
        <Eyebrow className="mb-4">Company domains</Eyebrow>
        <p className="mb-4 text-[13px] leading-relaxed text-ink/70">
          Optional allowlist so a company mailbox is never treated as a director. Workspace
          id/name here is a label only — not a dump of every WR2.0 workspace.
        </p>
        <ClientDomainForm />
      </section>

      <section>
        <Eyebrow className="mb-4">Listed domains</Eyebrow>
        <ClientDomainList domains={domains} />
      </section>
    </div>
  );
}
