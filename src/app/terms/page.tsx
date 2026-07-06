import { FadeIn } from "@/components/animations";
import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Use",
  description: "Terms of use for the Meritus Via website. The basis on which you may use this site.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <h1 className="font-serif text-4xl text-cream italic">
              Terms of Use
            </h1>
          </FadeIn>
        </div>
      </section>
      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[800px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="space-y-10 text-[15px] text-slate leading-relaxed">
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Introduction
                </h2>
                <p>
                  These terms govern your use of the {SITE_CONFIG.name} website
                  (meritusvia.com). By accessing this website you agree to be bound
                  by these terms. If you do not agree, please do not use the site.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  About Us
                </h2>
                <p>
                  This website is operated by {SITE_CONFIG.legalName}, a private
                  limited company registered in England and Wales (company number{" "}
                  {SITE_CONFIG.companyNumber}), with its registered office at{" "}
                  {SITE_CONFIG.registeredOffice}.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Website Content
                </h2>
                <p>
                  The content of this website, including insight articles, service
                  descriptions, and all other material, is provided for general
                  information only. It does not constitute legal, financial, or
                  professional advice and should not be relied upon as such.
                  Specific professional advice should be sought in relation to any
                  particular matter.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Intellectual Property
                </h2>
                <p>
                  All content on this website, including text, graphics, logos,
                  data visualisations, and software, is the property of{" "}
                  {SITE_CONFIG.legalName} or its licensors and is protected by
                  copyright, trademark, and other intellectual property laws. You
                  may not reproduce, distribute, or create derivative works from
                  any material on this site without prior written consent.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Limitation of Liability
                </h2>
                <p>
                  To the fullest extent permitted by law, {SITE_CONFIG.legalName}{" "}
                  excludes all liability arising from or in connection with your
                  use of this website. We do not warrant that the website will be
                  available uninterrupted or error-free, or that any information
                  provided is complete, accurate, or current.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  External Links
                </h2>
                <p>
                  This website may contain links to external sites. We are not
                  responsible for the content, privacy practices, or availability
                  of any linked websites.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Confidentiality
                </h2>
                <p>
                  Information submitted through our contact form is treated as
                  confidential and handled in accordance with our{" "}
                  <a
                    href="/privacy-policy"
                    className="text-brass hover:underline"
                  >
                    Privacy Policy
                  </a>
                  . Please avoid including commercially sensitive documents in
                  initial enquiries.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Governing Law
                </h2>
                <p>
                  These terms are governed by and construed in accordance with the
                  laws of England and Wales. Any disputes arising from or in
                  connection with these terms shall be subject to the exclusive
                  jurisdiction of the courts of England and Wales.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  Changes to These Terms
                </h2>
                <p>
                  We may update these terms from time to time. Continued use of the
                  website following any changes constitutes acceptance of the
                  revised terms.
                </p>
              </div>

              <p className="text-[11px] text-slate/40">
                Effective date: March 2026
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
