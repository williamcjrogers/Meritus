import { describe, it, expect } from "vitest";
import { sourceRegistration, investigationRegistration } from "./source-registration";
const registration = { label: "Fixture", provider: "companies-house", hosts: ["api.company-information.service.gov.uk"], accessMethod: "api", termsUrl: "https://example.com/terms", termsVersion: "1", termsReviewedAt: "2026-09-12T00:00:00Z", attribution: "Fixture", operator: "QCS", purpose: "Research", rightsId: "00000000-0000-4000-8000-000000000001", credentialRef: "RESEARCH_CH_API_KEY", status: "ready", backfillStart: "2026-01-01T00:00:00Z", cadenceSeconds: 60, freshnessSeconds: 3600, requestLimit: 1, windowSeconds: 10, dailyRequests: 100, dailyTokens: 10000, dailyPence: 100 };
describe("source registration", () => {
    it("accepts secret references but rejects submitted secret values", () => {
        expect(sourceRegistration.parse(registration).selection).toEqual({});
        expect(sourceRegistration.safeParse({ ...registration, apiKey: "secret" }).success).toBe(false);
    });
    it("rejects local hosts, nonpositive intervals, invalid budgets and unbounded first windows", () => {
        for (const change of [{ hosts: ["localhost"] }, { hosts: ["example..com"] }, { dailyTokens: -1 }, { cadenceSeconds: 0 }, { backfillStart: undefined }]) {
            expect(sourceRegistration.safeParse({ ...registration, ...change }).success).toBe(false);
        }
    });
    it("requires explicit bounded investigation budgets", () => {
        expect(investigationRegistration.safeParse({ question: "Research", scope: {}, budget: {} }).success).toBe(false);
    });
});
