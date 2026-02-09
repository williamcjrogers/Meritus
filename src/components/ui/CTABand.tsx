import Link from "next/link";

interface CTABandProps {
  heading?: string;
  subtext?: string;
  buttonText?: string;
  buttonHref?: string;
}

export function CTABand({
  heading = "Ready to discuss your position?",
  subtext,
  buttonText = "Request Conflict Check",
  buttonHref = "/contact",
}: CTABandProps) {
  return (
    <section className="bg-green grain py-16 lg:py-24 relative overflow-hidden">
      {/* Top brass line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />

      <div className="max-w-[900px] mx-auto px-6 lg:px-[8%] text-center relative z-10">
        <span className="brass-rule mx-auto mb-10 block" />
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream leading-tight italic">
          {heading}
        </h2>
        {subtext && (
          <p className="mt-6 text-base lg:text-lg text-cream/55 max-w-lg mx-auto">
            {subtext}
          </p>
        )}
        <div className="mt-12">
          <Link href={buttonHref} className="btn-brass">
            {buttonText}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
