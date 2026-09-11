import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { clerkPrimaryEmail } from "./invite";

const CLIENTS_ONLY = "This area is for clients";

export type ClientDumpUser = {
  userId: string;
  email: string;
  domain: string;
};

export async function requireClientDumpUser(): Promise<
  { user: ClientDumpUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return {
      error: NextResponse.json({ error: "Clerk is not configured", code: "SETUP" }, { status: 503 }),
    };
  }
  if (!isDatabaseConfigured()) {
    return {
      error: NextResponse.json({ error: "DATABASE_URL is not configured", code: "SETUP" }, { status: 503 }),
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const signedIn = await currentUser();
  const email = clerkPrimaryEmail(signedIn);
  const match = await findClientDomainForEmail(email);
  if (!match) {
    return { error: NextResponse.json({ error: CLIENTS_ONLY }, { status: 403 }) };
  }

  return { user: { userId, email, domain: match.domain } };
}
