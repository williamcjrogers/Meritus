"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  exact = false,
  variant = "rail",
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  variant?: "rail" | "bar";
}) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "bar") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`px-1 py-2 text-[13px] ${active ? "border-b border-brass text-cream" : "text-cream/75 hover:text-cream"}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block border-l-2 px-4 py-2 text-[14px] transition-colors ${
        active ? "border-brass bg-white/5 text-cream" : "border-transparent text-cream/70 hover:bg-white/5 hover:text-cream"
      }`}
    >
      {children}
    </Link>
  );
}
