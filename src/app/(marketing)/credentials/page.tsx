import { PublicIntro } from "@/components/ui/PublicIntro";
import { Button } from "@/components/ui/Button";
export default function CredentialsPage() {
  return (
    <>
      <PublicIntro
        title="The right experience for your instruction."
        label="Credentials"
        description="Request professional biographies and relevant experience to help assess an appointment."
      />
      <section className="public-section">
        <div className="public-container public-text-split">
          <div>
            <h2>Request a credentials pack.</h2>
            <p>
              Tell us the discipline, sector and proposed role. We can discuss
              which information is relevant and what can be shared.
            </p>
            <Button href="/contact?enquiry=credentials">
              Request credentials
            </Button>
          </div>
          <div className="public-credentials-list">
            <h3>Information to discuss</h3>
            <dl>
              <dt>Professional biographies</dt>
              <dd>Qualifications, career history and areas of expertise.</dd>
              <dt>Relevant experience</dt>
              <dd>
                Experience appropriate to the sector and the proposed
                instruction, subject to confidentiality.
              </dd>
              <dt>Approach and outputs</dt>
              <dd>How the work would be scoped, reviewed and presented.</dd>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
