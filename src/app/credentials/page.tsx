"use client";

import { useState } from "react";
import { FadeIn } from "@/components/animations";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import Link from "next/link";

export default function CredentialsPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length > 0) { setAuthenticated(true); setError(false); } else { setError(true); }
  };

  if (!authenticated) {
    return (
      <>
        <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
            <FadeIn>
              <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-brass/70 mb-6">Credentials Portal</div>
              <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic">Private credentials</h1>
            </FadeIn>
          </div>
        </section>
        <section className="bg-stone py-16 lg:py-20">
          <div className="max-w-md mx-auto px-6 text-center">
            <FadeIn>
              <HallmarkLogo size="standalone" variant="dark" showDescriptor className="mx-auto mb-12" />
              <p className="text-[14px] text-slate leading-relaxed mb-8">
                Meritus is a partnership of industry-recognised experts formerly of leading international disputes practices.
                Due to current commercial sensitivities, full partner biographies and case histories are available via secure access only.
              </p>
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div>
                  <label htmlFor="password" className="block text-[12px] tracking-wide text-slate mb-1">Access code</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-0 py-3 bg-transparent border-0 border-b border-green/15 text-[14px] text-green focus:outline-none focus:border-brass transition-colors duration-300" placeholder="Enter the code provided to you" />
                  {error && <p className="text-[11px] text-oxblood mt-1">Please enter a valid access code.</p>}
                </div>
                <button type="submit" className="text-[13px] text-brass tracking-wide border-b border-brass/40 pb-1 hover:border-brass transition-colors duration-300">Access Credentials</button>
              </form>
              <p className="mt-12 text-[12px] text-slate/50">If you do not have an access code, <Link href="/contact" className="text-brass hover:underline">request one here</Link>.</p>
            </FadeIn>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-brass/70 mb-6">Credentials Portal</div>
            <h1 className="font-serif text-4xl text-cream italic">Private credentials pack</h1>
          </FadeIn>
        </div>
      </section>
      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: "Partner CVs", description: "Detailed professional credentials, career history, and sector expertise." },
                { title: "Representative Matters", description: "Anonymised case histories: sector, dispute type, value, role, and outcome." },
                { title: "Method Notes", description: "Analytical methodology, quality governance, and technology audit framework." },
                { title: "Sample Outputs", description: "Redacted expert report extracts, exhibit packs, and chronology samples." },
              ].map((item) => (
                <div key={item.title} className="py-8 border-t border-green/8">
                  <h3 className="font-serif text-lg text-green italic">{item.title}</h3>
                  <p className="mt-2 text-[13px] text-slate leading-relaxed">{item.description}</p>
                  <p className="mt-3 text-[11px] text-slate/40 italic">To be uploaded by partners</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
