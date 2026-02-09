interface HallmarkLogoProps {
  size?: "favicon" | "header" | "standalone";
  variant?: "light" | "dark";
  showDescriptor?: boolean;
  className?: string;
}

/**
 * The Meritus Hallmark Identity System.
 *
 * A compact geometric stamp (abstracted building plan / balance scale
 * inside a rounded shield) sits left of the MERITUS wordmark.
 * "ADVISORY" descriptor sits below for the full lockup.
 *
 * Sizes:
 *  - favicon: 24px  (stamp only, no text)
 *  - header:  40px  (stamp + wordmark, inline)
 *  - standalone: 120px (stamp + wordmark + descriptor, stacked)
 *
 * Variants:
 *  - light: brass stamp, cream text  (for green backgrounds)
 *  - dark:  brass stamp, green text  (for cream/parchment backgrounds)
 */
export function HallmarkLogo({
  size = "header",
  variant = "light",
  showDescriptor = false,
  className = "",
}: HallmarkLogoProps) {
  const brass = "#B5975A";
  const textColor = variant === "light" ? "#F5F0E8" : "#0B3B24";
  const stampBg = variant === "light" ? "rgba(181,151,90,0.15)" : "rgba(11,59,36,0.08)";

  // Favicon: stamp only
  if (size === "favicon") {
    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Meritus"
        role="img"
      >
        <rect x="2" y="2" width="36" height="36" rx="4" fill={stampBg} stroke={brass} strokeWidth="1.5" />
        {/* Abstracted building plan / keystone */}
        <path d="M20 10 L28 16 L28 28 L12 28 L12 16 Z" stroke={brass} strokeWidth="1.2" fill="none" />
        <line x1="20" y1="10" x2="20" y2="28" stroke={brass} strokeWidth="0.8" />
        <line x1="12" y1="22" x2="28" y2="22" stroke={brass} strokeWidth="0.8" />
        {/* Keystone accent */}
        <path d="M17 16 L20 12 L23 16" stroke={brass} strokeWidth="1" fill="none" />
      </svg>
    );
  }

  // Header: stamp + wordmark inline
  if (size === "header") {
    return (
      <div className={`flex items-center gap-3 ${className}`} aria-label="Meritus Advisory">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 shrink-0"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="30" height="30" rx="3" fill={stampBg} stroke={brass} strokeWidth="1.2" />
          <path d="M16 7 L23 12 L23 24 L9 24 L9 12 Z" stroke={brass} strokeWidth="1" fill="none" />
          <line x1="16" y1="7" x2="16" y2="24" stroke={brass} strokeWidth="0.6" />
          <line x1="9" y1="18" x2="23" y2="18" stroke={brass} strokeWidth="0.6" />
          <path d="M13 12 L16 8.5 L19 12" stroke={brass} strokeWidth="0.8" fill="none" />
        </svg>
        <div className="flex flex-col leading-none">
          <span
            className="font-serif text-[17px] font-semibold tracking-[0.18em]"
            style={{ color: textColor, fontVariantCaps: "all-small-caps" }}
          >
            Meritus
          </span>
        </div>
      </div>
    );
  }

  // Standalone: stamp + wordmark + descriptor, stacked
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} aria-label="Meritus Advisory">
      <svg
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-20 h-20"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="72" height="72" rx="6" fill={stampBg} stroke={brass} strokeWidth="2" />
        <path d="M40 18 L56 28 L56 58 L24 58 L24 28 Z" stroke={brass} strokeWidth="1.5" fill="none" />
        <line x1="40" y1="18" x2="40" y2="58" stroke={brass} strokeWidth="1" />
        <line x1="24" y1="43" x2="56" y2="43" stroke={brass} strokeWidth="1" />
        <path d="M32 28 L40 20 L48 28" stroke={brass} strokeWidth="1.2" fill="none" />
        {/* Corner details */}
        <circle cx="24" cy="28" r="1.5" fill={brass} opacity="0.4" />
        <circle cx="56" cy="28" r="1.5" fill={brass} opacity="0.4" />
        <circle cx="24" cy="58" r="1.5" fill={brass} opacity="0.4" />
        <circle cx="56" cy="58" r="1.5" fill={brass} opacity="0.4" />
      </svg>
      <div className="flex flex-col items-center leading-none">
        <span
          className="font-serif text-2xl font-semibold tracking-[0.22em]"
          style={{ color: textColor, fontVariantCaps: "all-small-caps" }}
        >
          Meritus
        </span>
        {showDescriptor && (
          <span
            className="font-sans text-[10px] tracking-[0.35em] uppercase mt-1.5"
            style={{ color: brass }}
          >
            Advisory
          </span>
        )}
      </div>
    </div>
  );
}
