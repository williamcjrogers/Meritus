import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { decideGate, isClientPath, isPortalPath } from "@/lib/portal/gate";
import { resolveIdentity } from "@/lib/portal/roles";

/**
 * /portal and /api/portal are for directors; /client and /api/client for clients (directors may
 * look). Every page and route checks the role again in its own guard; this is the outer wall.
 *
 * origin/main's QCS research work added its own director gate for the same /portal and
 * /api/portal paths (readResearchActor + auth.protect() in @/lib/research/roles), but every
 * research API route already calls requireResearchDirector() itself via researchApi(), so
 * dropping that middleware-level check here loses no protection: the route layer still enforces
 * it, and this gate already covers /portal, /api/portal, /client and /api/client with the same
 * director/client role split.
 */
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  if (!isPortalPath(pathname) && !isClientPath(pathname)) return;

  const { userId, sessionClaims } = await auth();
  const role = userId ? (await resolveIdentity(userId, sessionClaims)).role : null;
  const decision = decideGate({ pathname, signedIn: Boolean(userId), role });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }
  if (decision.kind === "json") {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }
  return;
});

export default function middleware(request: NextRequest, event: unknown) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  return clerkHandler(request, event as never);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
