"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PORTAL_NAV } from "@/lib/portal/navigation";
import { DirectorMenu } from "./DirectorMenu";
import { NavLink } from "./NavLink";

const iconPaths: Record<string, string> = {
  Home: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7",
  Actions: "M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1",
  Pursuits: "M3 7h18v13H3V7Zm5 0V4h8v3M3 12h18M10 12v3h4v-3",
  Prospects: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  Research: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  Programmes: "M4 4v16h17M8 8h6M11 12h8M15 16h6",
  Library: "M4 3h5v18H4V3Zm5 0h5v18H9V3Zm8 0 5 1-3 17-5-1 3-17Z",
  "Client documents": "M14 2H4v20h16V8l-6-6ZM14 2v6h6M8 13h8M8 17h5",
};
function NavigationLinks() {
  return <>{[...new Set(PORTAL_NAV.map(item => item.group))].map(group => <div className="workspace-nav-group" key={group}><p className="workspace-nav-label">{group}</p>{PORTAL_NAV.filter(item => item.group === group).map(item => <NavLink key={item.href} href={item.href} exact={item.exact}><svg className="workspace-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[item.label]} /></svg>{item.label}</NavLink>)}</div>)}</>;
}
function Wordmark() { return <Link href="/portal" aria-label="Meritus workspace home" className="workspace-wordmark">Meritus<span>Via</span></Link>; }

export function PortalNavigation({ clerk = false, director = null }: { clerk?: boolean; director?: { name: string; initials: string } | null }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); if (!open && dialog.open) dialog.close(); }, [open]);
  function closeMenu() { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); }
  return <>
    <aside className="workspace-rail"><div><Wordmark /><p className="workspace-product-name">Workspace</p></div><nav className="workspace-nav" aria-label="Workspace"><NavigationLinks /></nav><div className="workspace-account">{clerk && <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} />}<Link href="/">Visit Meritus website</Link></div></aside>
    <header className="workspace-mobile-bar"><Wordmark /><button ref={triggerRef} type="button" className="app-button app-button--secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button></header>
    <dialog ref={dialogRef} aria-label="Navigation" className="portal-dialog m-0 h-full w-full" onCancel={event => { event.preventDefault(); closeMenu(); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); closeMenu(); } }}>
      {open && <div className="workspace-mobile-nav"><header><Wordmark /><button type="button" className="app-button app-button--ghost" onClick={closeMenu}>Close</button></header><nav className="workspace-nav" aria-label="Mobile workspace" onClick={event => { if ((event.target as HTMLElement).closest("a")) closeMenu(); }}><NavigationLinks /></nav><div className="workspace-account">{clerk && <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} />}<Link href="/">Visit Meritus website</Link></div></div>}
    </dialog>
  </>;
}
