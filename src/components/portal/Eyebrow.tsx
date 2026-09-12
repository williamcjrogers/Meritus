import type { ReactNode } from "react";

/** Context labels carry useful provenance, without decorative rules or uppercase type. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; tone?: "green" | "brass"; rule?: boolean; className?: string }) {
  return <p className={`app-context ${className}`}>{children}</p>;
}
