import { currentUser } from "@clerk/nextjs/server";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { clerkPrimaryEmail } from "@/lib/client/invite";
import { stampClientRoleIfNeeded } from "@/lib/client/stamp";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { currentActorKind } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export default async function ClientDeskPage() {
  if (!isClerkConfigured() || !isDatabaseConfigured()) {
    return <SetupNotice title="Client desk is not configured yet" />;
  }

  const [user, kind] = await Promise.all([currentUser(), currentActorKind()]);
  if (user) {
    await stampClientRoleIfNeeded(user);
  }

  const email = clerkPrimaryEmail(user);
  let membership = null;
  try {
    membership = email ? await findClientDomainForEmail(email) : null;
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  const workspaceName = membership?.vericaseWorkspaceName?.trim() || null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Eyebrow rule={false}>Client</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl text-green sm:text-4xl">Your desk</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink/70">
          You are signed in
          {email ? (
            <>
              {" "}
              as <span className="text-green">{email}</span>
            </>
          ) : null}
          {kind === "client" ? " as a client of Meritus Via." : "."} This is not the pursuit
          desk.
        </p>
      </div>

      <section className="panel-brackets border border-green/10 bg-parchment p-6">
        <Eyebrow className="mb-3">Your matter</Eyebrow>
        {membership ? (
          <p className="text-[14px] leading-relaxed text-ink/70">
            Your company domain is{" "}
            <span className="text-green">@{membership.domain}</span>
            {workspaceName ? (
              <>
                . The linked VeriCase workspace is{" "}
                <span className="text-green">{workspaceName}</span>
                {membership.vericaseWorkspaceId
                  ? ` (${membership.vericaseWorkspaceId})`
                  : null}
                .
              </>
            ) : (
              "."
            )}
          </p>
        ) : (
          <p className="text-[14px] leading-relaxed text-ink/70">
            Your director has not yet attached a company domain to this login. Ask them to add
            it on the portal Clients page.
          </p>
        )}
        <p className="mt-4 text-[14px] leading-relaxed text-ink/70">
          Matter files remain in the VeriCase WR2.0 S3 archive. This login does not create a
          second file store, and it does not upload, download, or stream those objects from
          here.
        </p>
      </section>
    </div>
  );
}
