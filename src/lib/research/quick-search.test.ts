import { expect, it } from "vitest";
import { expandedQuickSearchTerms, quickExcerptPatterns, quickSearchTerms } from "./quick-search";

it("shares bounded question terms without allowing query syntax through", () => {
  expect(quickSearchTerms("Show me ACME Ltd's payments! & :* ; drop")).toEqual(["acme", "ltd", "payments", "drop"]);
  expect(quickSearchTerms(Array.from({ length: 100 }, (_, i) => `term${i}`).join(" "))).toHaveLength(24);
});

it.each(["payment", "payments", "invoice", "invoices", "paid"])("shares payment expansion for %s", (term) => {
  expect(expandedQuickSearchTerms(`What do the ${term} records show?`)).toEqual(expect.arrayContaining(["payment", "pay", "paid", "unpaid", "invoice"]));
});

it.each([
  ["invoice", "invoices"], ["invoices", "invoice"],
  ["defect", "defects"], ["defects", "defect"],
  ["liability", "liabilities"], ["liabilities", "liability"],
  ["pay", "paying"], ["delay", "delayed"], ["delayed", "delay"],
  ["remediate", "remediated"], ["remediated", "remediate"],
])("matches common inflections from %s to %s", (question, sourceWord) => {
  expect(quickExcerptPatterns(question).some(pattern => pattern.test(sourceWord))).toBe(true);
});

it("does not find query words inside unrelated longer words or company numbers", () => {
  expect(quickExcerptPatterns("pay 1234").some(pattern => pattern.test("repayment 123456"))).toBe(false);
});
