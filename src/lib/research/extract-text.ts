import { PDFParse } from "pdf-parse";

const MAX_CHARS = 50_000;

export async function extractUploadText(file: File): Promise<string | null> {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    const text = await file.text();
    return text.slice(0, MAX_CHARS);
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return (result.text ?? "").slice(0, MAX_CHARS) || null;
    } finally {
      await parser.destroy();
    }
  }

  return null;
}
