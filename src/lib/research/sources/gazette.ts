import type { SourceConnector } from '../contracts';
import { ResearchFetchError } from '../errors';
import { acquire, envelope, checkedNext } from './common';
import { decodeUtf8, xmlTree, descendants, xmlText } from '../extract/xml';
export function gazetteAllowedAt(now: Date): boolean { const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(now)); return hour >= 21 || hour < 7; }
/** Publisher taxonomy: https://www.thegazette.co.uk/noticecodes, checked 12 September 2026. */
export function classifyInsolvency(code:string):'petition'|'order'|'appointment'|'resolution'|'other'{return ['2450','2451'].includes(code)?'petition':['2411','2452','2453'].includes(code)?'order':['2410','2421','2423','2432','2443','2454'].includes(code)?'appointment':['2431','2441'].includes(code)?'resolution':'other';}

export function gazetteRobotsAllows(text: string, path: string): boolean { if (/\/notice\/[^/]+\/data\.(xml|pdf|rdf|ttl|jsonld)$/.test(path))
    return false; let agents: string[] = [], rules: {
    allow: boolean;
    value: string;
}[] = [], groupStarted = false; const groups: {
    agents: string[];
    rules: {
        allow: boolean;
        value: string;
    }[];
}[] = []; for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0], colon = line.indexOf(':');
    if (colon < 0)
        continue;
    const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
        if (groupStarted) {
            groups.push({ agents, rules });
            agents = [];
            rules = [];
            groupStarted = false;
        }
        agents.push(value.toLowerCase());
    }
    else if (key === 'disallow' || key === 'allow') {
        groupStarted = true;
        if (value)
            rules.push({ allow: key === 'allow', value });
    }
} groups.push({ agents, rules }); const specific = groups.filter(g => g.agents.some(a => a !== '*' && 'qcs-research'.startsWith(a))); const applicable = specific.length ? specific : groups.filter(g => g.agents.includes('*')); const matched = applicable.flatMap(g => g.rules).filter(r => { const pattern = r.value.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$'); return new RegExp('^' + pattern).test(path); }).sort((a, b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow)); return matched[0]?.allow ?? true; }
export function createGazetteConnector(selection: {
    noticeTypes: string[];
}): SourceConnector {
    return { provider: 'gazette', async fetchPage(context) {
            if (!gazetteAllowedAt(new Date()))
                throw new ResearchFetchError('gazette_outside_access_window', null, 3600000);
            const base = new URL('https://www.thegazette.co.uk/insolvency/notice/data.feed');
            base.searchParams.set('noticetype', selection.noticeTypes.join(','));
            base.searchParams.set('start-publish-date', context.window.from.slice(0, 10));
            base.searchParams.set('end-publish-date', context.window.to.slice(0, 10));
            base.searchParams.set('results-page-size', '100');
            const cursor = context.cursor ? JSON.parse(context.cursor) : null;
            if (!cursor) {
                const robots = await acquire(context, 'https://www.thegazette.co.uk/robots.txt', 1048576);
                if (robots.status !== 200 || !gazetteRobotsAllows(decodeUtf8(robots.body), base.pathname))
                    throw new Error('Gazette robots policy does not permit this feed');
                return { records: [], nextCursor: JSON.stringify({ url: base.href, robotsCheckedAt: Date.now(), lastRequestAt: Date.now(), minimumDelayMs: Math.max(10000, ...[...decodeUtf8(robots.body).matchAll(/crawl-delay:\s*(\d+(?:\.\d+)?)/gi)].map(m => Number(m[1]) * 1000)) }), coverage: { complete: true, notes: ['Robots policy checked; feed request follows the shared crawl delay.'] } };
            }
            if (!Number.isFinite(cursor.robotsCheckedAt) || Date.now() - cursor.robotsCheckedAt > 86400000)
                throw new Error('Gazette robots review expired');
            const wait = Number(cursor.minimumDelayMs ?? 10000) - (Date.now() - Number(cursor.lastRequestAt ?? cursor.robotsCheckedAt));
            if (wait > 0)
                throw new ResearchFetchError('gazette_crawl_delay', 429, wait);
            const url = checkedNext(cursor.url, base.href, ['start-publish-date', 'end-publish-date', 'noticetype'])!;
            const response = await acquire(context, url);
            if (response.status !== 200)
                throw new Error('Gazette feed unavailable');
            const nodes = xmlTree(decodeUtf8(response.body));
            const entries = descendants(nodes, 'entry');
            const records = entries.map(entry => { const id = descendants(entry.children, 'id')[0]; if (!id)
                throw new Error('Gazette entry identity missing'); const published = descendants(entry.children, 'published')[0]; const record = envelope(context, xmlText(id), url, response.body, response.contentType, { noticeTypeFilters: selection.noticeTypes, entryId: xmlText(id) }); record.publishedAt = published ? xmlText(published) : null; return record; });
            const feed = descendants(nodes, 'feed')[0];
            if (!feed)
                throw new Error('Gazette Atom feed missing');
            const next = feed.children.find(n => n.attributes.rel === 'next')?.attributes.href ?? null;
            return { records, nextCursor: next ? JSON.stringify({ ...cursor, lastRequestAt: Date.now(), url: checkedNext(next, base.href, ['start-publish-date', 'end-publish-date', 'noticetype']) }) : null, coverage: { complete: true, notes: ['Publication-date feed does not establish a complete correction or deletion log. Company and event identities require exact source evidence.'] } };
        } };
}
