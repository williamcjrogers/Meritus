import { currentUser } from "@clerk/nextjs/server";
import { DumpZone } from "@/components/client/DumpZone";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { stampClientRoleIfNeeded } from "@/lib/client/stamp";
import { summariseClientFile } from "@/lib/client/files";
import { clerkPrimaryEmail } from "@/lib/client/invite";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { listReadyClientFiles } from "@/lib/db/client-files";
import { isClerkConfigured, isDatabaseConfigured, isVericaseStorageConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientDeskPage() {
  if (!isClerkConfigured() || !isDatabaseConfigured()) {
    return (
      <div className="max-w-xl border border-green/10 bg-parchment p-8">
        <Eyebrow className="mb-3">Client desk</Eyebrow>
        <h1 className="mb-3 font-serif text-2xl text-green">Not available yet</h1>
        <p className="text-[14px] leading-relaxed text-ink/70">
          Client login needs Clerk and the database. Files go to the VeriCase WR2.0 archive.
        </p>
      </div>
    );
  }

  const user = await currentUser();
  if (user) {
    await stampClientRoleIfNeeded(user);
  }
  const email = clerkPrimaryEmail(user);

  let match = null;
  try {
    match = await findClientDomainForEmail(email);
  } catch {
    return (
      <div className="max-w-xl border border-green/10 bg-parchment p-8">
        <Eyebrow className="mb-3">Client desk</Eyebrow>
        <h1 className="mb-3 font-serif text-2xl text-green">Database is configured but not migrated</h1>
        <p className="text-[14px] leading-relaxed text-ink/70">
          The client desk stores dumps in the VeriCase WR2.0 archive once the database is migrated.
        </p>
      </div>
    );
  }

  const label = match?.domain ? `@${match.domain}` : null;
  const workspace = match?.vericaseWorkspaceName?.trim() || null;
  const storageReady = isVericaseStorageConfigured();

  let files: ReturnType<typeof summariseClientFile>[] = [];
  if (match) {
    try {
      files = (await listReadyClientFiles(match.domain)).map(summariseClientFile);
    } catch {
      files = [];
    }
  }

  return (
    <div className="max-w-3xl">
      <Eyebrow rule={false}>Client desk</Eyebrow>
      <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">
        {workspace || label || "Your files"}
      </h1>
      {label ? (
        <p className="mt-2 font-mono text-[12px] tracking-[0.08em] text-ink/70">{label}</p>
      ) : null}
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink/70">
        Dump files here. They are stored in the VeriCase WR2.0 archive, not on this site.
        {match ? " Anyone at this company domain who signs in can see this drop box." : ""}
      </p>

      {match ? (
        <div className="mt-8">
          <DumpZone files={files} storageReady={storageReady} />
        </div>
      ) : (
        <div className="panel-brackets mt-8 border border-green/10 bg-parchment px-6 py-10 text-center">
          <p className="font-serif text-2xl text-green">No company domain is linked to this login yet.</p>
          <p className="mt-2 text-[14px] text-ink/70">
            A director adds the company domain on the pursuit desk. After that you can dump files here.
          </p>
        </div>
      )}
    </div>
  );
}
