import type { ConnectorContext, ConnectorPage, SourceConnector } from '../contracts';
import {caseFeedUrl,parseAtom} from '../case-law/atom';
import type {CaseSearch,CaseFeedEntry} from '../case-law/types';
import {decodeUtf8,xmlTree,descendants} from '../extract/xml';
import {acquire,checkedNext,envelope,encodeJson} from './common';
import {listCaseLawRecheckTargets,getCaseLawRecheckTarget} from '../../db/research-case-law';
export type CaseSourceSelection=CaseSearch&{mode?:'feed'|'reconcile';maxPages?:number};
function caseNext(value:string|null,initial:string):string|null {
    const checked=checkedNext(value,initial);if(!checked)return null;
    const url=new URL(checked),base=new URL(initial);
    for(const key of ['query','court','party','judge','order','minimum_availability','per_page']){
        const expected=base.searchParams.getAll(key),actual=url.searchParams.getAll(key);
        if(actual.length&&JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Case-law pagination changed the selected population');
        if(!actual.length)for(const item of expected)url.searchParams.append(key,item);
    }
    return url.href;
}
function decisionDate(body:Uint8Array,contentType:string):string|null {
    if(!/xml/.test(contentType))return null;
    const nodes=xmlTree(decodeUtf8(body));const date=descendants(nodes,'docDate').map(n=>n.attributes.date).find(Boolean);
    return date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null;
}
async function reconcilePage(context:ConnectorContext):Promise<ConnectorPage>{
    const cursor:{ids:string[];processed:number}=context.cursor?JSON.parse(context.cursor):{ids:(await listCaseLawRecheckTargets(context.source.id)).map(target=>target.id),processed:0};
    if(!Array.isArray(cursor.ids)||cursor.ids.length>100||cursor.ids.some(id=>!/^[0-9a-f-]{36}$/i.test(id))||!Number.isInteger(cursor.processed)||cursor.processed<0||cursor.processed>100)throw new Error('Invalid case-law reconciliation cursor');
    const id=cursor.ids.shift();if(!id)return {records:[],nextCursor:null,coverage:{complete:true,notes:['The bounded oldest-checked availability batch is complete; remaining known records rotate into later batches.']}};
    cursor.processed++;const nextCursor=cursor.ids.length?JSON.stringify(cursor):null;
    const target=await getCaseLawRecheckTarget(context.source.id,id);
    if(!target)return {records:[],nextCursor,coverage:{complete:true,notes:['Record is no longer eligible for availability recheck.']}};
    const response=await acquire(context,target.url,32*1024*1024);
    const absent=response.status===404||response.status===410;const restored=!absent&&target.status==='unavailable';
    const record=envelope(context,target.providerId,response.url,absent?encodeJson({uri:target.providerId,withdrawn:true}):response.body,absent?'application/json':response.contentType,{...target.metadata,httpStatus:response.status,withdrawn:absent,availability:absent?'withdrawn':restored?'pending_review':'available',requiresRestorationReview:restored,reconciliation:true,absenceReason:response.status===404?'publisher_absent_pending_reconciliation':response.status===410?'publisher_gone':null});
    record.publishedAt=target.publishedAt;record.updatedAt=target.updatedAt;
    return {records:[record],nextCursor,coverage:{complete:response.status!==404&&!restored,notes:[...(response.status===410?['Publisher confirmed removal; the withdrawal was processed.']:response.status===404?['Known document is absent and hidden pending reconciliation.']:restored?['A previously unavailable document is again supplied by the publisher; restoration requires review.']:['Known document remains available.']),...(!nextCursor?[`Bounded availability batch checked ${cursor.processed} selected records; remaining known records rotate into later batches.`]:[])]}};
}
export function createCaseLawConnector(selection:CaseSourceSelection):SourceConnector {
    return {provider:'find-case-law',async fetchPage(context){
        if(selection.mode==='reconcile')return reconcilePage(context);
        const initial=caseFeedUrl(selection,selection.order??'-transformation');
        const cursor:{feedUrl:string;entries?:CaseFeedEntry[];next?:string|null;pages:number}=context.cursor?JSON.parse(context.cursor):{feedUrl:initial,pages:0};
        cursor.pages??=0;if(!Number.isInteger(cursor.pages)||cursor.pages<0)throw new Error('Invalid case-law feed cursor');
        cursor.feedUrl=caseNext(cursor.feedUrl,initial)!;
        if(!cursor.entries){
            if(cursor.pages>=(selection.maxPages??10000))return {records:[],nextCursor:null,coverage:{complete:false,notes:['Case-law feed reached the configured page ceiling before exhausting the selected population.']}};
            const response=await acquire(context,cursor.feedUrl);
            if(response.status===404||response.status===410)throw new Error('Find Case Law feed unavailable');
            const feed=parseAtom(decodeUtf8(response.body));if((selection.order??'-transformation')==='-transformation'){let previous=Infinity;for(const entry of feed.entries){const date=Date.parse(entry.transformedAt??'');if(Number.isFinite(date)){if(date>previous)throw new Error('Find Case Law transformation order is inconsistent');previous=date;}}}cursor.entries=feed.entries;cursor.next=caseNext(feed.next,initial);if(cursor.next===cursor.feedUrl)throw new Error('Case-law feed pagination did not advance');cursor.pages++;
        }
        const entry=cursor.entries.shift();
        const nextCursor=cursor.entries.length?JSON.stringify(cursor):cursor.next?JSON.stringify({feedUrl:cursor.next,pages:cursor.pages}):null;
        if(!entry)return {records:[],nextCursor,coverage:{complete:true,notes:[]}};
        const transformation=entry.transformedAt?Date.parse(entry.transformedAt):NaN;
        if((selection.order??'-transformation')==='-transformation'&&Number.isFinite(transformation)){
            if(transformation<Date.parse(context.window.from))return {records:[],nextCursor:null,coverage:{complete:true,notes:['Transformation feed reached the fixed lower bound.']}};
            if(transformation>Date.parse(context.window.to))return {records:[],nextCursor,coverage:{complete:true,notes:[]}};
        }
        const url=entry.xmlUrl??entry.pdfUrl??`https://caselaw.nationalarchives.gov.uk/${entry.uri}/data.xml`;
        const response=await acquire(context,url,32*1024*1024);const absent=response.status===404||response.status===410;
        const date=absent?null:decisionDate(response.body,response.contentType);
        if(date&&((selection.from&&date<selection.from.slice(0,10))||(selection.to&&date>selection.to.slice(0,10))))return {records:[],nextCursor,coverage:{complete:true,notes:[]}};
        const unknownDate=Boolean((selection.from||selection.to)&&!date&&!absent);
        const record=envelope(context,entry.uri,response.url,absent?encodeJson({uri:entry.uri,withdrawn:true}):response.body,absent?'application/json':response.contentType,{title:entry.title,identifiers:entry.identifiers,contentHash:entry.contentHash,decisionDate:date,courtPublicationDate:entry.publishedAt,httpStatus:response.status,absenceReason:response.status===404?'publisher_absent_pending_reconciliation':response.status===410?'publisher_gone':null,withdrawn:absent,availability:absent?'withdrawn':'available',scanOrder:selection.order??'-transformation'});
        record.publishedAt=date??entry.publishedAt;record.updatedAt=entry.transformedAt;
        const notes=response.status===410?['Publisher confirmed removal; the withdrawal was processed.']:response.status===404?['Publisher record is absent; hide it pending reconciliation.']:['Coverage is limited to the Find Case Law corpus and the selected search population.'];
        if(unknownDate)notes.push('Explicit decision date was unavailable; the requested decision-date filter could not be verified for this document.');
        if(!Number.isFinite(transformation))notes.push('Transformation timestamp was unavailable; the fixed transformation window could not be verified.');
        if(selection.order==='-updated')notes.push('Metadata ordering has no separate per-entry metadata timestamp; this pass exhausts its configured population and does not stop by transformation time.');
        return {records:[record],nextCursor,coverage:{complete:response.status===410||(response.status!==404&&!unknownDate&&Number.isFinite(transformation)),notes}};
    }};
}
