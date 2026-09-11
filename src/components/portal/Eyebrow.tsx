import type { ReactNode } from "react";

/**
 * A meaningful label in the Meritus mono style. Green with a brass hairline on
 * light surfaces; brass (no rule) on the green sidebar.
 */
export function Eyebrow({
  children,
  tone = "green",
  rule = true,
  className = "",
}: {
  children: ReactNode;
  tone?: "green" | "brass";
  rule?: boolean;
  className?: string;
}) {
  if (tone === "brass") {
    return (
      <p className={`font-mono text-[10px] leading-5 tracking-[0.12em] uppercase text-brass/80 ${className}`}>
        {children}
      </p>
    );
  }
  return (
    <div className={className}>
      <p className="portal-eyebrow">{children}</p>
      {rule && <div className="mt-2 h-px bg-brass/15" aria-hidden="true" />}
    </div>
  );
}
