import { getSetupFlags } from "@/lib/env";
import { Eyebrow } from "./Eyebrow";

export function SetupNotice({ title = "Portal setup required" }: { title?: string }) {
  const flags = getSetupFlags();

  return (
    <div className="max-w-xl border border-green/10 bg-parchment p-8">
      <Eyebrow className="mb-3">Setup</Eyebrow>
      <h2 className="mb-3 font-serif text-2xl text-green">{title}</h2>
      <p className="mb-6 text-[14px] leading-relaxed text-ink/70">
        The public site is unchanged. Marketplace services are still connecting. After
        Clerk is live, invite the three directors only; public sign-up stays off.
      </p>
      <ul className="space-y-3">
        {flags.map((flag) => (
          <li
            key={flag.key}
            className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <span className="text-[13px] leading-5 text-green break-words">{flag.key}</span>
            <span
              className={`shrink-0 text-[13px] leading-5 ${
                flag.ready ? "text-green/70" : "text-oxblood"
              }`}
            >
              {flag.ready ? "Ready" : flag.required ? "Required" : "Optional"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
