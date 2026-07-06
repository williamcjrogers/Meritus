import Link from "next/link";
import { FadeIn } from "@/components/animations";

interface CTABandProps {
  heading?: string;
  subtext?: string;
  buttonText?: string;
  buttonHref?: string;
  leftGraphic?: "numeral" | "monogram" | "none";
}

export function CTABand({
  heading = "We automate the preparation. Never the judgment.",
  subtext = "100GB of project data,classified, cross-referenced, and structured in hours. So our partners spend their time in the analysis, not the archive.",
  buttonText = "Discuss Your Matter",
  buttonHref = "/contact",
  leftGraphic = "numeral",
}: CTABandProps) {
  const hasLeft = leftGraphic !== "none";

  return (
    <section className="bg-green grain py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />

      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
        <div className={`grid grid-cols-1 ${hasLeft ? "lg:grid-cols-12" : "lg:grid-cols-1"} gap-10 lg:gap-16 items-center`}>

          {/* Copy + CTA (left column, aligned with the section content above) */}
          <FadeIn className={hasLeft ? "lg:col-span-8 order-2 lg:order-1" : "text-center"} direction="up" delay={0.08}>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-[42px] text-cream leading-[1.2]">
              {heading.includes("Never") ? (
                <>
                  We automate the preparation.<br />
                  <span className="italic text-cream/55">Never the judgment.</span>
                </>
              ) : (
                heading
              )}
            </h2>
            <p className={`mt-6 text-[15px] lg:text-base text-cream/45 leading-relaxed max-w-xl ${!hasLeft ? "mx-auto" : ""}`}>
              {subtext}
            </p>
            <div className={`mt-10 flex items-center gap-6 ${!hasLeft ? "justify-center" : ""}`}>
              <Link href={buttonHref} className="btn-brass">
                {buttonText}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
                <span className="hidden md:inline font-mono text-[10px] tracking-[0.15em] text-cream/20">
                Direct access to a partner
              </span>
            </div>
          </FadeIn>

          {/* Graphic (right column, sitting where the section visuals above sit) */}
          {leftGraphic === "numeral" && (
            <FadeIn className="lg:col-span-4 order-1 lg:order-2 text-center lg:text-right" direction="up">
              <div className="font-serif text-[72px] lg:text-[100px] leading-none text-brass/25 tracking-tight">
                100
                <span className="text-[40px] lg:text-[56px] align-top">GB</span>
                <span className="text-[40px] lg:text-[56px]">+</span>
              </div>
              <div className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-cream/25">
                Per matter. In hours.
              </div>
            </FadeIn>
          )}

          {leftGraphic === "monogram" && (
            <FadeIn className="lg:col-span-4 order-1 lg:order-2 text-center lg:text-right" direction="up">
              {/* Shrink-wrapped block so the label centres on the M at every alignment */}
              <div className="inline-block text-center">
                <div className="font-serif text-[110px] lg:text-[160px] leading-none text-brass/20 tracking-tight select-none" aria-hidden="true">
                  M
                </div>
                {/* pl matches the tracking so the trailing letter-space doesn't skew centring */}
                <div className="mt-1 font-mono text-[10px] tracking-[0.2em] uppercase text-cream/20 pl-[0.2em]">
                  Meritus Via
                </div>
              </div>
            </FadeIn>
          )}

        </div>
      </div>
    </section>
  );
}
