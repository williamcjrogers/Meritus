import { ClientDomainForm } from "@/components/portal/ClientDomainForm";
import { ClientDomainList } from "@/components/portal/ClientDomainList";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { listClientDomains } from "@/lib/db/client-domains";
import type { ClientDomain } from "@/lib/db/schema";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let domains: ClientDomain[];
  try {
    domains = await listClientDomains();
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Eyebrow rule={false}>Client login</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Clients</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          Company domains are the membership list. Anyone who signs in with{" "}
          <span className="whitespace-nowrap">@bree.co.uk</span> (or another listed host) lands on
          /client and cannot open the pursuit desk. Matter files stay in VeriCase WR2.0 S3 —
          this page does not create a second archive or stream objects here.
        </p>
      </div>

      <p className="max-w-2xl text-[13px] leading-relaxed text-ink/70">
        Clerk stays invite-only. Adding a domain tries a Clerk allowlist identifier for that
        host. First-time users still need a Clerk invite or an allowlist until that is enabled.
        Partner invite-only is unchanged. Invitation redirect stays{" "}
        <span className="text-green">https://www.meritusvia.com/client/sign-up</span>.
      </p>

      <section className="panel-brackets max-w-xl border border-green/10 bg-parchment p-6">
        <Eyebrow className="mb-4">Add a domain</Eyebrow>
        <ClientDomainForm />
      </section>

      <section>
        <Eyebrow className="mb-4">Listed domains</Eyebrow>
        <ClientDomainList domains={domains} />
      </section>
    </div>
  );
}
