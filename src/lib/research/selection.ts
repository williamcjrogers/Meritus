import type { ResearchScope } from "./workflow-types";
import { publicSearchQuery } from "./commission";
import { validateSourceJobPayload } from "./sources/selection";
export function investigationPayload(
  provider: string,
  selection: Record<string, unknown>,
  scope: ResearchScope,
  companyNumber: string | null,
  now = new Date(),
) {
  let selected = selection;
  if (provider === "companies-house")
    selected = { companyNumber: companyNumber ?? selection.companyNumber };
  if (provider === "find-case-law")
    selected = {
      ...selection,
      query: publicSearchQuery(scope),
      ...(scope.from ? { from: scope.from } : {}),
      ...(scope.to ? { to: scope.to } : {}),
    };
  if (
    ["find-a-tender", "contracts-finder", "payment-practices"].includes(
      provider,
    )
  )
    selected = {};
  return validateSourceJobPayload(provider, {
    window: {
      from: scope.from
        ? scope.from + "T00:00:00Z"
        : new Date(now.getTime() - 365 * 86400000).toISOString(),
      to: scope.to ? scope.to + "T23:59:59.999Z" : now.toISOString(),
    },
    selection: selected,
  });
}

/** Immutable storage keys may change on a transport retry; source content and mapping identify the request. */
export function semanticImportSelection(selection:Record<string,unknown>){return Object.fromEntries(Object.entries(selection).filter(([key])=>key!=='objectKey'));}
