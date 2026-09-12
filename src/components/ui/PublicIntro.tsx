import type { ReactNode } from "react";

export function PublicIntro({
  title,
  description,
  children,
  label,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  label?: string;
}) {
  return (
    <header className="public-page-intro">
      <div className="public-container">
        {label && <p className="public-page-label">{label}</p>}
        <h1>{title}</h1>
        {description && <p className="public-lead">{description}</p>}
        {children}
      </div>
    </header>
  );
}
