import type { Address, Email } from "postal-mime";
import { fullDate, TIME_ZONE } from "@/lib/portal/dates";

// The parsers load on demand, inside the branch that needs them, so a parser that cannot
// initialise on the serverless runtime only affects its own file type rather than every upload.

const MAX_CHARS = 50_000;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EML_MIME = "message/rfc822";

/**
 * Text for the questions drawer: pdf, docx, eml and txt yield text; xlsx,
 * images and Outlook .msg files are stored without it and return null.
 * A file its parser cannot read is stored without text rather than refused.
 */
export async function extractUploadText(file: File): Promise<string | null> {
  if (matches(file, "text/plain", ".txt")) {
    return clip(await file.text());
  }

  if (matches(file, "application/pdf", ".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let parser: { getText(): Promise<{ text?: string }>; destroy(): Promise<void> } | null = null;
    try {
      const { PDFParse } = await import("pdf-parse");
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return clip(result.text ?? "");
    } catch (error) {
      console.warn("pdf extraction failed", file.name, error);
      return null;
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  }

  if (matches(file, DOCX_MIME, ".docx")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return clip(result.value);
    } catch (error) {
      console.warn("docx extraction failed", file.name, error);
      return null;
    }
  }

  if (matches(file, EML_MIME, ".eml")) {
    try {
      const email = await (await import("postal-mime")).default.parse(await file.arrayBuffer());
      return clip(renderEmail(email));
    } catch (error) {
      console.warn("eml extraction failed", file.name, error);
      return null;
    }
  }

  return null;
}

function matches(file: File, mime: string, ext: string): boolean {
  return file.type === mime || file.name.toLowerCase().endsWith(ext);
}

function clip(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, MAX_CHARS) : null;
}

/** "From, To, Date, Subject" as a header block, a blank line, then the text part. */
function renderEmail(email: Email): string {
  const header = [
    ["From", email.from ? formatAddress(email.from) : ""],
    ["To", (email.to ?? []).map(formatAddress).join(", ")],
    ["Date", email.date ? formatEmailDate(email.date) : ""],
    ["Subject", email.subject ?? ""],
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const body = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
  return header && body ? `${header}\n\n${body}` : header || body;
}

function formatAddress(address: Address): string {
  if (address.group) {
    const members = address.group.map(formatAddress).join(", ");
    return members ? `${address.name}: ${members}` : address.name;
  }
  if (address.name && address.address) return `${address.name} <${address.address}>`;
  return address.address || address.name;
}

/** "09 September 2026 09:02" in London time; the raw header when it cannot be parsed. */
function formatEmailDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${fullDate(date)} ${time}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
