import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ResearchScope } from './workflow-types';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Use a valid calendar date');
export const researchScopeSchema=z.object({kind:z.enum(['organisation','project','legal_issue','sector','referral']),subject:z.string().trim().min(1).max(300),entityId:z.uuid().nullable(),jurisdiction:z.string().trim().min(1).max(100),from:date.nullable(),to:date.nullable(),sources:z.array(z.uuid()).min(1).max(20)}).strict().refine(s=>!s.from||!s.to||s.from<=s.to,'The start date must precede the end date');
export const researchBudgetSchema=z.object({maxRequests:z.number().int().positive().max(10000),maxTokens:z.number().int().positive().max(1000000),maxCostPence:z.number().int().positive().max(100000)}).strict();
export const investigationRequestSchema=z.object({requestId:z.uuid(),question:z.string().trim().min(1).max(4000),scope:researchScopeSchema,budget:researchBudgetSchema}).strict();
export function publicSearchQuery(scope:ResearchScope):string { const clean=(v:string)=>v.replace(/[\u0000-\u001f\u007f"]/g,' ').replace(/\s+/g,' ').trim();return '"'+clean(scope.subject)+'" '+clean(scope.jurisdiction); }
function canonical(value:unknown):unknown { if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value; }
export function requestHash(value:unknown):string{return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
