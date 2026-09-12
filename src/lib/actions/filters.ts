import type { ActionFilter, ActionQuery, ActionState, LinkKind, WorkLink } from "./types";

const FILTERS = new Set<ActionFilter>([
  "open",
  "overdue",
  "today",
  "upcoming",
  "unassigned",
  "undated",
  "completed_recent",
  "all",
]);
const STATES = new Set<ActionState>([
  "todo",
  "in_progress",
  "waiting",
  "completed",
  "cancelled",
]);
const LINK_KINDS = new Set<LinkKind>([
  "general",
  "pursuit",
  "prospect",
  "programme",
  "investigation",
  "calendar",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInteger(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function parseLink(kindValue: string | null, id: string | null): WorkLink | undefined {
  if (!kindValue || !LINK_KINDS.has(kindValue as LinkKind)) return undefined;
  const kind = kindValue as LinkKind;
  if (kind === "general") return { kind };
  if (!id || id.length > 64) return undefined;
  if ((kind === "investigation" || kind === "calendar") && !UUID.test(id)) return undefined;
  return { kind, id };
}

export function parseActionQuery(params: URLSearchParams): ActionQuery {
  const filterValue = params.get("filter");
  const filter = FILTERS.has(filterValue as ActionFilter)
    ? (filterValue as ActionFilter)
    : "open";
  const owner = params.get("owner");
  const hasOwner = owner === "unassigned" || Boolean(owner && owner.length <= 64);
  const stateValue = params.get("state");
  const state = STATES.has(stateValue as ActionState) ? (stateValue as ActionState) : undefined;
  const link = parseLink(params.get("link"), params.get("linkId"));
  const query: ActionQuery = {
    scope: params.get("scope") === "mine" && !hasOwner ? "mine" : "team",
    filter,
    page: parsePositiveInteger(params.get("page")),
    pageSize: 50,
  };
  if (hasOwner) query.ownerId = owner === "unassigned" ? null : owner;
  if (link) query.link = link;
  if (state) query.state = state;
  return query;
}

export function actionQueryHref(query: ActionQuery): string {
  const params = new URLSearchParams();
  params.set("scope", query.ownerId !== undefined ? "team" : query.scope);
  params.set("filter", query.filter);
  if (query.ownerId !== undefined) {
    params.set("owner", query.ownerId === null ? "unassigned" : query.ownerId);
  }
  if (query.link) {
    params.set("link", query.link.kind);
    if (query.link.kind !== "general") params.set("linkId", query.link.id);
  }
  if (query.state) params.set("state", query.state);
  if (query.page > 1) params.set("page", String(query.page));
  return `/portal/actions?${params.toString()}`;
}
