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
    <Link href={href} className="group block">
      <article className="h-full flex flex-col p-6 lg:p-8 bg-stone border border-green/8 transition-all duration-300 group-hover:border-brass/30 group-hover:shadow-sm">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">
          {category}
        </div>
        <h3 className="mt-3 font-serif text-lg lg:text-xl text-green leading-snug group-hover:text-brass transition-colors duration-300">
          {title}
        </h3>
        <p className="mt-3 text-[15px] text-ink/55 leading-relaxed flex-1">{excerpt}</p>
        <div className="mt-5 pt-4 border-t border-green/5 flex items-center gap-3 font-mono text-[10px] text-slate/60">
          <span>{date}</span>
          <span className="text-green/15">|</span>
          <span>{readTime}</span>
        </div>
      </article>
    </Link>
  );
}
