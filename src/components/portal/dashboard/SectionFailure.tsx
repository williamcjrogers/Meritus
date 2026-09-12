"use client";

import { useRouter } from "next/navigation";

export function SectionFailure({ error }: { error: string }) {
  const router = useRouter();
  return <div className="home-failure" role="status"><p>{error}</p><button type="button" onClick={() => router.refresh()}>Retry</button></div>;
}
