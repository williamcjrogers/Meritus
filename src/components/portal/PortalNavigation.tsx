"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { PORTAL_NAV } from "@/lib/portal/navigation";
import { DirectorMenu } from "./DirectorMenu";
import { Eyebrow } from "./Eyebrow";
import { NavLink } from "./NavLink";

type PortalNavigationProps = {
  clerk?: boolean;
  director?: { name: string; initials: string } | null;
};

export function PortalNavigation({ clerk = false, director = null }: PortalNavigationProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const links = PORTAL_NAV.map((item) => (
    <NavLink key={item.href} href={item.href} exact={item.exact}>
      {item.label}
    </NavLink>
  ));

  return (
    <>
      <aside className="portal-rail fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-green text-cream lg:flex">
        <div className="border-b border-brass/15 px-3 pb-5 pt-7">
          <Link href="/portal" aria-label="Directors' workspace home" className="block">
            <HallmarkLogo size="header" variant="light" />
          </Link>
          <Eyebrow tone="brass" className="mt-3 px-1">Directors&apos; workspace</Eyebrow>
        </div>
        <nav className="flex-1 space-y-1 py-5" aria-label="Portal">{links}</nav>
        <div className="space-y-4 border-t border-brass/15 px-4 py-5">
          {clerk && <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} />}
          <Link href="/" className="inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light">Back to site</Link>
        </div>
      </aside>

      <header className="portal-rail sticky top-0 z-10 flex items-center justify-between gap-4 bg-green px-4 py-3 text-cream lg:hidden">
        <Link href="/portal" aria-label="Directors' workspace home" className="shrink-0">
          <HallmarkLogo size="favicon" variant="light" />
        </Link>
        <button ref={triggerRef} type="button" className="btn-quiet min-h-11 text-cream" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          Menu
        </button>
        {clerk ? <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} compact /> : <span />}
      </header>

      <dialog
        ref={dialogRef}
        aria-label="Navigation"
        className="portal-dialog m-0 h-full w-full max-w-none bg-green p-0 text-cream"
        onCancel={(event) => { event.preventDefault(); closeMenu(); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
          }
        }}
      >
        {open && (
          <div className="flex min-h-full flex-col px-5 py-5">
            <div className="flex items-center justify-between border-b border-brass/20 pb-5">
              <Eyebrow tone="brass" rule={false}>Navigation</Eyebrow>
              <button type="button" className="btn-quiet min-h-11 text-cream" onClick={closeMenu}>Close</button>
            </div>
            <nav className="flex-1 space-y-2 py-6" aria-label="Mobile portal" onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) closeMenu();
            }}>
              {links}
            </nav>
            <Link href="/" onClick={closeMenu} className="py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-brass">Back to site</Link>
          </div>
        )}
      </dialog>
    </>
  );
}
