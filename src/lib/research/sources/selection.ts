import { z } from 'zod';
const date=z.iso.datetime({offset:true,local:true});
const windowSchema = z.object({ from: date, to: date }).refine(v => Date.parse(v.from) <= Date.parse(v.to), 'Invalid window');
const url = z.url().refine(v => new URL(v).protocol === 'https:'&&!new URL(v).username&&!new URL(v).password&&!new URL(v).hash, 'HTTPS required');
const objectKey = z.string().min(1).refine(v => v.split('/').includes('research') && !v.split('/').includes('..'), 'Research object required');
export const importSelectionSchema = z.object({ objectKey, format: z.enum(['csv', 'json']), mapping: z.record(z.string().min(1), z.string().min(1)).refine(v => Object.keys(v).length > 0, 'Mapping required'), snapshotId: z.string().min(1), partIndex: z.number().int().min(0), partCount: z.number().int().min(1).max(10000), agreementId: z.string().min(1).optional() }).refine(v => v.partIndex < v.partCount, 'Invalid manifest part');
export const caseSelectionSchema = z.object({ query: z.string().max(2000).optional(), courts: z.array(z.string().min(1)).max(100).optional(), party: z.string().max(500).optional(), judge: z.string().max(500).optional(), from: z.string().refine(v => Number.isFinite(Date.parse(v))).optional(), to: z.string().refine(v => Number.isFinite(Date.parse(v))).optional(), citation: z.string().max(500).optional(), order: z.enum(['-transformation', '-updated']).optional(),mode:z.enum(['feed','reconcile']).optional(),maxPages:z.number().int().positive().max(10000).optional() }).strict().refine(v => !v.from || !v.to || Date.parse(v.from) <= Date.parse(v.to), 'Invalid case dates');
const schemas: Record<string, z.ZodType> = { 'companies-house': z.object({ companyNumber: z.string().regex(/^[A-Z0-9]{8}$/) }).strict(), 'find-a-tender': z.object({}).strict(), 'contracts-finder': z.object({}).strict(), 'payment-practices': z.union([z.object({}).strict(), z.object({ objectKey, snapshotHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()]), 'gazette': z.object({ noticeTypes: z.array(z.string().regex(/^\d{4}$/)).min(1).max(100) }).strict(), 'find-case-law': caseSelectionSchema, 'building-safety': z.object({ publicationUrl: url }).strict(), 'publications': z.object({ url, kind: z.enum(['programme', 'accounts', 'rns', 'news', 'recruitment']), subjectId: z.string().min(1) }).strict(), 'research-import': importSelectionSchema, 'commercial-import': importSelectionSchema.refine(v => Boolean(v.agreementId), 'Agreement required'), 'court-listings': importSelectionSchema.refine(v => Boolean(v.agreementId), 'HMCTS agreement required'), 'bailii': importSelectionSchema.refine(v => Boolean(v.agreementId), 'Reuse assessment reference required') };
export function isSupportedProvider(provider: string): boolean { return Object.prototype.hasOwnProperty.call(schemas, provider); }
export function validateSourceSelection(provider: string, selection: unknown): {
    valid: boolean;
    reason?: string;
} { const schema = schemas[provider]; if (!schema)
    return { valid: false, reason: 'Unsupported source provider' }; const result = schema.safeParse(selection); return result.success ? { valid: true } : { valid: false, reason: result.error.message }; }
export function validateSourceJobPayload(provider: string, payload: unknown): Record<string, unknown> & {
    window: {
        from: string;
        to: string;
    };
    selection: unknown;
} { if (!isSupportedProvider(provider))
    throw new Error('Unsupported source provider'); const job = z.object({ window: windowSchema, selection: z.unknown() }).passthrough().parse(payload); return { ...job, selection: schemas[provider].parse(job.selection) }; }
