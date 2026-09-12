import type { ReactNode } from "react";

export function Status({ children, tone = "info", className = "" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "error"; className?: string }) {
  return <div className={`app-status app-status--${tone} ${className}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
