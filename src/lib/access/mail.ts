import { Resend, type CreateEmailRequestOptions } from "resend";
import { isResendConfigured } from "@/lib/env";
import { ALERT_TIMEOUT_MS, alertFrom } from "@/lib/portal/alerts";

export type AccessMailOutcome = { sentAt: string } | { error: string };

export function accessMailSubject(): string {
  return "Your Meritus file link";
}

export function accessMailText(url: string): string {
  const origin = url.split("/access/")[0];
  return [
    "Use this link within 30 minutes to open your Meritus upload desk:",
    "",
    url,
    "",
    `The link works once. If it has expired, request another at ${origin}/access.`,
    "",
    "If you did not request it, ignore this email.",
    "",
    "Meritus Via",
  ].join("\n");
}

/** Same client, sender, timeout and outcome style as the enquiry alert. Never throws. */
export async function sendAccessLink(input: { to: string; url: string }): Promise<AccessMailOutcome> {
  if (!isResendConfigured()) return { error: "Resend is not configured" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AccessMailOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` }),
      ALERT_TIMEOUT_MS
    );
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const options = { signal: AbortSignal.timeout(ALERT_TIMEOUT_MS) } as CreateEmailRequestOptions;
    const request = resend.emails
      .send(
        { from: alertFrom(), to: [input.to], subject: accessMailSubject(), text: accessMailText(input.url) },
        options
      )
      .then(({ error }): AccessMailOutcome => {
        if (error) return { error: `${error.name}: ${error.message}` };
        return { sentAt: new Date().toISOString() };
      });
    return await Promise.race([request, timeout]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
