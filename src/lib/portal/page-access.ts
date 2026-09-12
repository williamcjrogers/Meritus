import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ResearchAccessError } from "@/lib/research/roles";
import { unavailableDestination } from "./destination";
import { PAGE_PATH_HEADER, requestedPagePath } from "./request-path";

/** Translate only typed access errors at a page or independently rendered async-child boundary. */
export async function recoverPageAccessError(error: unknown, fallback = "/portal"): Promise<void> {
  if (!(error instanceof ResearchAccessError)) return;
  const requested = requestedPagePath(fallback, (await headers()).get(PAGE_PATH_HEADER));
  if (error.status === 503) redirect(unavailableDestination(requested));
  if (error.status === 401) {
    const entry = requested.startsWith("/client") ? "/access" : "/sign-in";
    redirect(`${entry}?returnTo=${encodeURIComponent(requested)}`);
  }
  if (error.status === 403) redirect("/access/denied");
}

/** Backend readers retain their typed errors for APIs and workers; routing belongs here only. */
export async function withPageAccessRecovery<T>(read: () => Promise<T>, fallback = "/portal"): Promise<T> {
  try {
    return await read();
  } catch (error) {
    await recoverPageAccessError(error, fallback);
    throw error;
  }
}
