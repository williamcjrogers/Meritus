interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  light?: boolean;
  className?: string;
  mono?: boolean;
  /** Use only for tagline or quote; default is no italic */
  italic?: boolean;
}

export function SectionHeading({
  title,
  subtitle,
  light = false,
  className = "",
  mono = false,
  italic = false,
}: SectionHeadingProps) {
  return (
    <div className={`mb-12 ${className}`}>
      {mono ? (
        <h2
          className={`font-mono text-[10px] tracking-[0.25em] uppercase ${light ? "text-cream/50" : "text-slate"}`}
        >
          {title}
        </h2>
      ) : (
        <h2
          className={`font-serif text-3xl lg:text-4xl leading-tight ${italic ? "italic" : ""} ${light ? "text-cream" : "text-green"}`}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p className={`mt-4 text-base lg:text-lg leading-relaxed ${light ? "text-cream/60" : "text-slate"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
