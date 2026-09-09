import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/** Parchment panel with the marketing corner brackets. Server-safe. */
export function Panel({
  eyebrow,
  title,
  actions,
  children,
  className = "",
  padding = "p-6",
  id,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel-brackets bg-parchment border border-green/10 ${padding} ${className}`}>
      {(eyebrow || title || actions) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <Eyebrow rule={false}>{eyebrow}</Eyebrow>}
            {title && <h2 className="mt-1 font-serif text-2xl leading-tight text-green">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
