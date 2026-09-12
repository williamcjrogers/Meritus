import Link from "next/link";
interface ServiceTileProps {
  title: string;
  description: string;
  href: string;
}
export function ServiceTile({ title, description, href }: ServiceTileProps) {
  return (
    <Link href={href} className="public-service-link">
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="public-link-indicator" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
