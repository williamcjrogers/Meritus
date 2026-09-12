import type { ExtractedEvidence } from '../contracts';
export async function extractPdf(body: Uint8Array): Promise<ExtractedEvidence> { if (body.length > 32 * 1024 * 1024)
    throw new Error('PDF byte limit exceeded'); if (new TextDecoder().decode(body.slice(0, 5)) !== '%PDF-')
    throw new Error('Invalid PDF signature'); const { PDFParse } = await import('pdf-parse'); const parser = new PDFParse({ data: body }); try {
    const info = await parser.getInfo();
    if (info.total > 1000)
        throw new Error('PDF page limit exceeded');
    const result = await parser.getText();
    const passages = result.pages.map(page => ({ locator: { kind: 'page' as const, value: String(page.num) }, text: page.text })).filter(page => page.text.trim());
    if (passages.reduce((n, p) => n + p.text.length, 0) > 10000000)
        throw new Error('PDF text limit exceeded');
    return { passages, facts: [], coverage: { complete: passages.length === info.total, notes: ['PDF extraction uses page locators; scanned or empty pages require manual review. Table layout may require verification.'] } };
}
finally {
    await parser.destroy();
} }
