"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { CONTACT_FORM_OPTIONS, SITE_CONFIG } from "@/lib/constants";
interface FormData {
  name: string;
  firm: string;
  email: string;
  disputeNature: string;
  approximateValue: string;
  forum: string;
  description: string;
  company_website: string;
}
type SubmitStatus = "idle" | "sent" | "throttled" | "failed";
const STATUS_COPY = {
  throttled: `You have sent several enquiries today. Please email ${SITE_CONFIG.email}.`,
  failed: `We could not send your enquiry. Please email ${SITE_CONFIG.email}.`,
};

export function ContactForm({
  initialEnquiry,
}: { initialEnquiry?: string } = {}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: { disputeNature: initialEnquiry ?? "" },
  });
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const sending = useRef(false);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === "sent") confirmation.current?.focus();
  }, [status]);
  const onSubmit = async (data: FormData) => {
    if (sending.current) return;
    sending.current = true;
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setStatus("sent");
        // Analytics must never change the outcome of an accepted enquiry.
        try {
          (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
            "event",
            "generate_lead",
            { form: "enquiry", dispute_nature: data.disputeNature },
          );
        } catch {
          /* Delivery already succeeded. */
        }
      } else {
        setStatus(res.status === 429 ? "throttled" : "failed");
      }
    } catch {
      setStatus("failed");
    } finally {
      sending.current = false;
    }
  };
  const errorProps = (name: keyof FormData) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const error = (name: keyof FormData) =>
    errors[name] && (
      <p id={`${name}-error`} className="public-field-error">
        {errors[name]?.message}
      </p>
    );
  if (status === "sent")
    return (
      <div
        ref={confirmation}
        tabIndex={-1}
        role="status"
        className="public-form-confirmation"
      >
        <h3>Thank you for your enquiry.</h3>
        <p>
          Your enquiry has been received. We will review the details and respond
          using the email address you provided.
        </p>
      </div>
    );
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="enquiry-form" noValidate>
      <p className="public-form-help">
        Name, firm, email and nature of dispute are required.
      </p>
      <div className="public-form-row">
        <div>
          <label htmlFor="name" className="app-label">
            Name
          </label>
          <input
            id="name"
            autoComplete="name"
            className="app-field"
            {...errorProps("name")}
            {...register("name", { required: "Required" })}
          />
          {error("name")}
        </div>
        <div>
          <label htmlFor="firm" className="app-label">
            Firm
          </label>
          <input
            id="firm"
            autoComplete="organization"
            className="app-field"
            {...errorProps("firm")}
            {...register("firm", { required: "Required" })}
          />
          {error("firm")}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="app-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="app-field"
          {...errorProps("email")}
          {...register("email", {
            required: "Required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Enter a valid email address",
            },
          })}
        />
        {error("email")}
      </div>
      <div>
        <label htmlFor="disputeNature" className="app-label">
          Nature of dispute
        </label>
        <select
          id="disputeNature"
          className="app-field"
          {...errorProps("disputeNature")}
          {...register("disputeNature", { required: "Required" })}
        >
          <option value="">Select</option>
          {CONTACT_FORM_OPTIONS.disputeNature.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error("disputeNature")}
      </div>
      <div className="public-form-row">
        <div>
          <label htmlFor="approximateValue" className="app-label">
            Approximate value <span>(optional)</span>
          </label>
          <select
            id="approximateValue"
            className="app-field"
            {...register("approximateValue")}
          >
            <option value="">Select</option>
            {CONTACT_FORM_OPTIONS.approximateValue.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="forum" className="app-label">
            Forum <span>(optional)</span>
          </label>
          <select id="forum" className="app-field" {...register("forum")}>
            <option value="">Select</option>
            {CONTACT_FORM_OPTIONS.forum.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="description" className="app-label">
          Brief summary
        </label>
        <textarea
          id="description"
          rows={6}
          className="app-field resize-none"
          aria-describedby="description-help"
          {...register("description")}
        />
        <p id="description-help" className="public-field-help">
          Include the main issue and any immediate deadline. Detailed documents
          can follow once the instruction is agreed.
        </p>
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          defaultValue=""
          {...register("company_website")}
        />
      </div>
      <div className="public-form-status">
        {status !== "idle" && <p role="alert">{STATUS_COPY[status]}</p>}
      </div>
      <Button type="submit" busy={isSubmitting}>
        Send enquiry
      </Button>
    </form>
  );
}
