"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { CONTACT_FORM_OPTIONS, SITE_CONFIG } from "@/lib/constants";

interface FormData { name: string; firm: string; email: string; disputeNature: string; approximateValue: string; forum: string; description: string; company_website: string; }

/** "sent" only when the server accepted the enquiry; the two error states keep the visitor's input on screen. */
type SubmitStatus = "idle" | "sent" | "throttled" | "failed";

const STATUS_COPY: Record<Exclude<SubmitStatus, "idle" | "sent">, string> = {
  throttled: `You have sent several enquiries today. Please email ${SITE_CONFIG.email}.`,
  failed: `We could not send your enquiry. Please email ${SITE_CONFIG.email}.`,
};

export function ContactForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const onSubmit = async (data: FormData) => {
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) {
        // Ad-platform conversion signal; category only, no personal data.
        const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
        gtag?.("event", "generate_lead", { form: "conflict_check", dispute_nature: data.disputeNature });
        setStatus("sent");
      } else {
        setStatus(res.status === 429 ? "throttled" : "failed");
      }
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <div className="py-16">
        <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-brass mb-4">Received</div>
        <p className="font-serif text-2xl text-green italic">Thank you for your enquiry.</p>
        <p className="mt-4 text-[14px] text-ink/70">A partner will review your matter and respond within 24 hours.</p>
      </div>
    );
  }

  // 16px on mobile: anything smaller makes iOS Safari zoom the page on focus
  const inp = "w-full px-0 py-3 bg-transparent border-0 border-b border-green/15 text-[16px] sm:text-[14px] text-green placeholder:text-slate/40 focus:outline-none focus:border-brass transition-colors duration-300";
  const lbl = "block text-[12px] tracking-wide text-slate mb-1";
  const err = "text-[11px] text-oxblood mt-1";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="conflict-form space-y-8" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div><label htmlFor="name" className={lbl}>Name</label><input id="name" type="text" className={inp} {...register("name", { required: "Required" })} />{errors.name && <p className={err}>{errors.name.message}</p>}</div>
        <div><label htmlFor="firm" className={lbl}>Firm</label><input id="firm" type="text" className={inp} {...register("firm", { required: "Required" })} />{errors.firm && <p className={err}>{errors.firm.message}</p>}</div>
      </div>
      <div><label htmlFor="email" className={lbl}>Email</label><input id="email" type="email" className={inp} {...register("email", { required: "Required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } })} />{errors.email && <p className={err}>{errors.email.message}</p>}</div>
      <div><label htmlFor="disputeNature" className={lbl}>Nature of dispute</label><select id="disputeNature" className={inp} {...register("disputeNature", { required: "Required" })}><option value="">Select</option>{CONTACT_FORM_OPTIONS.disputeNature.map((o) => <option key={o} value={o}>{o}</option>)}</select>{errors.disputeNature && <p className={err}>{errors.disputeNature.message}</p>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div><label htmlFor="approximateValue" className={lbl}>Approximate value</label><select id="approximateValue" className={inp} {...register("approximateValue")}><option value="">Select</option>{CONTACT_FORM_OPTIONS.approximateValue.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div><label htmlFor="forum" className={lbl}>Forum</label><select id="forum" className={inp} {...register("forum")}><option value="">Select</option>{CONTACT_FORM_OPTIONS.forum.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
      </div>
      <div><label htmlFor="description" className={lbl}>Brief summary</label><textarea id="description" rows={3} className={inp} placeholder="e.g. Curtain wall defects at interface with structural frame, associated delay to completion, and disputed variation account..." {...register("description")} /></div>
      {/* Honeypot: people never see this field, automated submissions fill it. Visually hidden rather than type="hidden", which bots skip. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" {...register("company_website")} />
      </div>
      {status !== "idle" && (
        <p role="alert" className="text-[13px] text-oxblood">{STATUS_COPY[status]}</p>
      )}
      <button type="submit" disabled={isSubmitting} className="btn-outline text-[13px] disabled:opacity-40 disabled:pointer-events-none">
        {isSubmitting ? "Submitting\u2026" : "Request Conflict Check"}
      </button>
    </form>
  );
}
