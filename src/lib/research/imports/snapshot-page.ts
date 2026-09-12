import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { validateColumns } from './parse';
export async function parseCsvPage(input: AsyncIterable<Uint8Array>, cursor: {
    nextByte: number;
    columns: string[] | null;
}, limit: number): Promise<{
    rows: Record<string, string>[];
    columns: string[];
    nextByte: number;
    complete: boolean;
}> {
    if (!Number.isSafeInteger(cursor.nextByte) || cursor.nextByte < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000)
        throw new Error('Invalid CSV page boundary');
    if (cursor.nextByte > 0 && !cursor.columns)
        throw new Error('Resume columns required');
    let columns = cursor.columns ? validateColumns(cursor.columns) : null;
    let suppliedBytes=0;
    async function* validInput(){const decoder=new TextDecoder('utf-8',{fatal:true});for await(const chunk of input){decoder.decode(chunk,{stream:true});suppliedBytes+=chunk.byteLength;yield chunk;}decoder.decode();}
    const source = Readable.from(validInput());
    const parser = source.pipe(parse({ columns: columns ?? ((header: string[]) => { columns = validateColumns(header); return columns; }), bom: cursor.nextByte === 0, max_record_size: 1048576, skip_empty_lines: true, info: true }));
    source.on('error',error=>parser.destroy(error));
    const rows: Record<string, string>[] = [];
    let nextByte = cursor.nextByte;
    let complete = true;
    try {
        for await (const record of parser) {
            if (rows.length === limit) {
                complete = false;
                break;
            }
            rows.push(record.record);
            nextByte = cursor.nextByte + record.info.bytes;
        }
    }
    finally {
        source.destroy();
        parser.destroy();
    }
    if(complete)nextByte=cursor.nextByte+suppliedBytes;
    return { rows, columns: columns ?? [], nextByte, complete };
}
