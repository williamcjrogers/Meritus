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
    <Link href={href} className="group block h-full relative">
      {/* Outer structural frame, visible on hover */}
      <div className="absolute -inset-2 lg:-inset-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-brass/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-brass/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-brass/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-brass/40" />
      </div>

      <article className="relative h-full z-10 flex flex-col p-6 lg:p-8 bg-parchment border border-green/5 transition-all duration-500 group-hover:bg-green group-hover:border-brass/20">
        <div className="flex justify-between items-start mb-6">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">
            {category}
          </div>
          {/* Hover Arrow Indicator */}
          <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
            <span className="text-brass text-lg leading-none">→</span>
          </div>
        </div>

        <h3 className="font-serif text-xl lg:text-2xl text-green group-hover:text-cream transition-colors duration-500 leading-snug mb-4">
          {title}
        </h3>
        
        <p className="text-[15px] text-slate/70 group-hover:text-cream/60 transition-colors duration-500 leading-relaxed flex-1 mb-8">
          {excerpt}
        </p>

        {/* Divider and Metadata at bottom */}
        <div className="pt-5 border-t border-green/10 group-hover:border-cream/10 transition-colors duration-500 flex items-center gap-3 font-mono text-[10px] tracking-widest text-slate/40 group-hover:text-cream/40 mt-auto">
          <span>{date}</span>
          <span className="text-slate/20 group-hover:text-cream/20 transition-colors duration-500">|</span>
          <span>{readTime}</span>
        </div>
      </article>
    </Link>
  );
}
