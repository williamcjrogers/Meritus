import { NextResponse, after } from "next/server";
import { issueAccessLink } from "@/lib/access/link";
import { sendAccessLink } from "@/lib/access/mail";
import { parseAccessRequest } from "@/lib/access/request";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { registerAccessAttempt } from "@/lib/db/throttle";
import { isResendConfigured } from "@/lib/env";
import { requireDatabaseOr503, setupResponse } from "@/lib/portal/auth";
import { destinationFor } from "@/lib/portal/destination";
import { firstHop, hashKey, isHoneypotFilled } from "@/lib/portal/intake";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The same body for listed and unlisted domains, so nobody can learn who Meritus's clients are. */
function generic() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (isHoneypotFilled(body)) return generic();

  const parsed = parseAccessRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const email = parsed.email;
  const requested = body && typeof body === "object" ? (body as Record<string, unknown>).returnTo : null;
  const returnTo = typeof requested === "string" ? destinationFor("client", requested) : undefined;

  const allowed = await registerAccessAttempt({
    email: hashKey("access-email", email),
    ip: hashKey("access-ip", firstHop(request.headers.get("x-forwarded-for"))),
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 });
  }
  if (!isResendConfigured()) return setupResponse("Email delivery is temporarily unavailable. Please try again shortly.");

  // The reply never waits for the lookup, so a listed and an unlisted domain answer in the same
  // time with the same body. The work runs after the response has gone.
  after(async () => {
    const domain = await findClientDomainForEmail(email);
    if (!domain) return;
    const issued = await issueAccessLink({ email, domain: domain.domain, ...(returnTo ? { returnTo } : {}) });
    if (!issued.ok) {
      if (issued.reason === "clerk_error") console.warn("Access: link not prepared", { domainId: domain.id });
      return;
    }
    const mail = await sendAccessLink({ to: email, url: issued.url });
    if ("error" in mail) {
      console.warn("Access: link not sent", { domainId: domain.id, error: mail.error.split(":")[0].slice(0, 60) });
    }
  });
  return generic();
}
