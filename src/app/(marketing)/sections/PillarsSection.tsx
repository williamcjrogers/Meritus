import Link from "next/link";
import { ServiceTile } from "@/components/ui/ServiceTile";
export const EXPERTISE = [
  {
    title: "Delay",
    description:
      "Establish the sequence, the critical path and the effect of change.",
    href: "/services#delay",
  },
  {
    title: "Quantum",
    description:
      "Build and test valuations against the underlying cost and contract records.",
    href: "/services#quantum",
  },
  {
    title: "Technical",
    description:
      "Investigate defects, design responsibility and the causes of failure.",
    href: "/services#technical",
  },
  {
    title: "Advisory",
    description:
      "Assess the merits and prepare a proportionate route through the dispute.",
    href: "/services#advisory",
  },
  {
    title: "Technology",
    description:
      "Organise project evidence and keep findings connected to their sources.",
    href: "/services#technology",
  },
];
export function PillarsSection() {
  return (
    <section className="public-section">
      <div className="public-container public-expertise-layout">
        <div className="public-section-heading">
          <h2>The expertise your matter needs.</h2>
          <p>Choose a discipline, or bring us an issue that crosses several.</p>
          <Link href="/sectors" className="public-text-link">
            Explore our sectors
          </Link>
        </div>
        <div className="public-service-list">
          {EXPERTISE.map((service) => (
            <ServiceTile key={service.title} {...service} />
          ))}
        </div>
      </div>
    </section>
  );
}
