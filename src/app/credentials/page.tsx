"use client";

import { useState } from "react";
import { FadeIn, ProjectPulse } from "@/components/animations";
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
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden border-b border-brass/10">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />
        
        {/* Subtle Private Vault Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/2 left-[20%] w-[1px] h-[50%] bg-gradient-to-b from-brass/30 to-transparent" />
          <div className="absolute top-1/2 right-[20%] w-[1px] h-[50%] bg-gradient-to-b from-brass/30 to-transparent" />
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-4 mb-8 justify-center">
              <div className="h-[1px] w-6 bg-brass/30" />
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-brass/60">
                Secure Access
              </div>
              <div className="h-[1px] w-6 bg-brass/30" />
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic text-center mb-6">
              Credentials <span className="text-cream/70 not-italic">Portal</span>
            </h1>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-[clamp(4rem,8vw,8rem)] relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-serif leading-none text-green/[0.02] select-none">
            VLT.
          </div>
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.3}>
            <div className="max-w-md mx-auto relative bg-parchment p-10 lg:p-12 border border-green/5 shadow-sm">
              <div className="absolute inset-1 border border-green/5 pointer-events-none" />
              
              <HallmarkLogo size="standalone" variant="dark" showDescriptor className="mx-auto mb-10" />
              
              <p className="text-[13px] text-slate/70 leading-[1.8] font-light text-center mb-10">
                Meritus Via is a partnership of industry-recognised experts formerly of leading international practices. 
                Due to commercial sensitivities, full biographies and case histories require secure access.
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="relative">
                  <label htmlFor="password" className="block font-mono text-[9px] tracking-[0.2em] uppercase text-slate/50 mb-3 text-center">
                    Authorisation Code
                  </label>
                  <input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-green/15 text-[14px] text-center text-green focus:outline-none focus:border-brass focus:ring-0 transition-colors duration-300 tracking-widest placeholder-slate/20 font-mono" 
                    placeholder="••••••••" 
                  />
                  {error && <p className="text-[10px] tracking-wide text-oxblood/80 mt-3 text-center font-mono uppercase">Invalid authorisation sequence.</p>}
                </div>

                <div className="pt-4 text-center">
                  <button type="submit" className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-dark transition-colors duration-300 group inline-flex items-center gap-2">
                    Authenticate
                    <span className="transform group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </button>
                </div>
              </form>

              <div className="mt-12 pt-8 border-t border-green/5 text-center">
                <p className="text-[11px] text-slate/40 font-light">
                  No access code? <Link href="/contact" className="text-brass hover:text-brass-dark transition-colors border-b border-brass/30 hover:border-brass pb-0.5">Request access</Link>.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
      </>
    );
  }

  return (
    <>
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden border-b border-brass/10">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />
        
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] w-8 bg-brass/50" />
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Credentials Portal
              </div>
              <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-brass/50 to-transparent" />
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic">
              Private credentials <span className="not-italic text-cream/70">pack</span>
            </h1>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-[clamp(4rem,8vw,8rem)] relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-serif leading-none text-green/[0.02] select-none">
            VLT.
          </div>
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
              {[
                { title: "Partner CVs", description: "Detailed professional credentials, career history, and sector expertise.", ref: "DOC_01" },
                { title: "Representative Matters", description: "Anonymised case histories: sector, dispute type, value, role, and outcome.", ref: "DOC_02" },
                { title: "Method Notes", description: "Analytical methodology, quality governance, and technology audit framework.", ref: "DOC_03" },
                { title: "Sample Outputs", description: "Redacted expert report extracts, exhibit packs, and chronology samples.", ref: "DOC_04" },
              ].map((item, index) => (
                <div key={item.title} className="p-8 bg-parchment border border-green/5 relative group transition-all duration-300 hover:border-brass/20 hover:shadow-md">
                  <div className="font-mono text-[9px] tracking-[0.2em] text-brass/50 mb-6 uppercase">{item.ref}</div>
                  <h3 className="font-serif text-2xl text-green mb-4 group-hover:text-brass transition-colors duration-300">{item.title}</h3>
                  <p className="text-[14px] text-slate/80 leading-[1.8] font-light mb-8">{item.description}</p>
                  
                  <div className="pt-6 border-t border-green/5 flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-widest text-slate/40 uppercase">Pending Upload</span>
                    <span className="text-slate/20">↓</span>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
