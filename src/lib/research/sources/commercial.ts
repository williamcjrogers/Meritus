import { z } from 'zod';
const commercialSchema = z.object({ provider: z.string().min(1), agreementId: z.string().trim().min(1), distribution: z.enum(['internal', 'approved-external']), format: z.enum(['csv', 'json']), mapping: z.record(z.string().min(1), z.string().min(1)) }).refine(v => Object.keys(v.mapping).length > 0, 'Mapping required');
export type CommercialImport = z.infer<typeof commercialSchema>;
export function validateCommercialImport(input: CommercialImport): CommercialImport { return commercialSchema.parse(input); }
