import Link from "next/link";
import { PublicIntro } from "@/components/ui/PublicIntro";
import { ContactForm } from "./ContactForm";
import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Discuss a construction dispute, expert appointment or credentials request with Meritus Via.",
  path: "/contact",
});
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiry?: string }>;
}) {
  const { enquiry } = await searchParams;
  return (
    <>
      <PublicIntro
        title="Tell us what needs resolving."
        label="Contact"
        description="Share the initial details of the project, the issue and any immediate deadline. We will review the enquiry and respond directly."
      />
      <section className="public-section">
        <div className="public-container public-contact-layout">
          <div>
            <h2 className="public-form-heading">Make an enquiry</h2>
            <ContactForm
              initialEnquiry={
                enquiry === "credentials" ? "Credentials request" : undefined
              }
            />
          </div>
          <aside className="public-contact-aside">
            <div>
              <h2>Prefer to email?</h2>
              <a href={`mailto:${SITE_CONFIG.email}`}>{SITE_CONFIG.email}</a>
              <p>
                Include any response deadline so we can understand the urgency.
              </p>
            </div>
            <div>
              <h2>Sending documents?</h2>
              <p>
                If your organisation has been given access, use the document
                service to send your files.
              </p>
              <Link href="/access" className="public-text-link">
                Client access
              </Link>
            </div>
            <div>
              <h2>Considering an appointment?</h2>
              <p>
                We can provide relevant professional biographies and discuss the
                scope of the work.
              </p>
              <Link href="/credentials" className="public-text-link">
                About credentials
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
