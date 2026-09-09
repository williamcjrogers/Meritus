import { UNASSIGNED_INITIALS } from "@/lib/portal/director-helpers";

const SIZES = { sm: "h-6 w-6 text-[9px]", md: "h-7 w-7 text-[10px]", lg: "h-9 w-9 text-[12px]" } as const;

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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-mono tracking-[0.05em] ${SIZES[size]} ${
        unassigned ? "border border-dashed border-green/30 text-green/60" : "bg-green text-cream"
      } ${current ? "ring-1 ring-brass ring-offset-1 ring-offset-parchment" : ""} ${className}`}
    >
      {unassigned ? "·" : initials}
    </span>
  );
}
