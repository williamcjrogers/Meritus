import { xmlTree, descendants, xmlText, localName } from '../extract/xml';
import type { CaseSearch, CaseFeedEntry } from './types';
export type { CaseSearch, CaseFeedEntry } from './types';
export function caseFeedUrl(input: CaseSearch, order: '-transformation' | '-updated'): string { const url = new URL('https://caselaw.nationalarchives.gov.uk/atom.xml'); url.searchParams.set('minimum_availability', 'document'); url.searchParams.set('per_page', '50'); url.searchParams.set('order', order); for (const court of input.courts ?? [])
    url.searchParams.append('court', court); if (input.query)
    url.searchParams.set('query', input.query); if (input.citation)
    url.searchParams.set('query', [input.query, input.citation].filter(Boolean).join(' ')); for (const key of ['party', 'judge'] as const)
    if (input[key])
        url.searchParams.set(key, input[key]!); return url.href; }
export function parseAtom(xml: string): {
    entries: CaseFeedEntry[];
    next: string | null;
} { const nodes = xmlTree(xml), feed = descendants(nodes, 'feed')[0]; if (!feed || feed.namespace !== 'http://www.w3.org/2005/Atom')
    throw new Error('Missing Atom feed namespace'); const next = feed.children.find(n => localName(n) === 'link' && n.attributes.rel === 'next')?.attributes.href ?? null; const entries = feed.children.filter(n => localName(n) === 'entry').map(n => { const one = (name: string) => descendants(n.children, name)[0]; const text = (name: string) => one(name) ? xmlText(one(name)!) : null; const links = descendants(n.children, 'link'); const uriNode = one('uri'); const uri = uriNode?.namespace === 'https://caselaw.nationalarchives.gov.uk' ? xmlText(uriNode) : null; if (!uri)
    throw new Error('Missing stable Find Case Law URI'); return { uri, title: text('title') ?? uri, identifiers: descendants(n.children, 'identifier').filter(i => i.namespace === 'https://caselaw.nationalarchives.gov.uk').map(i => ({ type: i.attributes.type ?? '', slug: i.attributes.slug ?? '', value: xmlText(i) })), xmlUrl: links.find(l => l.attributes.type === 'application/akn+xml')?.attributes.href ?? null, pdfUrl: links.find(l => l.attributes.type === 'application/pdf')?.attributes.href ?? null, publishedAt: text('published'), transformedAt: text('updated'), contentHash: text('contenthash') }; }); return { entries, next }; }
