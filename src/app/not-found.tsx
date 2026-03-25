import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";

export default function NotFound() {
  return (
    <section className="bg-green grain min-h-screen flex items-center justify-center relative overflow-hidden">
      <ProjectPulse className="z-0 opacity-35" />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 35% 45%, rgba(181,151,90,0.09) 0%, transparent 72%), radial-gradient(ellipse 30% 35% at 80% 80%, rgba(11,59,36,0.45) 0%, transparent 70%)",
        }}
      />

      <div className="text-center px-6 relative z-10 max-w-xl">
        <FadeIn direction="up">
          <p className="font-mono text-[11px] tracking-[0.3em] text-brass mb-6">404</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-cream italic">Page not found</h1>
          <p className="mt-6 text-[15px] lg:text-base text-cream/55">
            The page you are looking for does not exist or may have moved.
          </p>
        </FadeIn>

        <FadeIn direction="up" delay={0.12}>
          <div className="mt-10 flex justify-center">
            <Link href="/" className="btn-brass">
              Return to homepage
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </FadeIn>

        <div className="mt-8 font-mono text-[10px] tracking-[0.2em] uppercase text-cream/30">
          Meritus Via
        </div>
      </div>
    </section>
  );
}
