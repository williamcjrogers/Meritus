import { XMLParser, XMLValidator } from 'fast-xml-parser';
export type XmlNode = {
    name: string;
    namespace: string;
    attributes: Record<string, string>;
    children: XmlNode[];
    text: string;
};
export function decodeUtf8(body: Uint8Array): string { return new TextDecoder('utf-8', { fatal: true }).decode(body); }
export function parseSafeXml(text: string): unknown {
    if (Buffer.byteLength(text) > 10 * 1024 * 1024)
        throw new Error('XML byte limit exceeded');
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text))
        throw new Error('XML declarations are not permitted');
    const valid = XMLValidator.validate(text);
    if (valid !== true)
        throw new Error('Malformed XML');
    // Bound nesting before invoking the parser, including pathological deeply nested input.
    let depth = 0, nodes = 0;
    for (const match of text.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g)) {
        const tag = match[0];
        if (tag.startsWith('<?') || tag.startsWith('<!'))
            continue;
        if (tag.startsWith('</'))
            depth--;
        else {
            if (++nodes > 200000)
                throw new Error('XML node limit exceeded');
            if (!tag.endsWith('/>'))
                depth++;
        }
        if (depth > 100)
            throw new Error('XML depth limit exceeded');
    }
    return new XMLParser({ preserveOrder: true, ignoreAttributes: false, processEntities: false, trimValues: false, parseTagValue: false }).parse(text);
}
function decodeXmlValue(value:string):string{return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(_match,entity:string)=>{const predefined:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity in predefined)return predefined[entity];const point=entity.startsWith('#x')?Number.parseInt(entity.slice(2),16):Number.parseInt(entity.slice(1),10);if(!Number.isInteger(point)||point<0||point>0x10ffff||(point>=0xd800&&point<=0xdfff))throw new Error('Invalid XML character reference');return String.fromCodePoint(point);});}
export function xmlTree(text: string): XmlNode[] {
    const convert = (entries: Record<string, unknown>[], inherited: Record<string, string> = {}): XmlNode[] => entries.flatMap(entry => Object.entries(entry).filter(([name]) => name !== ':@' && !name.startsWith('?')).map(([name, value]) => { const attrs = entry[':@'] as Record<string, unknown> | undefined; const attributes = Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k.replace(/^@_/, ''), decodeXmlValue(String(v))])); const namespaces = { ...inherited }; for (const [key, uri] of Object.entries(attributes)) {
        if (key === 'xmlns')
            namespaces[''] = uri;
        else if (key.startsWith('xmlns:'))
            namespaces[key.slice(6)] = uri;
    } const prefix = name.includes(':') ? name.split(':')[0] : ''; return { name, namespace: namespaces[prefix] ?? '', attributes, text: name === '#text' ? decodeXmlValue(String(value)) : '', children: Array.isArray(value) ? convert(value, namespaces) : [] }; }));
    return convert(parseSafeXml(text) as Record<string, unknown>[]);
}
export const localName = (node: XmlNode) => node.name.split(':').at(-1)!;
export function xmlText(node: XmlNode): string { return node.text + node.children.map(xmlText).join(''); }
export function descendants(nodes: XmlNode[], name: string): XmlNode[] { return nodes.flatMap(n => [...(localName(n) === name ? [n] : []), ...descendants(n.children, name)]); }
