import { generateText } from "ai";
import { getResearchModel } from "@/lib/ai/model";

export async function searchWeb(prompt: string): Promise<{ text: string; sources: string[] }> {
  const result = await generateText({
    model: getResearchModel(),
    prompt,
  });
  const sources = (result.sources ?? []).flatMap((source) => {
    if (source && typeof source === "object" && "url" in source && source.url) {
      return [String(source.url)];
    }
    return [];
  });
  return { text: result.text, sources };
}
