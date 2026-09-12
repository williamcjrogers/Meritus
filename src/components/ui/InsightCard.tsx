import Link from "next/link";
interface InsightCardProps {
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  category: string;
  href: string;
}
export function InsightCard({
  title,
  date,
  readTime,
  excerpt,
  category,
  href,
}: InsightCardProps) {
  return (
    <article className="public-insight">
      <div className="public-insight-category">{category}</div>
      <h3>
        <Link href={href}>{title}</Link>
      </h3>
      <p>{excerpt}</p>
      <div className="public-insight-meta">
        <span>{date}</span>
        <span>{readTime}</span>
      </div>
    </article>
  );
}
