import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { decideGate, isClientPath, isPortalPath, type GateDecision } from "@/lib/portal/gate";
import { resolveIdentity } from "@/lib/portal/roles";

function respond(decision: GateDecision, request: NextRequest) {
  if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));
  if (decision.kind === "json") return NextResponse.json(
    { error: decision.error, code: decision.status === 503 ? "IDENTITY_UNAVAILABLE" : decision.status === 403 ? "FORBIDDEN" : "UNAUTHENTICATED" },
    { status: decision.status, headers: { "Cache-Control": "no-store", ...(decision.status === 503 ? { "Retry-After": "5" } : {}) } },
  );
}
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  if (!isPortalPath(pathname) && !isClientPath(pathname)) return;
  let decision: GateDecision;
  try {
    const { userId, sessionClaims } = await auth();
    const role = userId ? (await resolveIdentity(userId, sessionClaims)).role : null;
    decision = decideGate({ pathname, search: req.nextUrl.search, signedIn: Boolean(userId), role });
  } catch {
    decision = decideGate({ pathname, search: req.nextUrl.search, signedIn: false, role: null, unavailable: true });
  }
  return respond(decision, req);
});
export default function middleware(request: NextRequest, event: unknown) {
  if (!isClerkConfigured()) return respond(decideGate({ pathname: request.nextUrl.pathname, search: request.nextUrl.search, signedIn: false, role: null, unavailable: true }), request) ?? NextResponse.next();
  return clerkHandler(request, event as never);
}
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
