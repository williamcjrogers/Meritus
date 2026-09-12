export const directory={available:true,directors:[
{id:'user_wr',name:'William Rogers',email:'william@example.test',initials:'WR'},
{id:'user_md',name:'Mateo Diaz',email:'mateo@example.test',initials:'MD'},
{id:'user_am',name:'Alex Morgan',email:'alex@example.test',initials:'AM'}]};
export const today='2026-09-12';
export const uuid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const open=a=>['todo','in_progress','waiting'].includes(a.state);
const person=id=>directory.directors.find(d=>d.id===id)?.name||(id?'Assigned, name unavailable':'Unassigned');
export function makeAction(n,patch={}){return {
 id:uuid(n),title:'Review the next commitment',description:null,ownerId:'user_wr',suggestedOwnerId:null,
 dueDate:today,originalDueDate:today,state:'todo',stateReason:null,completedAt:null,completedBy:null,
 createdBy:'user_wr',createdAt:'2026-09-10T09:00:00.000Z',updatedAt:'2026-09-12T09:00:00.000Z',
 version:1,legacyKey:null,link:{kind:'pursuit',id:'kubik'},retainedContext:null,
 relatedLabel:'Kubik Construction',relatedHref:'/portal/pursuits/kubik',ownerName:'William Rogers',isPrimary:false,linkAvailable:true,...patch};}
export let records=[];
export function resetFixture(scenario='busy'){
 records=scenario==='empty'?[]:[makeAction(1,{title:'Call Matt Bruce about the curtain wall scope',ownerId:null,ownerName:'Unassigned',suggestedOwnerId:'user_wr',legacyKey:'pursuit:kubik',isPrimary:true})];
 if(scenario==='busy'||scenario==='error')records.push(
 makeAction(2,{title:'Confirm the brief and agree the next meeting',dueDate:'2026-09-10',originalDueDate:'2026-09-10',link:{kind:'pursuit',id:'lq'},relatedLabel:'L&Q Housing Trust',relatedHref:'/portal/pursuits/lq'}),
 makeAction(3,{title:'Review the proposed fee and appointment terms',ownerId:'user_md',ownerName:'Mateo Diaz',dueDate:'2026-09-11',state:'in_progress'}),
 makeAction(4,{title:'Chase the supporting programme records',ownerId:'user_am',ownerName:'Alex Morgan',dueDate:today,state:'waiting',stateReason:'Awaiting the client programme export',link:{kind:'programme',id:'programme-1'},relatedLabel:'Programme analysis',relatedHref:'/portal/programmes/programme-1'}),
 makeAction(5,{title:'Review the research evidence for the proposed approach',ownerId:'user_md',ownerName:'Mateo Diaz',dueDate:'2026-09-14',link:{kind:'investigation',id:uuid(50)},relatedLabel:'Research investigation',relatedHref:'/portal/research'}),
 makeAction(6,{title:'Prepare the scope for the director review',dueDate:'2026-09-15',state:'in_progress'}),
 makeAction(7,{title:'Agree the next introduction',dueDate:null,originalDueDate:null,ownerId:null,ownerName:'Unassigned',link:{kind:'prospect',id:'prospect-1'},relatedLabel:'Prospect outreach',relatedHref:'/portal/prospects'}),
 makeAction(8,{title:'Check the draft appointment',dueDate:'2026-09-17',ownerId:'user_am',ownerName:'Alex Morgan'}),
 makeAction(9,{title:'Confirm the document request list',state:'completed',completedAt:'2026-09-11T15:30:00.000Z',completedBy:'user_wr',dueDate:'2026-09-11'})
 );
}
export function updateRecord(action){records=records.some(a=>a.id===action.id)?records.map(a=>a.id===action.id?action:a):[...records,action]}
export function dashboardFixture(scenario='busy',scope='team'){
 const all=records.filter(open), selected=scope==='mine'?all.filter(a=>a.ownerId==='user_wr'):all;
 const counts={open:selected.length,overdue:selected.filter(a=>a.dueDate&&a.dueDate<today).length,today:selected.filter(a=>a.dueDate===today).length,upcoming:selected.filter(a=>a.dueDate>today&&a.dueDate<='2026-09-19').length,unassigned:selected.filter(a=>!a.ownerId).length,undated:selected.filter(a=>!a.dueDate).length};
 const rows=selected.filter(a=>a.dueDate&&a.dueDate<='2026-09-19').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,8);
 const ids=[...directory.directors.map(d=>d.id),null];
 const team=ids.map(ownerId=>({ownerId,ownerName:person(ownerId),open:all.filter(a=>a.ownerId===ownerId).length,overdue:all.filter(a=>a.ownerId===ownerId&&a.dueDate&&a.dueDate<today).length,upcoming:all.filter(a=>a.ownerId===ownerId&&a.dueDate>today&&a.dueDate<='2026-09-19').length,completedRecent:records.filter(a=>a.ownerId===ownerId&&a.state==='completed').length}));
 const empty=scenario==='empty';const ok=data=>({ok:true,data});
 return {scope,today,refreshedAt:'2026-09-12T09:30:00.000Z',directory,
 actions:ok({counts,rows,unassignedTeam:all.filter(a=>!a.ownerId).length}),team:ok(team),
 leads:ok({stages:{enquiry:0,scoping:empty?0:1,proposal:empty?0:1,instructed:0,dormant:0,declined:empty?0:2},withoutOwner:0,withoutAction:empty?0:1,exceptionRows:empty?[]:[{id:'lq',firm:'L&Q',missingOwner:false,missingAction:true}]}),
 prospects:ok({statuses:{unworked:empty?0:62,approaching:0,contacted:0,parked:0,converted:0,do_not_approach:0},availableToApproach:empty?0:62}),
 programmes:scenario==='error'?{ok:false,error:'Could not load programme analysis'}:ok({uploaded:empty?0:3,analysing:empty?0:1,analysed:empty?0:2,analysisFailed:0,parseNeedsAttention:0}),
 research:ok({runningInvestigations:empty?0:1,queuedInvestigations:0,signalsAwaitingReview:empty?0:4,reportsAwaitingReview:empty?0:1,failedLatestRuns:0}),
 agenda:ok({entries:selected.filter(a=>a.dueDate>=today&&a.dueDate<'2026-09-26').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,8).map(a=>({id:a.id,date:a.dueDate,title:a.title,kind:'action',href:'/portal/actions?edit='+a.id,ownerName:a.ownerName,qualification:null})),warnings:[]}),
 progress:ok(records.filter(a=>a.state==='completed').map(a=>({id:a.id,at:a.completedAt,title:'Completed: '+a.title,actorName:a.ownerName,href:'/portal/actions?filter=completed_recent&edit='+a.id,kind:'action'})))};
}
resetFixture(new URL(window.location.href).searchParams.get('scenario')||'busy');
