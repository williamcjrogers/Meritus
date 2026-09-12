/** Workspace navigation. URLs remain stable for bookmarks and existing links. */
export const PORTAL_NAV = [
  { href: "/portal", label: "Home", exact: true, group: "Work" },
  { href: "/portal/actions", label: "Actions", exact: false, group: "Work" },
  { href: "/portal/pursuits", label: "Pursuits", exact: false, group: "Commercial" },
  { href: "/portal/prospects", label: "Prospects", exact: false, group: "Commercial" },
  { href: "/portal/research", label: "Research", exact: false, group: "Work" },
  { href: "/portal/programmes", label: "Programmes", exact: false, group: "Resources" },
  { href: "/portal/library", label: "Library", exact: false, group: "Resources" },
  { href: "/portal/clients", label: "Client documents", exact: false, group: "Resources" },
] as const;
