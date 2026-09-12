import { unzipSync } from 'fflate';
import type { ExtractedEvidence } from '../contracts';
import { decodeUtf8, xmlTree, descendants, xmlText } from './xml';
export function parseRemediationOds(body: Uint8Array): ExtractedEvidence { if (body.length > 32 * 1024 * 1024)
    throw new Error('ODS byte limit exceeded'); let count = 0, expanded = 0; const files = unzipSync(body, { filter: file => { if (++count > 200 || file.name.split(/[\\/]/).some(p => p === '..') || file.name.startsWith('/') || /^[a-z]:/i.test(file.name))
        throw new Error('Unsafe ODS ZIP entry'); expanded += file.originalSize; if (expanded > 50 * 1024 * 1024 || file.originalSize > Math.max(1, file.size) * 100)
        throw new Error('ODS expansion limit exceeded'); return file.name === 'content.xml'; } }); if (!files['content.xml'])
    throw new Error('ODS content.xml missing'); const nodes = xmlTree(decodeUtf8(files['content.xml'])); const passages: ExtractedEvidence['passages'] = []; for (const table of descendants(nodes, 'table')) {
    let rowIndex = 0;
    for (const row of descendants(table.children, 'table-row')) {
        const repeat = Number(row.attributes['table:number-rows-repeated'] ?? 1);
        if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 100000)
            throw new Error('ODS row repetition limit');
        const cells = descendants(row.children, 'table-cell');
        let column = 0;
        for (const cell of cells) {
            const repetitions = Number(cell.attributes['table:number-columns-repeated'] ?? 1);
            if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 100000)
                throw new Error('ODS column repetition limit');
            const value = xmlText(cell).trim() || cell.attributes['office:value'] || '';
            if (value)
                passages.push({ locator: { kind: 'field', value: `${table.attributes['table:name'] ?? 'sheet'}!R${rowIndex + 1}C${column + 1}${repetitions > 1 ? ':repeat=' + repetitions : ''}` }, text: value });
            column += repetitions;
        }
        rowIndex += repeat;
        if (passages.length > 200000)
            throw new Error('ODS cell limit exceeded');
    }
} return { passages, facts: [], coverage: { complete: passages.length > 0, notes: ['Programme tables can overlap. Suppressed and banded values are preserved; developer data does not identify individual buildings.'] } }; }
