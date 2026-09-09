import { describe, expect, it } from "vitest";
import type { Pursuit } from "@/lib/db/schema";
import { partitionDesk, sortColumn } from "./board";

const NOW = new Date("2026-09-09T10:00:00Z");
const ME = "user_me";
const OTHER = "user_other";

let counter = 0;

function makePursuit(overrides: Partial<Pursuit> = {}): Pursuit {
  counter += 1;
  return {
    id: `p${counter}`,
    firm: `Firm ${counter}`,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: "Defects",
    approximateValue: null,
    forum: null,
    summary: null,
    source: "site_form",
    sourceDetail: null,
    ownerId: null,
    stage: "enquiry",
    stageChangedAt: new Date("2026-09-01T09:00:00Z"),
    nextAction: null,
    nextActionDue: null,
    createdBy: "site",
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-01T09:00:00Z"),
    ...overrides,
  };
}

const ids = (rows: Pursuit[]) => rows.map((row) => row.id);

describe("partitionDesk", () => {
  it("puts unowned pursuits in active stages in the inbox, oldest first", () => {
    const newer = makePursuit({ id: "newer", stage: "enquiry", createdAt: new Date("2026-09-08T09:00:00Z") });
    const older = makePursuit({ id: "older", stage: "scoping", createdAt: new Date("2026-09-02T09:00:00Z") });
    const result = partitionDesk([newer, older], { scope: "all", userId: ME, now: NOW });
    expect(ids(result.inbox)).toEqual(["older", "newer"]);
    expect(result.board.enquiry).toEqual([]);
    expect(result.board.scoping).toEqual([]);
  });

  it("puts owned pursuits in active stages on the board under their stage", () => {
    const proposal = makePursuit({ id: "prop", stage: "proposal", ownerId: ME });
    const result = partitionDesk([proposal], { scope: "all", userId: ME, now: NOW });
    expect(result.inbox).toEqual([]);
    expect(ids(result.board.proposal)).toEqual(["prop"]);
    expect(result.counts).toEqual({ enquiry: 0, scoping: 0, proposal: 1 });
  });

  it("puts dormant pursuits past their revisit date in the revisit strip, soonest due first", () => {
    const later = makePursuit({ id: "later", stage: "dormant", ownerId: ME, nextActionDue: "2026-09-05" });
    const sooner = makePursuit({ id: "sooner", stage: "dormant", ownerId: OTHER, nextActionDue: "2026-08-20" });
    const result = partitionDesk([later, sooner], { scope: "all", userId: ME, now: NOW });
    expect(ids(result.revisit)).toEqual(["sooner", "later"]);
  });

  it("leaves dormant pursuits with a future or missing revisit date out entirely", () => {
    const future = makePursuit({ id: "future", stage: "dormant", ownerId: ME, nextActionDue: "2026-09-20" });
    const today = makePursuit({ id: "today", stage: "dormant", ownerId: ME, nextActionDue: "2026-09-09" });
    const undated = makePursuit({ id: "undated", stage: "dormant", ownerId: ME, nextActionDue: null });
    const result = partitionDesk([future, today, undated], { scope: "all", userId: ME, now: NOW });
    expect(result.inbox).toEqual([]);
    expect(result.revisit).toEqual([]);
    expect(result.board).toEqual({ enquiry: [], scoping: [], proposal: [] });
  });

  it("leaves instructed and declined pursuits out entirely", () => {
    const instructed = makePursuit({ stage: "instructed", ownerId: ME });
    const declined = makePursuit({ stage: "declined", ownerId: ME, nextActionDue: "2026-01-01" });
    const unownedDeclined = makePursuit({ stage: "declined", ownerId: null });
    const result = partitionDesk([instructed, declined, unownedDeclined], {
      scope: "all",
      userId: ME,
      now: NOW,
    });
    expect(result.inbox).toEqual([]);
    expect(result.revisit).toEqual([]);
    expect(result.counts).toEqual({ enquiry: 0, scoping: 0, proposal: 0 });
  });

  it("scope mine keeps only my pursuits on the board and in the counts", () => {
    const mine = makePursuit({ id: "mine", stage: "scoping", ownerId: ME });
    const theirs = makePursuit({ id: "theirs", stage: "scoping", ownerId: OTHER });
    const theirsToo = makePursuit({ id: "theirsToo", stage: "enquiry", ownerId: OTHER });
    const all = partitionDesk([mine, theirs, theirsToo], { scope: "all", userId: ME, now: NOW });
    expect(ids(all.board.scoping)).toEqual(["mine", "theirs"]);
    expect(all.counts).toEqual({ enquiry: 1, scoping: 2, proposal: 0 });

    const onlyMine = partitionDesk([mine, theirs, theirsToo], { scope: "mine", userId: ME, now: NOW });
    expect(ids(onlyMine.board.scoping)).toEqual(["mine"]);
    expect(onlyMine.board.enquiry).toEqual([]);
    expect(onlyMine.counts).toEqual({ enquiry: 0, scoping: 1, proposal: 0 });
  });

  it("scope mine never filters the inbox or the revisit strip", () => {
    const inbox = makePursuit({ id: "inbox", stage: "enquiry", ownerId: null });
    const revisit = makePursuit({ id: "revisit", stage: "dormant", ownerId: OTHER, nextActionDue: "2026-09-01" });
    const result = partitionDesk([inbox, revisit], { scope: "mine", userId: ME, now: NOW });
    expect(ids(result.inbox)).toEqual(["inbox"]);
    expect(ids(result.revisit)).toEqual(["revisit"]);
  });

  it("sorts each board column with sortColumn", () => {
    const waiting = makePursuit({
      id: "waiting",
      stage: "enquiry",
      ownerId: ME,
      stageChangedAt: new Date("2026-08-01T09:00:00Z"),
    });
    const overdue = makePursuit({
      id: "overdue",
      stage: "enquiry",
      ownerId: ME,
      nextActionDue: "2026-09-01",
      stageChangedAt: new Date("2026-09-08T09:00:00Z"),
    });
    const result = partitionDesk([waiting, overdue], { scope: "all", userId: ME, now: NOW });
    expect(ids(result.board.enquiry)).toEqual(["overdue", "waiting"]);
  });

  it("defaults now to the current time", () => {
    const longPast = makePursuit({ stage: "dormant", ownerId: ME, nextActionDue: "2000-01-01" });
    const result = partitionDesk([longPast], { scope: "all", userId: ME });
    expect(result.revisit).toHaveLength(1);
  });
});

