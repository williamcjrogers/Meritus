"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import type { QuestionSource } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/portal/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { Eyebrow } from "./Eyebrow";

export type AskMessage = UIMessage<{ sources?: QuestionSource[] }>;

function messageText(message: AskMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Sources shown under an answer: persisted ones, or those gathered from the tools it called. */
export function sourcesOf(message: AskMessage): QuestionSource[] {
  if (message.metadata?.sources?.length) return message.metadata.sources;
  const found: QuestionSource[] = [];
  const seen = new Set<string>();
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    const output = part.output as { sources?: unknown; title?: unknown } | undefined;
    if (part.type === "tool-search_web" && Array.isArray(output?.sources)) {
      for (const url of output.sources) {
        if (typeof url !== "string") continue;
        const host = hostOf(url);
        if (seen.has(`host:${host}`)) continue;
        seen.add(`host:${host}`);
        found.push({ label: host, url });
      }
    } else if (part.type === "tool-read_document" && typeof output?.title === "string") {
      const key = `doc:${output.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label: output.title, url: null });
    }
  }
  return found;
}

function toolLabels(message: AskMessage): string[] {
  const labels: string[] = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;
    const name = part.type.replace(/^tool-/, "").replace(/_/g, " ");
    if (!labels.includes(name)) labels.push(name);
  }
  return labels;
}

/**
 * Questions about the pursuit, grounded on the brief, the notes and the files.
 * Built on a native dialog so focus is trapped and Escape closes.
 */
export function AskDrawer({
  pursuitId,
  initialMessages,
  open,
  onClose,
  onSaveNote,
  onClear,
}: {
  pursuitId: string;
  initialMessages: AskMessage[];
  open: boolean;
  onClose: () => void;
  onSaveNote: (text: string) => Promise<ActionResult> | ActionResult;
  onClear: () => Promise<ActionResult> | ActionResult;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<AskMessage>({ api: `/api/portal/pursuits/${pursuitId}/questions`, credentials: "same-origin" }),
    [pursuitId]
  );
  const { messages, sendMessage, status, error, setMessages } = useChat<AskMessage>({ transport, messages: initialMessages });
  const [input, setInput] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (error && lastSent && !input) setInput(lastSent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, status]);

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setLastSent(text);
    setInput("");
    setSaveError(null);
    void sendMessage({ text });
  }

  async function saveNote(message: AskMessage) {
    const text = messageText(message);
    if (!text) return;
    setSaveError(null);
    const result = await onSaveNote(text);
    if (result.ok) setSavedIds((current) => new Set(current).add(message.id));
    else setSaveError(result.error);
  }

  async function clearThread() {
    if (clearing) return;
    setClearing(true);
    setSaveError(null);
    try {
      const result = await onClear();
      if (result.ok) { setMessages([]); setConfirmClear(false); }
      else setSaveError(result.error);
    } catch { setSaveError("The questions could not be cleared. Check your connection and try again."); }
    finally { setClearing(false); }
  }

  return (
    <dialog
      ref={ref}
      className="portal-dialog portal-drawer"
      style={{ ["--drawer-width" as string]: "440px" }}
      aria-label="Ask about this pursuit"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex h-full flex-col bg-surface text-text shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <Eyebrow rule={false}>Ask</Eyebrow>
            <h2 className="mt-1 font-sans text-2xl text-primary">About this pursuit</h2>
            <p className="mt-1 text-[13px] text-muted">Grounded on the brief, the notes and the files. Inference is marked as such.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button type="button" onClick={onClose} className="app-button app-button--ghost">
              Close
            </button>
            {messages.length > 0 && (
              <button type="button" onClick={() => setConfirmClear(true)} className="app-button app-button--ghost text-muted" disabled={busy}>
                Clear
              </button>
            )}
          </div>
        </header>

        <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <p className="text-[13px] text-muted">Ask what the enquiry is really about, what the letter of claim says, or who the counterparty is.</p>
          )}
          {messages.map((message) => {
            const text = messageText(message);
            const sources = message.role === "assistant" ? sourcesOf(message) : [];
            const tools = message.role === "assistant" ? toolLabels(message) : [];
            return (
              <article key={message.id} className={message.role === "user" ? "pl-6" : ""}>
                <p className="font-sans text-[13px]   text-muted">{message.role === "user" ? "You" : "Assistant"}</p>
                {tools.length > 0 && <p className="mt-1 font-sans text-[13px]  text-muted">{tools.join(" · ")}</p>}
                {text ? (
                  <p className={`mt-1 whitespace-pre-wrap text-[15px] leading-relaxed ${message.role === "user" ? "text-muted" : "text-text"}`}>{text}</p>
                ) : (
                  message.role === "assistant" && busy && <p className="mt-1 text-[13px] text-muted">Thinking…</p>
                )}
                {sources.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-sans text-[13px]  text-muted">
                    {sources.map((source, index) => (
                      <li key={`${source.label}-${index}`}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                            {source.label} <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          source.label
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {message.role === "assistant" && text && !busy && (
                  <button
                    type="button"
                    className="app-button app-button--ghost mt-2 text-[13px]"
                    onClick={() => void saveNote(message)}
                    disabled={savedIds.has(message.id)}
                  >
                    {savedIds.has(message.id) ? "Saved as note" : "Save as note"}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <form noValidate
          className="border-t border-line px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="sr-only">Your question</span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="app-field"
                placeholder="Ask about the company, the documents or the dispute"
                aria-label="Your question"
                disabled={busy}
              />
            </label>
            <button type="submit" className="app-button app-button--secondary shrink-0" disabled={busy || !input.trim()}>
              {busy ? "Working…" : "Send"}
            </button>
          </div>
          {(error || saveError) && (
            <p className="mt-2 text-[13px] text-danger">{saveError ?? error?.message ?? "The assistant could not reply. Try again."}</p>
          )}
        </form>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear this thread?"
        body={<><p>The questions and answers are deleted. Notes you saved from them stay on the timeline.</p>{saveError && <p role="alert" className="mt-3 text-danger">{saveError}</p>}</>}
        confirmLabel="Clear"
        danger
        pending={clearing}
        onConfirm={() => void clearThread()}
        onCancel={() => setConfirmClear(false)}
      />
    </dialog>
  );
}
