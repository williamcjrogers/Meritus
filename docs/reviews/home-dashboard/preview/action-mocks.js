import {records,updateRecord,makeAction,directory} from './fixtures.js';
const ownerName=id=>directory.directors.find(d=>d.id===id)?.name||(id?'Assigned, name unavailable':'Unassigned');
export async function saveDeskAction(input){const old=records.find(a=>a.id===input.id);if(old&&old.version!==input.expectedVersion)return {ok:false,code:'conflict',error:'Another director updated this action',current:old};const action={...(old||makeAction(99)),...input.draft,id:input.id,link:input.link,relatedLabel:input.link.kind==='general'?'Standalone action':old?.relatedLabel||'Linked record',relatedHref:input.link.kind==='general'?null:old?.relatedHref||null,originalDueDate:old?.originalDueDate??input.draft.dueDate,ownerName:ownerName(input.draft.ownerId),version:(old?.version||0)+1,completedAt:input.draft.state==='completed'?new Date().toISOString():null,completedBy:input.draft.state==='completed'?'user_wr':null};updateRecord(action);return {ok:true,action}}
export async function completeDeskAction(id,version){const old=records.find(a=>a.id===id);return saveDeskAction({id,expectedVersion:version,link:old.link,draft:{...old,state:'completed'}})}
export async function detachDeskAction(id){const old=records.find(a=>a.id===id);const action={...old,link:{kind:'general'},relatedLabel:'General action',relatedHref:null};updateRecord(action);return {ok:true,action}}
export async function selectPrimaryAction(id){const action={...records.find(a=>a.id===id),isPrimary:true};updateRecord(action);return {ok:true,action}}
export async function readActionHistory(){return []}
export async function loadDeskActionHistory(){return []}
export async function readRelatedActions(link){return records.filter(a=>a.link.kind===link.kind&&a.link.id===link.id)}
