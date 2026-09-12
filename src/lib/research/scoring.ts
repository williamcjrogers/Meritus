export type SignalInput={id:string;eventKey:string;kind:'direct'|'project_change'|'payment'|'context';occurredAt:string|null;confidence:number;halfLifeDays:number;independenceConfirmed:boolean;available:boolean;suppressed:boolean};
export type Priority={score:number;independentEvents:number;corroborated:boolean;provisionalIds:string[]};
export const SCORING_VERSION='qcs_priority_v1';
export const weights={direct:40,project_change:25,payment:15,context:5} as const;
export function scoreSignals(items:SignalInput[],now:Date):Priority{
 if(!Number.isFinite(now.getTime()))throw new Error('Invalid scoring date');
 const events=new Map<string,number>(),qualifying=new Set<string>(),provisionalIds:string[]=[];
 for(const item of items){
  if(!Number.isFinite(item.confidence)||item.confidence<0||item.confidence>1||!Number.isFinite(item.halfLifeDays)||item.halfLifeDays<=0||!item.eventKey.trim()||!(item.kind in weights))throw new Error('Invalid scoring input');
  if(!item.available||item.suppressed)continue;
  const at=item.occurredAt===null?NaN:Date.parse(item.occurredAt);
  if(!Number.isFinite(at)||at>now.getTime()){provisionalIds.push(item.id);continue;}
  const value=weights[item.kind]*item.confidence*2**(-(now.getTime()-at)/86400000/item.halfLifeDays);
  events.set(item.eventKey,Math.max(events.get(item.eventKey)??0,value));
  if(item.independenceConfirmed&&item.kind!=='context'&&item.confidence>=0.75&&value>=5)qualifying.add(item.eventKey);
 }
 return {score:Math.min(100,Math.round([...events.values()].reduce((a,b)=>a+b,0))),independentEvents:qualifying.size,corroborated:qualifying.size>=2,provisionalIds};
}
