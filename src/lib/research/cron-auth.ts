import { timingSafeEqual } from "node:crypto";

export function validResearchCronAuth(value: string | null, secret: string): boolean {
    const actual = Buffer.from(value ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
