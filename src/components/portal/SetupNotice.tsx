import { getSetupFlags } from "@/lib/env";
import { Eyebrow } from "./Eyebrow";

export function SetupNotice({ title = "Portal setup required" }: { title?: string }) {
  const flags = getSetupFlags();

  return (
    <div className="bg-parchment border border-green/10 p-8">
      <Eyebrow className="mb-3">Setup</Eyebrow>
      <h2 className="font-serif text-2xl text-green mb-3">{title}</h2>
      <p className="text-[14px] text-ink/70 leading-relaxed mb-6">
        The public site is unchanged. Marketplace services are still connecting. After
        Clerk is live, invite the three directors only; public sign-up stays off.
      </p>
      <ul className="space-y-2">
        {flags.map((flag) => (
          <li key={flag.key} className="flex items-center justify-between text-[13px]">
            <span className="text-green">{flag.key}</span>
            <span className={flag.ready ? "text-green/70" : "text-oxblood"}>
              {flag.ready ? "Ready" : flag.required ? "Required" : "Optional"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
