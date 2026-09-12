import { UNASSIGNED_INITIALS } from "@/lib/portal/director-helpers";

const SIZES = { sm: "h-6 w-6 text-[13px]", md: "h-7 w-7 text-[13px]", lg: "h-9 w-9 text-[13px]" } as const;

/** Initials in a green circle. A brass ring marks the signed-in director. */
export function OwnerAvatar({
  initials,
  name,
  size = "sm",
  current = false,
  className = "",
}: {
  initials: string;
  name?: string;
  size?: keyof typeof SIZES;
  current?: boolean;
  className?: string;
}) {
  const unassigned = !initials || initials === UNASSIGNED_INITIALS;
  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans  ${SIZES[size]} ${
        unassigned ? "border border-dashed border-primary/30 text-muted" : "bg-primary text-surface"
      } ${current ? "ring-1 ring-primary ring-offset-1 ring-offset-surface" : ""} ${className}`}
    >
      {unassigned ? "·" : initials}
    </span>
  );
}
