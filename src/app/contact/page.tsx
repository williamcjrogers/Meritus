import type { Metadata } from "next";
import { Suspense } from "react";
import { FadeIn } from "@/components/animations";
import { ContactForm } from "./ContactForm";
import { SITE_CONFIG } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact",
  description: "Request a conflict check with Meritus. Direct access to a senior construction disputes practitioner within 24 hours.",
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-brass/70 mb-6">Contact</div>
            <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic">Request conflict check</h1>
            <p className="mt-8 text-[15px] text-cream/45 max-w-xl">A partner will review your matter and respond within 24 hours.</p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-20">
            <FadeIn className="lg:col-span-3">
              <Suspense fallback={<div className="h-96" />}><ContactForm /></Suspense>
            </FadeIn>
            <FadeIn className="lg:col-span-2" delay={0.2}>
              <div className="lg:sticky lg:top-28">
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-slate mb-4">Direct</div>
                <div className="text-[14px] text-slate">
                  <a href={`mailto:${SITE_CONFIG.email}`} className="text-green hover:text-brass transition-colors duration-200">{SITE_CONFIG.email}</a>
                </div>
                <div className="mt-6">
                  <a href={SITE_CONFIG.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate/40 hover:text-brass transition-colors duration-200" aria-label="LinkedIn"><LinkedInIcon className="w-4 h-4" /></a>
                </div>
                <div className="mt-16 pt-8 border-t border-green/8">
                  <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-slate mb-4">Credentials</div>
                  <p className="text-[13px] text-slate/70 leading-relaxed">Meritus is a partnership of industry-recognised experts. Full partner biographies and representative matter histories are available via secure access.</p>
                  <p className="mt-4"><a href="/credentials" className="text-[13px] text-brass border-b border-brass/40 pb-0.5 hover:border-brass transition-colors duration-300">Request access to the Credentials Portal</a></p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  );
}
