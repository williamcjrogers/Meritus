import { Button } from "./Button";
interface CTABandProps {
  heading?: string;
  subtext?: string;
  buttonText?: string;
  buttonHref?: string;
  leftGraphic?: "numeral" | "monogram" | "none";
}
export function CTABand({
  heading = "A clear starting point for your matter.",
  subtext = "Tell us about the project, the issue and the decision ahead.",
  buttonText = "Discuss your matter",
  buttonHref = "/contact",
}: CTABandProps) {
  return (
    <section className="public-enquiry">
      <div className="public-container public-enquiry-inner">
        <div>
          <h2>{heading}</h2>
          <p>{subtext}</p>
        </div>
        <Button href={buttonHref}>{buttonText}</Button>
      </div>
    </section>
  );
}