describe("sortColumn", () => {
  it("orders overdue by due date, then dated by due date, then the longest waiting", () => {
    const oldestUndated = makePursuit({
      id: "oldestUndated",
      stageChangedAt: new Date("2026-08-01T09:00:00Z"),
    });
    const newestUndated = makePursuit({
      id: "newestUndated",
      stageChangedAt: new Date("2026-09-08T09:00:00Z"),
    });
    const dueSoon = makePursuit({ id: "dueSoon", nextActionDue: "2026-09-10" });
    const dueLater = makePursuit({ id: "dueLater", nextActionDue: "2026-09-20" });
    const overdueRecent = makePursuit({ id: "overdueRecent", nextActionDue: "2026-09-08" });
    const overdueLongAgo = makePursuit({ id: "overdueLongAgo", nextActionDue: "2026-08-20" });
    const dueToday = makePursuit({ id: "dueToday", nextActionDue: "2026-09-09" });

    const sorted = sortColumn(
      [newestUndated, dueLater, overdueRecent, oldestUndated, dueToday, overdueLongAgo, dueSoon],
      NOW
    );
    expect(ids(sorted)).toEqual([
      "overdueLongAgo",
      "overdueRecent",
      "dueToday",
      "dueSoon",
      "dueLater",
      "oldestUndated",
      "newestUndated",
    ]);
  });

  it("breaks ties on the same due date by the longest waiting", () => {
    const recent = makePursuit({
      id: "recent",
      nextActionDue: "2026-09-01",
      stageChangedAt: new Date("2026-09-05T09:00:00Z"),
    });
    const waiting = makePursuit({
      id: "waiting",
      nextActionDue: "2026-09-01",
      stageChangedAt: new Date("2026-08-05T09:00:00Z"),
    });
    expect(ids(sortColumn([recent, waiting], NOW))).toEqual(["waiting", "recent"]);
  });

  it("returns a new array and leaves the input in place", () => {
    const first = makePursuit({ id: "first", stageChangedAt: new Date("2026-09-08T09:00:00Z") });
    const second = makePursuit({ id: "second", stageChangedAt: new Date("2026-08-08T09:00:00Z") });
    const input = [first, second];
    const sorted = sortColumn(input, NOW);
    expect(ids(sorted)).toEqual(["second", "first"]);
    expect(ids(input)).toEqual(["first", "second"]);
  });
});
