import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { getActorKind } from "@/lib/portal/directors";
import { allowPortalAccess } from "@/lib/portal/roles";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);
const isClientAuthRoute = createRouteMatcher(["/client/sign-in(.*)", "/client/sign-up(.*)"]);
const isClientAppRoute = createRouteMatcher(["/client(.*)", "/api/client(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPortalRoute(req)) {
    const { userId } = await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
    const kind = userId ? await getActorKind(userId) : null;
    if (!allowPortalAccess(kind)) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "This area is for directors only" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/client", req.url));
    }
    return;
  }

  if (isClientAppRoute(req) && !isClientAuthRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/client/sign-in", req.url).toString(),
    });
  }
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
