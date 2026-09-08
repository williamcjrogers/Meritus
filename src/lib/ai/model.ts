import { gateway } from "ai";
import { openai } from "@ai-sdk/openai";
import { isAiConfigured } from "@/lib/env";

export function getLanguageModel() {
  if (process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini");
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    return gateway("openai/gpt-4o-mini");
  }
  throw new Error("AI is not configured");
}

export function getResearchModel() {
  if (process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini-search-preview");
  }
  return getLanguageModel();
}

export function assertAiConfigured(): void {
  if (!isAiConfigured()) {
    throw new Error("OPENAI_API_KEY or AI_GATEWAY_API_KEY is not configured");
  }
}
