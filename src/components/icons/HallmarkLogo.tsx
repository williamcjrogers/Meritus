interface HallmarkLogoProps {
  size?: "favicon" | "header" | "standalone";
  variant?: "light" | "dark";
  showDescriptor?: boolean;
  className?: string;
}

/**
 * Meritus Hallmark,an architectural M monogram.
 *
 * The M is drawn as structure: heavy vertical strokes (columns),
 * a sharp apex (keystone/pediment), weighted serif bases (foundations),
 * and a datum line (ground line). Framed in a thin rectangle
 * like a detail reference on a structural drawing.
 *
 * Every path is hand-drawn SVG,no font rendering, identical on every OS.
 */
export function HallmarkLogo({
  size = "header",
  variant = "light",
  showDescriptor = false,
  className = "",
}: HallmarkLogoProps) {
  const brass = "#B5975A";
  const textColor = variant === "light" ? "#F5F0E8" : "#0B3B24";
  const borderColor = variant === "light" ? "rgba(181,151,90,0.35)" : "rgba(11,59,36,0.2)";
  const markColor = variant === "light" ? "#B5975A" : "#0B3B24";
  const datumColor = variant === "light" ? "rgba(181,151,90,0.2)" : "rgba(11,59,36,0.12)";

  /**
   * The architectural M,drawn on a 100x100 viewBox.
   *
   * Structure:
   *  - Two outer verticals (columns): x=25 and x=75, from y=28 to y=74
   *  - Inner V meeting at apex: y=32 (keystone peak)
   *  - Weighted serifs at top and base of each column
   *  - Datum/ground line across the base
   */
  const ArchitecturalM = ({ s, strokeScale = 1 }: { s: number; strokeScale?: number }) => {
    const sw = (v: number) => v * strokeScale;

    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={s}
        height={s}
        className="shrink-0"
        aria-hidden="true"
      >
        {/* ── Border: thin rectangle, slight radius ── */}
        <rect
          x="4" y="4" width="92" height="92" rx="3"
          stroke={borderColor}
          strokeWidth={sw(1)}
        />

        {/* ── Datum / ground line ── */}
        <line x1="18" y1="76" x2="82" y2="76" stroke={datumColor} strokeWidth={sw(0.75)} />

        {/* ── Left column ── */}
        <line x1="28" y1="28" x2="28" y2="74" stroke={markColor} strokeWidth={sw(3)} strokeLinecap="square" />

        {/* ── Right column ── */}
        <line x1="72" y1="28" x2="72" y2="74" stroke={markColor} strokeWidth={sw(3)} strokeLinecap="square" />

        {/* ── Left diagonal down to valley ── */}
        <line x1="28" y1="28" x2="50" y2="52" stroke={markColor} strokeWidth={sw(2)} strokeLinecap="square" />

        {/* ── Right diagonal down to valley ── */}
        <line x1="72" y1="28" x2="50" y2="52" stroke={markColor} strokeWidth={sw(2)} strokeLinecap="square" />

        {/* ── Apex / keystone accent ── */}
        {/* Small chevron at the top centre where the diagonals originate */}
        <path d="M28 28 L50 52 L72 28" stroke={markColor} strokeWidth={sw(2)} fill="none" strokeLinejoin="miter" />

        {/* ── Top serifs (entablature) ── */}
        {/* Left column top */}
        <line x1="22" y1="28" x2="34" y2="28" stroke={markColor} strokeWidth={sw(1.5)} strokeLinecap="square" />
        {/* Right column top */}
        <line x1="66" y1="28" x2="78" y2="28" stroke={markColor} strokeWidth={sw(1.5)} strokeLinecap="square" />

        {/* ── Base serifs (foundations) ── */}
        {/* Left column base */}
        <line x1="21" y1="74" x2="35" y2="74" stroke={markColor} strokeWidth={sw(2)} strokeLinecap="square" />
        {/* Right column base */}
        <line x1="65" y1="74" x2="79" y2="74" stroke={markColor} strokeWidth={sw(2)} strokeLinecap="square" />
      </svg>
    );
  };

  if (size === "favicon") {
    return (
      <div className={className} aria-label="Meritus Via" role="img">
        <ArchitecturalM s={40} strokeScale={1.2} />
      </div>
    );
  }

  if (size === "header") {
    return (
      <div className={`flex items-center gap-2.5 leading-none ${className}`} aria-label="Meritus Via">
        <span
          className="font-serif text-[22px] tracking-[0.18em] uppercase"
          style={{ color: textColor }}
        >
          Meritus
        </span>
        <span
          className="text-[20px] font-light -mt-0.5"
          style={{ color: brass }}
        >
          |
        </span>
        <span
          className="font-serif text-[22px] tracking-[0.18em] uppercase"
          style={{ color: brass }}
        >
          Via
        </span>
      </div>
    );
  }

  // Standalone
  return (
    <div className={`flex items-center justify-center gap-3.5 leading-none ${className}`} aria-label="Meritus Via">
      <span
        className="font-serif text-3xl tracking-[0.18em] uppercase"
        style={{ color: textColor }}
      >
        Meritus
      </span>
      <span
        className="text-[28px] font-light -mt-1"
        style={{ color: brass }}
      >
        |
      </span>
      <span
        className="font-serif text-3xl tracking-[0.18em] uppercase"
        style={{ color: brass }}
      >
        Via
      </span>
    </div>
  );
}
