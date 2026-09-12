import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, context, id }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; context?: ReactNode; id?: string }) {
  return <header className="app-page-header"><div>{context && <div className="app-context mb-2">{context}</div>}<h1 id={id}>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="app-page-actions">{actions}</div>}</header>;
}
