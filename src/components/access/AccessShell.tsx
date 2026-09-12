import Link from "next/link";
import type { ReactNode } from "react";

export function AccessShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main id="main-content" className="access-shell">
      <Link href="/" className="access-brand" aria-label="Meritus Via home">Meritus Via</Link>
      <section className="access-content" aria-labelledby="access-title">
        <h1 id="access-title" className="access-title">{title}</h1>
        {description ? <p className="access-intro">{description}</p> : null}
        {children}
      </section>
    </main>
  );
}
