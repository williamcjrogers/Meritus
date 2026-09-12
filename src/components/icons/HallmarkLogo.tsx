interface HallmarkLogoProps {
  size?: "favicon" | "header" | "standalone";
  variant?: "light" | "dark";
  showDescriptor?: boolean;
  className?: string;
}

export function HallmarkLogo({
  size = "header",
  variant = "dark",
  showDescriptor = false,
  className = "",
}: HallmarkLogoProps) {
  return (
    <span
      className={`meritus-wordmark meritus-wordmark--${size} meritus-wordmark--${variant} ${className}`}
      role="img"
      aria-label="Meritus Via"
    >
      {size === "favicon" ? (
        <svg
          viewBox="0 0 40 40"
          width="40"
          height="40"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 32V8l14 17L34 8v24"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </svg>
      ) : (
        <span>
          Meritus <span className="meritus-wordmark-via">Via</span>
          {showDescriptor && <small>Construction disputes advisory</small>}
        </span>
      )}
    </span>
  );
}
