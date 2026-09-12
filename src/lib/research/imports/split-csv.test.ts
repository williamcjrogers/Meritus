// @vitest-environment node
// Synthetic local files only; each fixture directory is removed after the regression.
import { expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { splitCsv, verifyCsvManifest } from './split-csv';
import { parseCsvRows } from './parse';
it('splits complete quoted records, hashes all parts and detects tampering', async () => { const directory = await mkdtemp(join(process.cwd(), 'src/lib/research/fixtures/synthetic-')); try {
    const input = 'id,note\r\n1,"one\ntwó"\r\n2,"second, record"\r\n3,last\r\n';
    await writeFile(join(directory, 'input.csv'), input);
    const manifest = await splitCsv(join(directory, 'input.csv'), join(directory, 'parts'), 40);
    expect(manifest.snapshotHash).toBe(createHash('sha256').update(input).digest('hex'));
    expect(manifest.parts).toHaveLength(2);
    await verifyCsvManifest(join(directory, 'parts'), manifest);
    const records = [];
    for (const part of manifest.parts) {
        const bytes = await readFile(join(directory, 'parts', part.filename));
        expect(bytes.length).toBeLessThanOrEqual(40);
        for await (const row of parseCsvRows(bytes))
            records.push(row);
    }
    expect(records.map(r => r.id)).toEqual(['1', '2', '3']);
    expect(records[0].note).toBe('one\ntwó');
    await writeFile(join(directory, 'parts', manifest.parts[0].filename), 'tampered');
    await expect(verifyCsvManifest(join(directory, 'parts'), manifest)).rejects.toThrow('tampered');
}
finally {
    await rm(directory, { recursive: true, force: true });
} });
it('runs the documented local CSV splitting command with Node',async()=>{const {execFileSync}=await import('node:child_process');const directory=await mkdtemp(join(process.cwd(),'src/lib/research/fixtures/synthetic-cli-'));try{await writeFile(join(directory,'input.csv'),'id,note\n1,synthetic\n');const output=execFileSync(process.execPath,['scripts/research/split-csv.mts','--input',join(directory,'input.csv'),'--output',join(directory,'parts')],{cwd:process.cwd(),encoding:'utf8'});expect(JSON.parse(output).parts[0].rowCount).toBe(1);}finally{await rm(directory,{recursive:true,force:true});}});
