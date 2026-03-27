import Link from "next/link";

interface InsightCardProps {
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  category: string;
  href: string;
}

export function InsightCard({ title, date, readTime, excerpt, category, href }: InsightCardProps) {
  return (
    <Link href={href} className="group block relative">
      {/* Outer structural frame, visible on hover */}
      <div className="absolute -inset-2 lg:-inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-brass/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-brass/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-brass/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-brass/40" />
      </div>

      <article className="relative z-10 flex flex-col lg:flex-row lg:items-center p-6 lg:p-8 bg-parchment border border-green/5 transition-all duration-500 group-hover:bg-green group-hover:border-brass/20">
        {/* Left side: Category & Metadata */}
        <div className="lg:w-1/4 mb-4 lg:mb-0 lg:pr-8 flex flex-row lg:flex-col justify-between lg:justify-start items-start">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-3">
            {category}
          </div>
          <div className="flex flex-row lg:flex-col gap-3 lg:gap-1 font-mono text-[10px] tracking-widest text-slate/40 group-hover:text-cream/40 transition-colors duration-500">
            <span>{date}</span>
            <span className="hidden lg:block text-brass/20 my-1">—</span>
            <span className="lg:hidden text-slate/20">|</span>
            <span>{readTime}</span>
          </div>
        </div>

        {/* Divider for desktop */}
        <div className="hidden lg:block w-[1px] h-16 bg-gradient-to-b from-transparent via-brass/20 to-transparent mx-8 shrink-0" />

        {/* Right side: Content */}
        <div className="lg:w-3/4 lg:pl-4">
          <h3 className="font-serif text-xl lg:text-2xl text-green group-hover:text-cream transition-colors duration-500 leading-snug mb-3">
            {title}
          </h3>
          <p className="text-[14px] text-slate/70 group-hover:text-cream/60 transition-colors duration-500 leading-relaxed">
            {excerpt}
          </p>
        </div>

        {/* Hover Arrow Indicator */}
        <div className="absolute top-6 right-6 lg:top-1/2 lg:-translate-y-1/2 lg:right-8 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
          <span className="text-brass text-lg">→</span>
        </div>
      </article>
    </Link>
  );
}
