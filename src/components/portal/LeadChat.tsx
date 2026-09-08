"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
}

function toolLabels(message: UIMessage): string[] {
  return message.parts.flatMap((part) => {
    if (!isToolUIPart(part)) return [];
    return [getToolName(part).replaceAll("_", " ")];
  });
}

export function LeadChat({
  leadId,
  initialMessages,
}: {
  leadId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/portal/leads/${leadId}/chat`,
        credentials: "same-origin",
      }),
    [leadId]
  );
  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      router.refresh();
    },
  });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  return (
    <section className="bg-parchment border border-green/10 p-6 flex flex-col min-h-[420px]">
      <h2 className="font-serif text-2xl text-green mb-4">Chat</h2>
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-1">
        {messages.map((message) => {
          const text = messageText(message);
          const tools = toolLabels(message);
          return (
            <div key={message.id} className="text-[13px]">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/70 mb-1">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              {tools.length > 0 && (
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-slate">
                  {tools.join(" · ")}
                </p>
              )}
              {text ? (
                <p className="whitespace-pre-wrap leading-relaxed text-green/90">{text}</p>
              ) : (
                message.role === "assistant" &&
                busy && <p className="text-slate">Thinking…</p>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-3 text-[12px] text-oxblood">
          {error.message || "The assistant could not reply. Try again."}
        </p>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          void sendMessage({ text });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-b border-green/15 px-0 py-2 text-[14px] text-green focus:outline-none focus:border-brass"
          placeholder="Ask about the company, or paste a website…"
        />
        <button type="submit" disabled={busy} className="btn-outline text-[12px] disabled:opacity-40">
          Send
        </button>
      </form>
    </section>
  );
}
