"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean; variant?: "rail" | "bar" }) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} className="workspace-nav-link">{children}</Link>;
}
