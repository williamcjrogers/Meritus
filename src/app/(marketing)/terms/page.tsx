import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Use",
  description:
    "Terms of use for the Meritus Via website. The basis on which you may use this site.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <section className="public-page-intro">
        <div className="public-container">
          <>
            <h1>Terms of Use</h1>
          </>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container public-legal-body">
          <>
            <div className="public-legal-content">
              <div>
                <h2>Introduction</h2>
                <p>
                  These terms govern your use of the {SITE_CONFIG.name} website
                  (meritusvia.com). By accessing this website you agree to be
                  bound by these terms. If you do not agree, please do not use
                  the site.
                </p>
              </div>

              <div>
                <h2>About Us</h2>
                <p>
                  This website is operated by {SITE_CONFIG.legalName}, a private
                  limited company registered in England and Wales (company
                  number {SITE_CONFIG.companyNumber}), with its registered
                  office at {SITE_CONFIG.registeredOffice}.
                </p>
              </div>

              <div>
                <h2>Website Content</h2>
                <p>
                  The content of this website, including insight articles,
                  service descriptions, and all other material, is provided for
                  general information only. It does not constitute legal,
                  financial, or professional advice and should not be relied
                  upon as such. Specific professional advice should be sought in
                  relation to any particular matter.
                </p>
              </div>

              <div>
                <h2>Intellectual Property</h2>
                <p>
                  All content on this website, including text, graphics, logos,
                  data visualisations, and software, is the property of{" "}
                  {SITE_CONFIG.legalName} or its licensors and is protected by
                  copyright, trademark, and other intellectual property laws.
                  You may not reproduce, distribute, or create derivative works
                  from any material on this site without prior written consent.
                </p>
              </div>

              <div>
                <h2>Limitation of Liability</h2>
                <p>
                  To the fullest extent permitted by law,{" "}
                  {SITE_CONFIG.legalName} excludes all liability arising from or
                  in connection with your use of this website. We do not warrant
                  that the website will be available uninterrupted or
                  error-free, or that any information provided is complete,
                  accurate, or current.
                </p>
              </div>

              <div>
                <h2>External Links</h2>
                <p>
                  This website may contain links to external sites. We are not
                  responsible for the content, privacy practices, or
                  availability of any linked websites.
                </p>
              </div>

              <div>
                <h2>Confidentiality</h2>
                <p>
                  Information submitted through our contact form is treated as
                  confidential and handled in accordance with our{" "}
                  <a href="/privacy-policy">Privacy Policy</a>. Please avoid
                  including commercially sensitive documents in initial
                  enquiries.
                </p>
              </div>

              <div>
                <h2>Governing Law</h2>
                <p>
                  These terms are governed by and construed in accordance with
                  the laws of England and Wales. Any disputes arising from or in
                  connection with these terms shall be subject to the exclusive
                  jurisdiction of the courts of England and Wales.
                </p>
              </div>

              <div>
                <h2>Changes to These Terms</h2>
                <p>
                  We may update these terms from time to time. Continued use of
                  the website following any changes constitutes acceptance of
                  the revised terms.
                </p>
              </div>

              <p className="public-meta">Effective date: March 2026</p>
            </div>
          </>
        </div>
      </section>
    </>
  );
}
