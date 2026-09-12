import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConstructionRecord } from "./ConstructionRecord";

export function HeroSection() {
  return (
    <section className="public-hero">
      <div className="public-container public-hero-grid">
        <div className="public-hero-copy">
          <p className="public-page-label">Construction disputes advisory</p>
          <h1>
            A clear position.
            <br /> Built from the record.
          </h1>
          <p className="public-lead">
            Delay, quantum and technical expertise for complex construction
            disputes. We connect what happened on the project with what can be
            evidenced.
          </p>
          <div className="public-hero-actions">
            <Button href="/contact">Discuss your matter</Button>
            <Link href="/services" className="public-text-link">
              Explore our expertise
            </Link>
          </div>
          <p className="public-hero-note">
            For contractors, employers and instructing solicitors.
          </p>
        </div>
        <ConstructionRecord />
      </div>
    </section>
  );
}
