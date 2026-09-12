import type { ExtractedEvidence } from '../contracts';
import { xmlTree, descendants, localName, xmlText, type XmlNode } from '../extract/xml';
export function parseLegalDocMl(xml: string): ExtractedEvidence { const nodes = xmlTree(xml); if (!descendants(nodes, 'akomaNtoso').some(n => n.namespace === 'http://docs.oasis-open.org/legaldocml/ns/akn/3.0'))
    throw new Error('Expected LegalDocML akomaNtoso root'); const passages: ExtractedEvidence['passages'] = [], facts: ExtractedEvidence['facts'] = []; const walk = (items: XmlNode[]) => { for (const node of items) {
    const name = localName(node);
    if (name === 'paragraph' || name === 'table') {
        const number = descendants(node.children, 'num')[0];
        const locator = { kind: 'paragraph' as const, value: node.attributes.eId ?? (number ? xmlText(number) : `${name}-${passages.length + 1}`) };
        passages.push({ locator, text: name==='table'?descendants(node.children,'tr').map(row=>row.children.filter(cell=>['td','th'].includes(localName(cell))).map(xmlText).join(' | ')).join('\n')||xmlText(node):xmlText(node).replace(/\s+/g, ' ').trim() });
        for (const ref of descendants(node.children, 'ref')) {
            const refLocator = { kind: 'field' as const, value: ref.attributes.eId ?? `ref-${facts.length + 1}` };
            const text = xmlText(ref).trim();
            if (text) {
                passages.push({ locator: refLocator, text });
                facts.push({ predicate: 'case.ref', value: { text, ...ref.attributes }, locator: refLocator, status: 'observation' });
            }
        }
        continue;
    }
    if (['party', 'court', 'judge', 'date', 'docDate', 'ref', 'FRBRdate'].includes(name)) {
        const value = xmlText(node).trim() || node.attributes.date || node.attributes.href;
        const locator = { kind: 'field' as const, value: node.attributes.eId ?? `${name}-${facts.length + 1}` };
        if (value) {
            passages.push({ locator, text: value });
            facts.push({ predicate: 'case.' + name, value: { text: value, ...node.attributes }, locator, status: 'observation' });
        }
    }
    walk(node.children);
} }; walk(nodes); return { passages, facts, coverage: { complete: passages.some(p => p.locator.kind === 'paragraph'), notes: passages.some(p => p.locator.kind === 'paragraph') ? [] : ['No structured paragraphs were available; manual verification is required.'] } }; }
