import { Suspense } from "react";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { ContactForm } from "./ContactForm";
import { SITE_CONFIG } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact",
  description: "Request a conflict check with Meritus Via. Direct access to a senior construction disputes practitioner within 24 hours.",
  path: "/contact",
  keywords: [
    "construction disputes contact",
    "instruct construction expert witness",
    "adjudication referral support",
    "conflict check construction dispute",
  ],
});

export default function ContactPage() {
  return (
    <>
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden border-b border-brass/10">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />
        
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-8">
              <FadeIn delay={0.1}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                    Contact & Appointments
                  </div>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.2}>
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Request <span className="text-cream/70 italic">conflict check.</span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.3}>
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[15px] lg:text-[16px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
                    Submit the initial details of your matter below. A partner will review for commercial and legal conflicts and respond directly within 24 hours. All submissions are strictly confidential.
                  </p>
                </div>
              </FadeIn>
            </div>
            
            <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
              <FadeIn delay={0.4}>
                <div className="flex flex-col items-end">
                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-4">Direct Contact</div>
                  <div className="text-[14px] text-cream mb-4">
                    <span className="select-all cursor-text">{SITE_CONFIG.email}</span>
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-brass/60">STRICTLY_CONFIDENTIAL</div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-brass/60 mt-2">PARTNER_REVIEW_ONLY</div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone py-[clamp(4rem,8vw,8rem)] relative">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
            <div className="lg:col-span-7">
              <FadeIn delay={0.2}>
                <Suspense fallback={<div className="h-96" />}><ContactForm /></Suspense>
              </FadeIn>
            </div>
            <div className="lg:col-span-4 lg:col-start-9">
              <FadeIn delay={0.4} className="lg:sticky lg:top-[20vh]">
                <div className="p-8 bg-parchment border border-green/5 relative">
                  {/* Subtle inner border */}
                  <div className="absolute inset-1 border border-green/5 pointer-events-none" />
                  
                  <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-brass mb-6">Credentials Portal</div>
                  <p className="text-[14px] text-slate/70 leading-[1.8] mb-6 font-light">
                    Meritus Via is a partnership of industry-recognised experts. Full partner biographies, representative matter histories, and sample expert reports are available via secure access.
                  </p>
                  <a href="/credentials" className="inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.15em] uppercase text-green hover:text-brass transition-colors duration-300 group">
                    Request access
                    <span className="transform group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </a>

                  <div className="mt-10 pt-8 border-t border-green/10 flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate/40">Network</div>
                    <a href={SITE_CONFIG.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate/40 hover:text-brass transition-colors duration-200" aria-label="LinkedIn">
                      <LinkedInIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
