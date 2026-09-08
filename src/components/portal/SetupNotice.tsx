import { getSetupFlags } from "@/lib/env";

export function SetupNotice({ title = "Portal setup required" }: { title?: string }) {
  const flags = getSetupFlags();

  return (
    <div className="bg-parchment border border-green/10 p-8">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-3">Setup</p>
      <h2 className="font-serif text-2xl text-green mb-3">{title}</h2>
      <p className="text-[14px] text-slate leading-relaxed mb-6">
        The public site is unchanged. Provision the missing environment variables, run the
        database migration, and invite partners in Clerk. Sign-up stays off — invite only.
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
