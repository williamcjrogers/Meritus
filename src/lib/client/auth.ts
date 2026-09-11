import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/env";

/** Signed-in Clerk user for /client. Middleware already gates the route. */
export async function requireClientUser() {
  if (!isClerkConfigured()) {
    redirect("/client/sign-in");
  }
  const user = await currentUser();
  if (!user) {
    redirect("/client/sign-in");
  }
  return user;
}
