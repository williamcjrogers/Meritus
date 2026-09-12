export const metadata = { title: "Client documents" };
import { after } from "next/server";
import { ClientDomainForm } from "@/components/portal/ClientDomainForm";
import { ClientDomainList, type ClientFileSummary, type PursuitOption } from "@/components/portal/ClientDomainList";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/portal/Panel";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { sweepStaleUploads } from "@/lib/client-uploads/service";
import { listActiveClientDomains } from "@/lib/db/client-domains";
import { listClientDocuments } from "@/lib/db/documents";
import { listPursuitsForLinking } from "@/lib/db/pursuits";
import type { ClientDomain } from "@/lib/db/schema";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { stageLabel } from "@/lib/portal/stages";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) return <SetupNotice />;

  after(() => sweepStaleUploads().catch(() => 0));

  let domains: ClientDomain[] = [];
  let pursuits: PursuitOption[] = [];
  let files: Record<string, ClientFileSummary[]> = {};
  try {
    const [domainRows, pursuitRows] = await Promise.all([listActiveClientDomains(), listPursuitsForLinking()]);
    domains = domainRows;
    pursuits = pursuitRows.map((p) => ({ id: p.id, firm: p.firm, stage: stageLabel(p.stage) }));
    const lists = await Promise.all(domainRows.map((row) => listClientDocuments(row.id)));
    files = Object.fromEntries(
      domainRows.map((row, index) => [
        row.id,
        lists[index].map((doc) => ({ id: doc.id, title: doc.title, size: doc.size, createdAt: doc.createdAt, uploaderEmail: doc.uploaderEmail })),
      ])
    );
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Client documents" description="Manage organisation access and review submissions. Eligible colleagues share visibility of their organisation’s submissions. Link an organisation to a pursuit to keep the documents together." />
      <Panel title="Organisation access" className="max-w-xl">
        <ClientDomainForm pursuits={pursuits} />
      </Panel>
      <section>
        <Eyebrow className="mb-4">Organisations and submissions</Eyebrow>
        <ClientDomainList domains={domains} pursuits={pursuits} files={files} />
      </section>
    </div>
  );
}
