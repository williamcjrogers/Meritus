import type { ExtractedEvidence, SourceConnector } from '../contracts';
import { acquire, envelope } from './common';
import { htmlLinks } from '../extract/html';
export type GatewayMetric = {periodFrom:string;periodTo:string;category:string;measure:string;value:number;denominator:number|null;sourceLocator:string};
export type StructuredFact = ExtractedEvidence['facts'][number];
export function normaliseGatewayMetric(input:GatewayMetric):StructuredFact {
    if(!Number.isFinite(input.value)||(input.denominator!==null&&(!Number.isFinite(input.denominator)||input.denominator<0))||!input.sourceLocator||input.periodFrom>input.periodTo)throw new Error('Invalid Gateway metric');
    return {predicate:'gateway.cohortMetric',value:input,locator:{kind:'page',value:input.sourceLocator},status:'observation'};
}
type PublicationCursor={pending:{url:string;depth:number}[];visited:string[];attachments:number;truncated:boolean};
export function createBuildingSafetyConnector(selection:{publicationUrl:string}):SourceConnector {
    return {provider:'building-safety',async fetchPage(context){
        const cursor:PublicationCursor=context.cursor?JSON.parse(context.cursor):{pending:[{url:selection.publicationUrl,depth:0}],visited:[],attachments:0,truncated:false};
        if(!Array.isArray(cursor.pending)||!Array.isArray(cursor.visited)||cursor.visited.length>200||cursor.pending.length>200||cursor.pending.some(p=>typeof p.url!=='string'||!Number.isInteger(p.depth)||p.depth<0||p.depth>2))throw new Error('Invalid publication cursor');
        const item=cursor.pending.shift();if(!item)throw new Error('Empty publication cursor');
        const response=await acquire(context,item.url,32*1024*1024);
        if(response.status===404||response.status===410)throw new Error('Publication unavailable');
        cursor.visited.push(item.url);
        if(response.contentType.includes('html')){
            const links=htmlLinks(response.body,response.url);
            for(const link of links){
                const url=new URL(link);const attachment=/\.(pdf|ods)(?:$|\?)/i.test(link);
                const publication=url.hostname==='www.gov.uk'&&url.pathname.startsWith('/government/publications/building-safety');
                if(!attachment&&!publication)continue;
                if(!context.source.hosts.includes(url.hostname)){cursor.truncated=true;continue;}
                if(cursor.visited.includes(link)||cursor.pending.some(p=>p.url===link))continue;
                if((!attachment&&item.depth>=1)||item.depth>=2||cursor.visited.length+cursor.pending.length>=200){cursor.truncated=true;continue;}
                cursor.pending.push({url:link,depth:item.depth+1});
            }
        }else if(response.contentType.startsWith('application/pdf')||response.contentType.includes('opendocument.spreadsheet'))cursor.attachments++;
        const terminal=cursor.pending.length===0;
        const notes=['Published aggregate data cannot establish named project delay, causation or compensation.'];
        if(cursor.truncated)notes.push('Publication traversal reached a configured host, depth or 200-document ceiling; attachment coverage is incomplete.');
        if(terminal&&cursor.attachments===0)notes.push('No PDF or ODS attachment was acquired from the selected publication population.');
        return {records:[envelope(context,item.url,response.url,response.body,response.contentType,{evidenceScope:'aggregate',publicationUrl:selection.publicationUrl})],nextCursor:terminal?null:JSON.stringify(cursor),coverage:{complete:!cursor.truncated&&(!terminal||cursor.attachments>0),notes}};
    }};
}
