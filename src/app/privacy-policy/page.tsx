import type { Metadata } from "next";
import { FadeIn } from "@/components/animations";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy", description: "Meritus Via privacy policy, cookie policy, and accessibility statement." };

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn><h1 className="font-serif text-4xl text-cream italic">Privacy Policy</h1></FadeIn>
        </div>
      </section>
      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[800px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="space-y-10 text-[14px] text-slate leading-relaxed">
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">Introduction</h2>
                <p>{SITE_CONFIG.legalName} is committed to protecting your privacy and handling your data in accordance with the UK GDPR and the Data Protection Act 2018.</p>
              </div>
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">Data We Collect</h2>
                <ul className="space-y-1 list-none">
                  {["Name, email, telephone, and firm (via our contact form)", "Information about your dispute that you choose to provide", "Website usage data via analytics cookies (with consent)"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-brass/50 mt-0.5">&mdash;</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">Your Rights</h2>
                <p>Under UK GDPR you have the right to access, rectify, erase, restrict, port, and object to processing of your personal data. Contact <a href={`mailto:${SITE_CONFIG.email}`} className="text-brass hover:underline">{SITE_CONFIG.email}</a>.</p>
              </div>
              <div id="accessibility">
                <h2 className="font-serif text-xl text-green italic mb-3">Accessibility</h2>
                <p>We aim to conform to WCAG 2.1 Level AA. If you experience any issues, contact <a href={`mailto:${SITE_CONFIG.email}`} className="text-brass hover:underline">{SITE_CONFIG.email}</a>.</p>
              </div>
              <p className="text-[11px] text-slate/40">Last updated: February 2026</p>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
