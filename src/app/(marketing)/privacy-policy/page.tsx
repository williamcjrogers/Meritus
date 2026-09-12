import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "Meritus Via privacy policy. How we collect, use, store, and protect your personal data under UK GDPR.",
  path: "/privacy-policy",
});

const LIST_STYLE = "public-legal-list-item";
const DASH = <span className="public-legal-bullet">&bull;</span>;

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="public-page-intro">
        <div className="public-container">
          <>
            <h1>Privacy Policy</h1>
          </>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-legal-body">
          <>
            <div className="public-legal-content">
              {/* 1. Data Controller */}
              <div>
                <h2>1. Data Controller</h2>
                <p>
                  {SITE_CONFIG.legalName} is the data controller responsible for
                  your personal data. We are a private limited company
                  registered in England and Wales (company number{" "}
                  {SITE_CONFIG.companyNumber}), with our registered office at{" "}
                  {SITE_CONFIG.registeredOffice}.
                </p>
                <p>
                  If you have questions about this policy or wish to exercise
                  your data protection rights, contact us at{" "}
                  <a href={`mailto:${SITE_CONFIG.email}`}>
                    {SITE_CONFIG.email}
                  </a>
                  .
                </p>
              </div>

              {/* 2. Data We Collect */}
              <div>
                <h2>2. Data We Collect</h2>
                <p>
                  We collect personal data only where it is necessary and
                  proportionate. The categories of data we process are:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Contact information</strong> ,name, email address,
                      telephone number, and firm or organisation name, submitted
                      through our contact form or direct correspondence.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Dispute information</strong> ,the nature,
                      approximate value, forum, and brief summary of your
                      matter, as you choose to provide it.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Claims Intelligence access</strong> ,login
                      credentials and usage data for clients with active
                      dashboard access.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Technical data</strong> ,IP address, browser type,
                      device information, and pages visited. This data is
                      collected automatically when you use the website.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 3. How We Use Your Data */}
              <div>
                <h2>3. How We Use Your Data</h2>
                <p>
                  We process your personal data for the following purposes and
                  on the following legal bases:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>To respond to enquiries</strong> ,processing is
                      necessary for our legitimate interests in responding to
                      potential clients and conducting conflict checks.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>To perform our services</strong> ,processing is
                      necessary for the performance of a contract or to take
                      steps at your request prior to entering into a contract.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>To improve our website</strong> ,processing of
                      technical data is based on our legitimate interest in
                      maintaining and improving the website experience.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>To comply with legal obligations</strong>{" "}
                      ,including anti-money laundering checks and professional
                      regulatory requirements.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 4. Cookies */}
              <div>
                <h2>4. Cookies</h2>
                <p>
                  This website uses only strictly necessary cookies required for
                  the website to function. We do not use advertising cookies or
                  third-party tracking cookies. No cookie consent is required
                  for strictly necessary cookies under the Privacy and
                  Electronic Communications Regulations 2003 (PECR).
                </p>
              </div>

              {/* 5. Data Sharing */}
              <div>
                <h2>5. Data Sharing</h2>
                <p>
                  We do not sell, rent, or share your personal data with third
                  parties for their marketing purposes. We may share your data
                  with:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Our hosting and infrastructure providers, who process data
                      on our behalf under appropriate data processing
                      agreements.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Professional advisers (solicitors, accountants, insurers)
                      where necessary for the provision of our services or
                      compliance with professional obligations.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Regulatory bodies or law enforcement agencies where
                      required by law.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 6. Data Storage & Security */}
              <div>
                <h2>6. Data Storage &amp; Security</h2>
                <p>
                  Your personal data is stored on secure servers within the
                  United Kingdom or European Economic Area. We implement
                  appropriate technical and organisational measures to protect
                  your data against unauthorised access, alteration, disclosure,
                  or destruction.
                </p>
                <p>
                  Client data relating to active matters is isolated on a
                  per-matter basis. No client data is used for cross-matter
                  analysis, model training, or any purpose beyond the specific
                  instruction.
                </p>
              </div>

              {/* 7. Data Retention */}
              <div>
                <h2>7. Data Retention</h2>
                <p>
                  Contact form enquiries are retained for up to six years from
                  the date of submission, consistent with the limitation period
                  for contractual claims under English law. Data relating to
                  active matters is retained in accordance with our professional
                  obligations and the terms of each engagement. You may request
                  earlier deletion where no legitimate retention ground applies.
                </p>
              </div>

              {/* 8. Your Rights */}
              <div>
                <h2>8. Your Rights</h2>
                <p>
                  Under the UK General Data Protection Regulation (UK GDPR) and
                  the Data Protection Act 2018, you have the following rights:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Access</strong>,the right to request a copy of the
                      personal data we hold about you.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Rectification</strong> — the right to request
                      correction of inaccurate or incomplete data.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Erasure</strong>,the right to request deletion of
                      your data where there is no legitimate reason for us to
                      continue processing it.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Restriction</strong> — the right to request that
                      we restrict processing of your data in certain
                      circumstances.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Portability</strong> — the right to request
                      transfer of your data to another organisation in a
                      structured, machine-readable format.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Objection</strong>,the right to object to
                      processing based on legitimate interests.
                    </span>
                  </li>
                </ul>
                <p>
                  To exercise any of these rights, contact{" "}
                  <a href={`mailto:${SITE_CONFIG.email}`}>
                    {SITE_CONFIG.email}
                  </a>
                  . We will respond within one month.
                </p>
              </div>

              {/* 9. Complaints */}
              <div>
                <h2>9. Complaints</h2>
                <p>
                  If you are dissatisfied with how we handle your personal data,
                  you have the right to lodge a complaint with the Information
                  Commissioner&apos;s Office (ICO):
                </p>
                <p className="public-meta">
                  Information Commissioner&apos;s Office
                  <br />
                  Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF
                  <br />
                  <a
                    href="https://ico.org.uk"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ico.org.uk
                  </a>
                </p>
              </div>

              {/* 10. Changes */}
              <div>
                <h2>10. Changes to This Policy</h2>
                <p>
                  We may update this privacy policy from time to time. Any
                  changes will be posted on this page with an updated effective
                  date. Continued use of the website following changes
                  constitutes acceptance of the revised policy.
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
