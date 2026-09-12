import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";
import { readResearchActor } from "@/lib/research/roles";

const isProtectedRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth.protect();
    try {
      const actor = await readResearchActor(userId);
      if (actor.role === "director") return;
      if (actor.role === "client" && !req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/client", req.url));
      }
      return NextResponse.json({ error: "Director access required" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Identity service unavailable" }, { status: 503 });
    }
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
