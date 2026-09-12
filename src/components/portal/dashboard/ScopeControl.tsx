"use client";

import { useRouter } from "next/navigation";

export function ScopeControl({ scope }: { scope: "team" | "mine" }) {
  const router = useRouter();
  function choose(value: "team" | "mine") {
    document.cookie = `home_scope=${value}; Path=/portal; Max-Age=31536000; SameSite=Lax`;
    router.push(`/portal?scope=${value}`);
  }
  return <div className="home-scope" role="group" aria-label="Dashboard scope">
    <button type="button" aria-pressed={scope === "team"} onClick={() => choose("team")}>Team</button>
    <button type="button" aria-pressed={scope === "mine"} onClick={() => choose("mine")}>My work</button>
  </div>;
}
