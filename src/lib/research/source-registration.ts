import { z } from "zod";
export const sourceRegistration = z.object({
    label: z.string().trim().min(1).max(200), provider: z.string().min(1).max(100),
    hosts: z.array(z.string().regex(/^(?!.*\.\.)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)).min(1).max(30),
    accessMethod: z.string().min(1), termsUrl: z.url().refine(value => new URL(value).protocol === "https:"),
    termsVersion: z.string().min(1), termsReviewedAt: z.iso.datetime(), attribution: z.string().min(1),
    operator: z.literal("QCS"), purpose: z.string().min(1), rightsId: z.uuid(),
    credentialRef: z.string().regex(/^RESEARCH_[A-Z0-9_]+$/).nullable(),
    status: z.enum(["ready", "unavailable", "paused"]), selection: z.record(z.string(), z.unknown()).default({}),
    backfillStart: z.iso.datetime(), cadenceSeconds: z.number().int().positive(), freshnessSeconds: z.number().int().positive(),
    requestLimit: z.number().int().positive(), windowSeconds: z.number().int().positive(),
    dailyRequests: z.number().int().nonnegative().safe(), dailyTokens: z.number().int().nonnegative().safe(), dailyPence: z.number().int().nonnegative().safe(),
}).strict();
export type SourceRegistration = z.infer<typeof sourceRegistration>;
export const investigationRegistration = z.object({
    question: z.string().trim().min(1).max(10000), scope: z.record(z.string(), z.unknown()),
    budget: z.object({ maxRequests: z.number().int().nonnegative().safe(), maxTokens: z.number().int().nonnegative().safe(), maxCostPence: z.number().int().nonnegative().safe() }).strict(),
}).strict();
