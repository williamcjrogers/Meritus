import type { UIMessage, UIMessagePart } from "ai";
import type { QuestionSource } from "@/lib/db/schema";

/** The shape shared by every tool part once the tool has returned. */
type LoosePart = { type: string; state?: string; output?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hostLabel(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

/**
 * Sources an answer drew on, read from the response message's tool parts:
 * search_web output urls become {label: host, url}; read_document output
 * titles become {label: title}. Duplicates are dropped in first-seen order.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectSources(parts: UIMessagePart<any, any>[]): QuestionSource[] {
  const found: QuestionSource[] = [];
  const seen = new Set<string>();
  const add = (source: QuestionSource) => {
    // One entry per host keeps the list readable; the first page seen on a host stands for it.
    const key = source.url ? `host:${source.label}` : `label:${source.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(source);
  };

  for (const raw of parts) {
    const part = raw as LoosePart;
    if (part.state !== "output-available" || !isRecord(part.output)) continue;
    if (part.type === "tool-search_web") {
      const urls = Array.isArray(part.output.sources) ? part.output.sources : [];
      for (const url of urls) {
        if (typeof url !== "string") continue;
        const label = hostLabel(url);
        if (label) add({ label, url });
      }
    } else if (part.type === "tool-read_document") {
      const title = part.output.title;
      if (typeof title === "string" && title.trim()) add({ label: title.trim() });
    }
  }
  return found;
}

/** Nothing is stored on abort, on failure or when the answer is empty. */
export function shouldPersist(event: {
  isAborted: boolean;
  outcome: { status: string };
  text: string;
}): boolean {
  return !event.isAborted && event.outcome.status === "completed" && event.text.trim().length > 0;
}

/** The message's text parts joined with a blank line, trimmed. */
export function finalText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/** The same collection, read from streamText's step results rather than UI parts. */
export function collectSourcesFromSteps(
  steps: ReadonlyArray<{ toolResults?: ReadonlyArray<{ toolName: string; output: unknown }> }>
): QuestionSource[] {
  const parts: LoosePart[] = [];
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      parts.push({ type: `tool-${result.toolName}`, state: "output-available", output: result.output });
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return collectSources(parts as UIMessagePart<any, any>[]);
}
