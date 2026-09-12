import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Accessibility",
  description:
    "Meritus Via accessibility statement. Our commitment to WCAG 2.1 Level AA conformance.",
  path: "/accessibility",
});

const LIST_STYLE = "public-legal-list-item";
const DASH = <span className="public-legal-bullet">&bull;</span>;

export default function AccessibilityPage() {
  return (
    <>
      <section className="public-page-intro">
        <div className="public-container">
          <>
            <h1>Accessibility Statement</h1>
          </>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-legal-body">
          <>
            <div className="public-legal-content">
              {/* 1. Our Commitment */}
              <div>
                <h2>1. Our Commitment</h2>
                <p>
                  {SITE_CONFIG.legalName} is committed to ensuring that our
                  website is accessible to all users, including those with
                  disabilities. We aim to conform to the Web Content
                  Accessibility Guidelines (WCAG) 2.1 at Level AA, in line with
                  the requirements of the Equality Act 2010.
                </p>
              </div>

              {/* 2. What We Do */}
              <div>
                <h2>2. Measures We Take</h2>
                <p>
                  We have implemented the following measures to support
                  accessibility:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Keyboard navigation</strong> ,all interactive
                      elements are reachable and operable via keyboard. A
                      skip-to-content link is provided to bypass repeated
                      navigation.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Focus indicators</strong> ,visible focus styles
                      are applied to all interactive elements for users
                      navigating by keyboard or assistive technology.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Colour contrast</strong> ,text and interactive
                      elements meet or exceed WCAG 2.1 Level AA contrast ratios
                      against their backgrounds.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Semantic HTML</strong> ,proper heading hierarchy,
                      landmark regions, and ARIA labels are used throughout to
                      support screen reader navigation.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Reduced motion</strong> ,animations are suppressed
                      for users who have enabled the{" "}
                      <code className="public-inline-code">
                        prefers-reduced-motion
                      </code>{" "}
                      setting in their operating system or browser.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Decorative content</strong> ,SVG visualisations,
                      animated terminal patterns, and background graphics are
                      marked with{" "}
                      <code className="public-inline-code">
                        aria-hidden=&quot;true&quot;
                      </code>{" "}
                      so they are not announced by screen readers.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Form labels</strong> ,all form inputs on the
                      contact page have associated labels and provide clear
                      error messaging for validation failures.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Responsive design</strong> ,the website adapts to
                      a range of screen sizes and zoom levels up to 200% without
                      loss of content or functionality.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 3. Known Limitations */}
              <div>
                <h2>3. Known Limitations</h2>
                <p>
                  While we strive for full conformance, we are aware of the
                  following areas where improvements may be needed:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Some animated SVG visualisations on the Services and
                      Method pages may not convey equivalent information to
                      screen reader users. The substantive content is presented
                      in adjacent text.
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      Third-party content accessed via the Claims Intelligence
                      dashboard is subject to its own accessibility standards
                      and may not fully conform to WCAG 2.1 Level AA.
                    </span>
                  </li>
                </ul>
                <p>We are actively working to address these limitations.</p>
              </div>

              {/* 4. Compatibility */}
              <div>
                <h2>4. Browser &amp; Assistive Technology Compatibility</h2>
                <p>
                  This website is designed to be compatible with the following:
                </p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}Current versions of Chrome, Firefox, Safari, and Edge
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}Screen readers including NVDA, JAWS, and VoiceOver
                  </li>
                  <li className={LIST_STYLE}>{DASH}Browser zoom up to 200%</li>
                  <li className={LIST_STYLE}>
                    {DASH}Mobile and tablet devices (iOS and Android)
                  </li>
                </ul>
              </div>

              {/* 5. Standards */}
              <div>
                <h2>5. Standards Applied</h2>
                <p>This website targets conformance with:</p>
                <ul>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>WCAG 2.1 Level AA</strong> ,Web Content
                      Accessibility Guidelines, published by the World Wide Web
                      Consortium (W3C).
                    </span>
                  </li>
                  <li className={LIST_STYLE}>
                    {DASH}
                    <span>
                      <strong>Equality Act 2010</strong> ,the UK legislation
                      requiring reasonable adjustments for disabled users of
                      services, including websites.
                    </span>
                  </li>
                </ul>
              </div>

              {/* 6. Feedback */}
              <div>
                <h2>6. Feedback &amp; Contact</h2>
                <p>
                  If you encounter any accessibility barriers on this website,
                  or if you require information in an alternative format, please
                  contact us:
                </p>
                <p className="public-meta">
                  Email:{" "}
                  <a href={`mailto:${SITE_CONFIG.email}`}>
                    {SITE_CONFIG.email}
                  </a>
                </p>
                <p>
                  We aim to respond to accessibility feedback within five
                  working days and to resolve reported issues within a
                  reasonable timeframe.
                </p>
              </div>

              {/* 7. Enforcement */}
              <div>
                <h2>7. Enforcement</h2>
                <p>
                  If you are not satisfied with our response to an accessibility
                  concern, you may contact the Equality Advisory and Support
                  Service (EASS):
                </p>
                <p className="public-meta">
                  <a
                    href="https://www.equalityadvisoryservice.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    equalityadvisoryservice.com
                  </a>
                </p>
              </div>

              <p className="public-meta">
                This statement was prepared in March 2026 and will be reviewed
                annually.
              </p>
            </div>
          </>
        </div>
      </section>
    </>
  );
}
