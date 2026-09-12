import Link from "next/link";
import { Status } from "@/components/ui/Status";

/** Ordinary recovery copy. Technical configuration remains in deployment logs. */
export function SetupNotice({ title }: { title?: string }) {
  void title;
  return <section className="app-panel max-w-xl p-8"><h1 className="text-3xl">Workspace temporarily unavailable</h1><div className="my-6"><Status tone="warning">We could not load this workspace. Please try again in a moment.</Status></div><Link className="app-button app-button--secondary" href="/portal">Return to Home</Link></section>;
}
