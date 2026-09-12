import { describe, expect, it } from "vitest";
import { actionQueryHref, parseActionQuery } from "./filters";

describe("action query filters", () => {
  it("falls back safely for unknown filters and invalid pagination", () => {
    expect(parseActionQuery(new URLSearchParams("scope=other&filter=forged&page=-4"))).toEqual({
      scope: "team",
      filter: "open",
      page: 1,
      pageSize: 50,
    });
  });

  it("maps unassigned and whitelists status and related work", () => {
    expect(
      parseActionQuery(
        new URLSearchParams(
          "scope=mine&filter=all&owner=unassigned&state=waiting&link=investigation&linkId=00000000-0000-4000-8000-000000000001",
        ),
      ),
    ).toEqual({
      scope: "team",
      filter: "all",
      ownerId: null,
      link: { kind: "investigation", id: "00000000-0000-4000-8000-000000000001" },
      state: "waiting",
      page: 1,
      pageSize: 50,
    });
  });

  it("does not retain malformed optional filters", () => {
    expect(
      parseActionQuery(
        new URLSearchParams("owner=&state=done&link=pursuit&linkId=&page=2.5"),
      ),
    ).toEqual({ scope: "team", filter: "open", page: 1, pageSize: 50 });
  });

  it("builds encoded register links and forces explicit owners to team scope", () => {
    const href = actionQueryHref({
      scope: "mine",
      filter: "upcoming",
      ownerId: "director & partner",
      link: { kind: "pursuit", id: "lead/1" },
      state: "in_progress",
      page: 3,
      pageSize: 50,
    });
    expect(href).toBe(
      "/portal/actions?scope=team&filter=upcoming&owner=director+%26+partner&link=pursuit&linkId=lead%2F1&state=in_progress&page=3",
    );
  });
});
