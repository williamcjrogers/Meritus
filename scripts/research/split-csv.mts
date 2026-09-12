import {resolve} from 'node:path';
import {splitCsv} from '../../src/lib/research/imports/split-csv.ts';
const args=process.argv.slice(2);const value=(name:string)=>{const i=args.indexOf(name);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Required argument ${name}`);return args[i+1];};
if(args.some((arg,i)=>i%2===0&&!['--input','--output','--max-part-bytes'].includes(arg)))throw new Error('Unknown argument');
const input=resolve(value('--input')),output=resolve(value('--output'));const max=args.includes('--max-part-bytes')?Number(value('--max-part-bytes')):16*1024*1024;
const result=await splitCsv(input,output,max);process.stdout.write(JSON.stringify(result,null,2)+'\n');
