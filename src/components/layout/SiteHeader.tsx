import { currentActorKind } from "@/lib/portal/auth";
import { Header } from "./Header";

export async function SiteHeader() {
  const actorKind = await currentActorKind();
  return <Header actorKind={actorKind} />;
}
