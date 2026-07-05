import { FadeIn } from "@/components/animations";
import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "Meritus Via privacy policy. How we collect, use, store, and protect your personal data under UK GDPR.",
  path: "/privacy-policy",
});

const LIST_STYLE = "flex items-start gap-2";
const DASH = <span className="text-brass/50 mt-0.5 shrink-0">&mdash;</span>;

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <h1 className="font-serif text-4xl text-cream italic">
              Privacy Policy
            </h1>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[800px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="space-y-10 text-[15px] text-slate leading-relaxed">
              {/* 1. Data Controller */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  1. Data Controller
                </h2>
                <p>
                  {SITE_CONFIG.legalName} is the data controller responsible for
                  your personal data. We are a limited liability partnership
                  registered in England and Wales.
                </p>
                <p className="mt-3">
                  If you have questions about this policy or wish to exercise your
                  data protection rights, contact us at{" "}
                  <a
                    href={`mailto:${SITE_CONFIG.email}`}
                    className="text-brass hover:underline"
                  >
                    {SITE_CONFIG.email}
                  </a>
                  .
                </p>
              </div>

              {/* 2. Data We Collect */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  2. Data We Collect
                </h2>
                <p className="mb-3">
                  We collect personal data only where it is necessary and
                  proportionate. The categories of data we process are:
                </p>
                <ul className="space-y-2 list-none">
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Contact information</strong>{" "}
                     ,name, email address, telephone number, and firm or
                      organisation name, submitted through our contact form or
                      direct correspondence.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Dispute information</strong>{" "}
                     ,the nature, approximate value, forum, and brief summary of
                      your matter, as you choose to provide it.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Claims Intelligence access</strong>{" "}
                     ,login credentials and usage data for clients with active
                      dashboard access.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Technical data</strong>{" "}
                     ,IP address, browser type, device information, and pages
                      visited. This data is collected automatically when you use
                      the website.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 3. How We Use Your Data */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  3. How We Use Your Data
                </h2>
                <p className="mb-3">
                  We process your personal data for the following purposes and on
                  the following legal bases:
                </p>
                <ul className="space-y-2 list-none">
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">To respond to enquiries</strong>{" "}
                     ,processing is necessary for our legitimate interests in
                      responding to potential clients and conducting conflict
                      checks.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">To perform our services</strong>{" "}
                     ,processing is necessary for the performance of a contract
                      or to take steps at your request prior to entering into a
                      contract.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">To improve our website</strong>{" "}
                     ,processing of technical data is based on our legitimate
                      interest in maintaining and improving the website experience.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">To comply with legal obligations</strong>{" "}
                     ,including anti-money laundering checks and professional
                      regulatory requirements.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 4. Cookies */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  4. Cookies
                </h2>
                <p>
                  This website uses only strictly necessary cookies required for
                  the website to function. We do not use advertising cookies or
                  third-party tracking cookies. No cookie consent is required for
                  strictly necessary cookies under the Privacy and Electronic
                  Communications Regulations 2003 (PECR).
                </p>
              </div>

              {/* 5. Data Sharing */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  5. Data Sharing
                </h2>
                <p>
                  We do not sell, rent, or share your personal data with third
                  parties for their marketing purposes. We may share your data
                  with:
                </p>
                <ul className="mt-3 space-y-2 list-none">
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Our hosting and infrastructure providers, who process data
                      on our behalf under appropriate data processing agreements.
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
                      Regulatory bodies or law enforcement agencies where required
                      by law.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 6. Data Storage & Security */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  6. Data Storage &amp; Security
                </h2>
                <p>
                  Your personal data is stored on secure servers within the United
                  Kingdom or European Economic Area. We implement appropriate
                  technical and organisational measures to protect your data
                  against unauthorised access, alteration, disclosure, or
                  destruction.
                </p>
                <p className="mt-3">
                  Client data relating to active matters is isolated on a
                  per-matter basis. No client data is used for cross-matter
                  analysis, model training, or any purpose beyond the specific
                  instruction.
                </p>
              </div>

              {/* 7. Data Retention */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  7. Data Retention
                </h2>
                <p>
                  Contact form enquiries are retained for up to six years from the
                  date of submission, consistent with the limitation period for
                  contractual claims under English law. Data relating to active
                  matters is retained in accordance with our professional
                  obligations and the terms of each engagement. You may request
                  earlier deletion where no legitimate retention ground applies.
                </p>
              </div>

              {/* 8. Your Rights */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  8. Your Rights
                </h2>
                <p className="mb-3">
                  Under the UK General Data Protection Regulation (UK GDPR) and
                  the Data Protection Act 2018, you have the following rights:
                </p>
                <ul className="space-y-2 list-none">
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Access</strong>,the
                      right to request a copy of the personal data we hold about
                      you.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Rectification</strong> —
                      the right to request correction of inaccurate or incomplete
                      data.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Erasure</strong>,the
                      right to request deletion of your data where there is no
                      legitimate reason for us to continue processing it.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Restriction</strong> —
                      the right to request that we restrict processing of your
                      data in certain circumstances.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Portability</strong> —
                      the right to request transfer of your data to another
                      organisation in a structured, machine-readable format.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong className="text-green/80">Objection</strong>,the
                      right to object to processing based on legitimate interests.
                    </span>
                  </li>
                </ul>
                <p className="mt-4">
                  To exercise any of these rights, contact{" "}
                  <a
                    href={`mailto:${SITE_CONFIG.email}`}
                    className="text-brass hover:underline"
                  >
                    {SITE_CONFIG.email}
                  </a>
                  . We will respond within one month.
                </p>
              </div>

              {/* 9. Complaints */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  9. Complaints
                </h2>
                <p>
                  If you are dissatisfied with how we handle your personal data,
                  you have the right to lodge a complaint with the Information
                  Commissioner&apos;s Office (ICO):
                </p>
                <p className="mt-3 font-mono text-[12px] text-slate/70">
                  Information Commissioner&apos;s Office<br />
                  Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF<br />
                  <a
                    href="https://ico.org.uk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brass hover:underline"
                  >
                    ico.org.uk
                  </a>
                </p>
              </div>

              {/* 10. Changes */}
              <div>
                <h2 className="font-serif text-xl text-green italic mb-3">
                  10. Changes to This Policy
                </h2>
                <p>
                  We may update this privacy policy from time to time. Any changes
                  will be posted on this page with an updated effective date.
                  Continued use of the website following changes constitutes
                  acceptance of the revised policy.
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
