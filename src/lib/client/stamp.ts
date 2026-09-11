import { clerkClient, type User } from "@clerk/nextjs/server";
import { listClientDomainHosts } from "@/lib/db/client-domains";
import { __resetDirectorsCache } from "@/lib/portal/directors";
import { actorKindFromSignals, isClientRole } from "@/lib/portal/roles";
import { clerkPrimaryEmail } from "./invite";

/** Stamp Clerk so the public header shows Client desk after the first visit. */
export async function stampClientRoleIfNeeded(user: User): Promise<void> {
  if (isClientRole(user.publicMetadata?.role)) return;
  const email = clerkPrimaryEmail(user);
  const clientDomains = await listClientDomainHosts();
  if (actorKindFromSignals({ role: user.publicMetadata?.role, email, clientDomains }) !== "client") {
    return;
  }
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, { publicMetadata: { role: "client" } });
    __resetDirectorsCache();
  } catch (error) {
    console.warn("[client] could not stamp client role", error);
  }
}