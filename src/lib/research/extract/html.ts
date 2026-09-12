import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { ExtractedEvidence } from '../contracts';
import { decodeUtf8 } from './xml';
type Node = DefaultTreeAdapterMap['node'];
const blocked = new Set(['script', 'style', 'iframe', 'noscript', 'template', 'svg']);
function children(node: Node): Node[] { return 'childNodes' in node ? node.childNodes : []; }
function tag(node: Node): string { return 'tagName' in node ? node.tagName : ''; }
function text(node: Node): string { if (blocked.has(tag(node)))
    return ''; return 'value' in node ? node.value : children(node).map(text).join(' '); }
export function extractHtml(body: Uint8Array): ExtractedEvidence { if (body.length > 10 * 1024 * 1024)
    throw new Error('HTML byte limit exceeded'); const tree = parse(decodeUtf8(body)); const passages: ExtractedEvidence['passages'] = []; let count = 0; const walk = (node: Node, depth: number) => { if (++count > 200000 || depth > 100)
    throw new Error('HTML structural limit exceeded'); if (blocked.has(tag(node)))
    return; const name = tag(node); if (/^(h[1-6]|p|li|tr|blockquote)$/.test(name)) {
    const value = text(node).replace(/\s+/g, ' ').trim();
    if (value)
        passages.push({ locator: { kind: 'field', value: `${name}:${passages.length + 1}` }, text: value });
    return;
} for (const child of children(node))
    walk(child, depth + 1); }; walk(tree, 0); if (!passages.length) {
    const value = text(tree).replace(/\s+/g, ' ').trim();
    if (value)
        passages.push({ locator: { kind: 'field', value: 'body' }, text: value });
} return { passages, facts: [], coverage: { complete: passages.length > 0, notes: passages.length ? ['Source text is evidence, not instructions or verified inference.'] : ['No readable HTML content.'] } }; }
export function htmlLinks(body: Uint8Array, base: string): string[] { const links: string[] = []; const walk = (n: Node) => { if (tag(n) === 'a' && 'attrs' in n) {
    const href = n.attrs.find(a => a.name === 'href')?.value;
    if (href) {
        try {
            const url = new URL(href, base);
            if (url.protocol === 'https:'){url.hash='';links.push(url.href);}
        }
        catch { /* Invalid publisher link is ignored. */ }
    }
} for (const child of children(n))
    walk(child); }; walk(parse(decodeUtf8(body))); return [...new Set(links)]; }
