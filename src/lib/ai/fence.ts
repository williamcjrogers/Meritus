/**
 * Named blocks that carry untrusted text into a prompt. Any closing or opening
 * tag for the same block inside the body is neutralised, so text submitted by
 * the public or read from an uploaded file cannot break out of its block.
 */
export function neutraliseTag(tag: string, body: string): string {
  const pattern = new RegExp(`<\\s*/?\\s*${tag}\\b`, "gi");
  return body.replace(pattern, (match) => match.replace("<", "‹"));
}

export function fencedBlock(tag: string, body: string, attributes: Record<string, string> = {}): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`)
    .join("");
  return [`<${tag}${attrs}>`, neutraliseTag(tag, body), `</${tag}>`].join("\n");
}
