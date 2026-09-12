// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRelatedActions } from "@/lib/db/desk-actions";
import { viewFixture } from "@/lib/actions/view-fixture.test-support";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { addActivity, addResearchDerivedNote, listActivity } from "@/lib/db/activity";
import { listDocuments } from "@/lib/db/documents";
import {
  createPursuitWithEnquiry,
  declinePursuitGuarded,
  declinePursuitGuardedWithActivity,
  deletePursuitGuarded,
  getPursuit,
  takePursuitGuarded,
  updatePursuit as patchPursuit,
  updatePursuitWithActivity,
} from "@/lib/db/pursuits";
import { clearQuestions as deleteQuestions } from "@/lib/db/questions";
import type { Activity, Pursuit, PursuitStage } from "@/lib/db/schema";
import { listDirectors } from "@/lib/portal/directors";
import { deleteObjects } from "./s3";
import * as actions from "./actions";
import type { PursuitFormInput } from "./actions";

vi.mock("@/lib/db/desk-actions", () => ({ readRelatedActions: vi.fn().mockResolvedValue([]) }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: async () => ({ users: { getUser } }) }));
vi.mock("./s3", () => ({ deleteObjects: vi.fn() }));
vi.mock("@/lib/db/pursuits", () => ({
  getPursuit: vi.fn(),
  createPursuitWithEnquiry: vi.fn(),
  updatePursuit: vi.fn(),
  deletePursuitGuarded: vi.fn(),
  takePursuitGuarded: vi.fn(),
  declinePursuitGuarded: vi.fn(),
  declinePursuitGuardedWithActivity: vi.fn(),
  updatePursuitWithActivity: vi.fn(),
}));
vi.mock("@/lib/db/activity", () => ({ addActivity: vi.fn(), addResearchDerivedNote: vi.fn(), listActivity: vi.fn() }));
vi.mock("@/lib/db/documents", () => ({ listDocuments: vi.fn() }));
vi.mock("@/lib/db/questions", () => ({ clearQuestions: vi.fn() }));
vi.mock("@/lib/portal/directors", () => ({ listDirectors: vi.fn() }));

const NOW = new Date("2026-09-09T09:00:00Z");

function makePursuit(overrides: Partial<Pursuit> = {}): Pursuit {
  return {
    id: "p1",
    firm: "Brewster Bye Architects",
    contactName: "Jane Partner",
    contactEmail: "jane@bba.co.uk",
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: "Technical / defects dispute",
    approximateValue: null,
    forum: null,
    summary: null,
    source: "site_form",
    sourceDetail: null,
    ownerId: null,
    stage: "enquiry",
    stageChangedAt: NOW,
    nextAction: null,
    nextActionDue: null,
    reviewDue: null,
    createdBy: "site",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function stageChange(from: PursuitStage, to: PursuitStage, createdAt: string): Activity {
  return {
    id: `${from}-${to}`,
    pursuitId: "p1",
    kind: "stage_changed",
    actorId: "user_wr",
    body: null,
    meta: { from, to, reason: "Because" },
    createdAt: new Date(createdAt),
  };
}

const validForm: PursuitFormInput = {
  firm: "  Kubik Construction Ltd ",
  contactName: "Matt Bruce",
  contactEmail: "Matt@Kubik.co.uk",
  contactPhone: "0113 000 0000",
  website: "kubik.co.uk",
  companyNumber: "sc 123456",
  party: "Kubik Construction Ltd",
  partyCompanyNumber: "",
  counterparty: "Balfour Beatty",
  disputeNature: "Quantum / final account dispute",
  approximateValue: "Under £1m",
  forum: "Adjudication",
  source: "referral",
  sourceDetail: "Introduced by Jane Partner",
  summary: "Final account dispute on a school.",
};

beforeEach(() => {
  vi.mocked(deletePursuitGuarded).mockResolvedValue({ ok: true, blobKeys: [] });
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  process.env.CLERK_SECRET_KEY = "sk_test";
  process.env.DATABASE_URL = "postgres://test";
  vi.mocked(auth).mockResolvedValue({ userId: "user_wr" } as never);
  getUser.mockResolvedValue({ publicMetadata: { role: "director" } });
  vi.mocked(listDirectors).mockResolvedValue([
    { id: "user_wr", name: "William Rogers", email: "wr@meritusvia.com", initials: "WR" },
    { id: "user_md", name: "Mateo Diaz", email: "md@meritusvia.com", initials: "MD" },
  ]);
  vi.mocked(getPursuit).mockResolvedValue(makePursuit());
  vi.mocked(createPursuitWithEnquiry).mockImplementation(async (values) => ({
    pursuit: makePursuit(values as Partial<Pursuit>),
    activity: {} as Activity,
  }));
  vi.mocked(patchPursuit).mockImplementation(async (_id, values) => makePursuit(values as Partial<Pursuit>));
  vi.mocked(takePursuitGuarded).mockResolvedValue(true);
  vi.mocked(declinePursuitGuarded).mockResolvedValue(true);
  vi.mocked(declinePursuitGuardedWithActivity).mockResolvedValue(true);
  vi.mocked(updatePursuitWithActivity).mockImplementation(async (id, values) => makePursuit({ id, ...values }));
  vi.mocked(addActivity).mockResolvedValue({} as Activity);
  vi.mocked(addResearchDerivedNote).mockResolvedValue(true);
  vi.mocked(listActivity).mockResolvedValue([]);
  vi.mocked(listDocuments).mockResolvedValue([]);
  vi.mocked(deleteQuestions).mockResolvedValue(undefined);
  vi.mocked(deleteObjects).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectRevalidated() {
  expect(revalidatePath).toHaveBeenCalledWith("/portal", "layout");
}

describe("the action guard", () => {
  it("rejects a signed-in client before touching pursuit data", async () => {
    getUser.mockResolvedValue({ publicMetadata: { role: "client" } });
    expect(await actions.addNote("p1", "Client attempt")).toEqual({ ok: false, error: "Director access required" });
    expect(getPursuit).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
  });
  it("asks the director to sign in again when there is no session and touches nothing", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const result = await actions.addNote("p1", "Spoke to Jane.");
    expect(result).toEqual({ ok: false, error: "Sign in again" });
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("reports missing configuration as an error rather than throwing", async () => {
    delete process.env.CLERK_SECRET_KEY;
    const result = await actions.addNote("p1", "Spoke to Jane.");
    expect(result).toEqual({ ok: false, error: "Clerk is not configured" });
    expect(auth).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("reports a missing database before touching Clerk", async () => {
    delete process.env.DATABASE_URL;
    const result = await actions.addNote("p1", "Spoke to Jane.");
    expect(result).toEqual({ ok: false, error: "DATABASE_URL is not configured" });
    expect(auth).not.toHaveBeenCalled();
  });

  it("returns a plain error when the database throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(patchPursuit).mockRejectedValue(new Error("connection refused"));
    vi.mocked(updatePursuitWithActivity).mockRejectedValue(new Error("connection refused"));
    const result = await actions.setOwner("p1", "user_md");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("connection refused");
    expectRevalidated();
  });
});

describe("takePursuit", () => {
  it("assigns the pursuit to the signed-in director and logs the assignment", async () => {
    const result = await actions.takePursuit("p1");
    expect(result).toEqual({ ok: true });
    expect(takePursuitGuarded).toHaveBeenCalledWith("p1", "user_wr");
    expect(addActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        pursuitId: "p1",
        kind: "assigned",
        actorId: "user_wr",
        meta: { ownerId: "user_wr" },
      })
    );
    expectRevalidated();
  });

  it("names the director who took it first when the guard finds an owner", async () => {
    vi.mocked(takePursuitGuarded).mockResolvedValue(false);
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ ownerId: "user_md" }));
    const result = await actions.takePursuit("p1");
    expect(result).toEqual({ ok: false, error: "Taken by MD a moment ago" });
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("reports a pursuit that no longer exists", async () => {
    vi.mocked(takePursuitGuarded).mockResolvedValue(false);
    vi.mocked(getPursuit).mockResolvedValue(null);
    const result = await actions.takePursuit("p1");
    expect(result).toEqual({ ok: false, error: "This pursuit no longer exists" });
  });

  it("falls back to a plain retry message when the guard fails but nobody owns it", async () => {
    vi.mocked(takePursuitGuarded).mockResolvedValue(false);
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ ownerId: null }));
    const result = await actions.takePursuit("p1");
    expect(result).toEqual({ ok: false, error: "This pursuit has just changed, try again" });
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("names another director when the owner is not in the list", async () => {
    vi.mocked(takePursuitGuarded).mockResolvedValue(false);
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ ownerId: "user_gone" }));
    const result = await actions.takePursuit("p1");
    expect(result).toEqual({ ok: false, error: "Taken by another director a moment ago" });
  });
});

describe("declinePursuit", () => {
  it("requires a reason of at least three characters", async () => {
    const result = await actions.declinePursuit("p1", "no");
    expect(result).toEqual({ ok: false, error: "Give a reason (at least three characters)" });
    expect(declinePursuitGuardedWithActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("declines from the inbox behind the guard and logs the stage change with the reason", async () => {
    const result = await actions.declinePursuit("p1", "  Already acting for the counterparty ");
    expect(result).toEqual({ ok: true });
    expect(declinePursuitGuardedWithActivity).toHaveBeenCalledWith(
      "p1",
      "user_wr",
      expect.any(Date),
      expect.objectContaining({
        kind: "stage_changed",
        actorId: "user_wr",
        body: "Moved to Declined",
        meta: { from: "enquiry", to: "declined", reason: "Already acting for the counterparty" },
      })
    );
    expectRevalidated();
  });

  it("names the director who took it first when the guard fails", async () => {
    vi.mocked(declinePursuitGuardedWithActivity).mockResolvedValue(false);
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ ownerId: "user_md" }));
    const result = await actions.declinePursuit("p1", "Out of scope");
    expect(result).toEqual({ ok: false, error: "Taken by MD a moment ago" });
    expect(addActivity).not.toHaveBeenCalled();
  });
});

describe("movePursuit", () => {
  it("refuses a move to the stage the pursuit is already at", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "scoping" }));
    const result = await actions.movePursuit("p1", "scoping");
    expect(result).toEqual({ ok: false, error: "Already at Scoping" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("refuses a move to Dormant without a reason", async () => {
    const result = await actions.movePursuit("p1", "dormant");
    expect(result).toEqual({ ok: false, error: "Give a reason (at least three characters)" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("rejects a stage that does not exist", async () => {
    const result = await actions.movePursuit("p1", "archived" as PursuitStage);
    expect(result).toEqual({ ok: false, error: "Choose a stage from the list" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
    expect(getPursuit).not.toHaveBeenCalled();
  });

  it("ignores a revisit date on a move that is not to Dormant", async () => {
    const result = await actions.movePursuit("p1", "proposal", undefined, "2026-10-01");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", {
      stage: "proposal",
      stageChangedAt: expect.any(Date),
    }, expect.anything());
  });

  it("moves to Dormant with a revisit date, stamps the change and logs it", async () => {
    const result = await actions.movePursuit(
      "p1",
      "dormant",
      "Waiting for the adjudicator's decision",
      "2026-10-01"
    );
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", {
      stage: "dormant",
      stageChangedAt: expect.any(Date),
      reviewDue: "2026-10-01",
    }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({
        kind: "stage_changed",
        actorId: "user_wr",
        body: "Moved to Dormant",
        meta: { from: "enquiry", to: "dormant", reason: "Waiting for the adjudicator's decision" },
      })
    );
    expectRevalidated();
  });

  it("refuses a revisit date that is not a date", async () => {
    const result = await actions.movePursuit("p1", "dormant", "Waiting on the client", "next week");
    expect(result).toEqual({ ok: false, error: "Give the revisit date as a valid date" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
  });

  it("moves to Scoping without a reason and leaves the next action alone", async () => {
    const result = await actions.movePursuit("p1", "scoping");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", {
      stage: "scoping",
      stageChangedAt: expect.any(Date),
    }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({
        kind: "stage_changed",
        body: "Moved to Scoping",
        meta: { from: "enquiry", to: "scoping", reason: null },
      })
    );
  });

  it("reports a pursuit that no longer exists", async () => {
    vi.mocked(getPursuit).mockResolvedValue(null);
    const result = await actions.movePursuit("p1", "scoping");
    expect(result).toEqual({ ok: false, error: "This pursuit no longer exists" });
  });
});

describe("reopenPursuit", () => {
  it("reopens a dormant pursuit at the stage it left and logs it", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "dormant" }));
    vi.mocked(listActivity).mockResolvedValue([
      stageChange("enquiry", "scoping", "2026-08-01T09:00:00Z"),
      stageChange("proposal", "dormant", "2026-08-20T09:00:00Z"),
    ]);
    const result = await actions.reopenPursuit("p1");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", {
      stage: "proposal",
      stageChangedAt: expect.any(Date),
      reviewDue: null,
    }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({
        kind: "reopened",
        actorId: "user_wr",
        body: "Reopened at Proposal",
        meta: { from: "dormant", to: "proposal" },
      })
    );
    expectRevalidated();
  });

  it("falls back to Enquiry when no stage change was recorded", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "declined" }));
    const result = await actions.reopenPursuit("p1");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", expect.objectContaining({ stage: "enquiry" }), expect.anything());
  });

  it("refuses to reopen a pursuit that is still open", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "scoping" }));
    const result = await actions.reopenPursuit("p1");
    expect(result).toEqual({ ok: false, error: "Only declined or dormant pursuits can be reopened" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
  });
});

describe("setOwner", () => {
  it("assigns a director and logs the assignment by name", async () => {
    const result = await actions.setOwner("p1", "user_md");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", { ownerId: "user_md" }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({
        kind: "assigned",
        actorId: "user_wr",
        body: "Assigned to Mateo Diaz",
        meta: { ownerId: "user_md" },
      })
    );
    expectRevalidated();
  });

  it("returns a pursuit to the inbox when the owner is cleared", async () => {
    const result = await actions.setOwner("p1", null);
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", { ownerId: null }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({
        kind: "assigned",
        body: "Returned to the inbox",
        meta: { ownerId: null },
      })
    );
  });

  it("reports a pursuit that no longer exists", async () => {
    vi.mocked(updatePursuitWithActivity).mockResolvedValue(null);
    const result = await actions.setOwner("p1", "user_md");
    expect(result).toEqual({ ok: false, error: "This pursuit no longer exists" });
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("refuses an owner who is not a current director", async () => {
    const result = await actions.setOwner("p1", "user_zz");
    expect(result).toEqual({ ok: false, error: "Choose a director from the list" });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("takes the choice on trust when the director list cannot be read", async () => {
    vi.mocked(listDirectors).mockResolvedValue([]);
    const result = await actions.setOwner("p1", "user_md");
    expect(result).toEqual({ ok: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", { ownerId: "user_md" }, expect.anything());
    expect(updatePursuitWithActivity).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      expect.objectContaining({ kind: "assigned", body: "Assigned to a director", meta: { ownerId: "user_md" } })
    );
  });
});

describe("setNextAction", () => {
  it("refuses obsolete clients without writing legacy fields", async () => {
    expect(await actions.setNextAction("p1", "Old text", "2026-09-12")).toMatchObject({ ok: false, error: expect.stringContaining("Refresh") });
    expect(updatePursuitWithActivity).not.toHaveBeenCalled();
  });
});

describe("addNote", () => {
  it("refuses an empty note", async () => {
    const result = await actions.addNote("p1", "   ");
    expect(result).toEqual({ ok: false, error: "Write the note first" });
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("keeps a note to 4,000 characters", async () => {
    const result = await actions.addNote("p1", "y".repeat(4001));
    expect(result).toEqual({ ok: false, error: "Keep the note to 4,000 characters" });
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("stores a trimmed note against the pursuit", async () => {
    const result = await actions.addNote("p1", "  Spoke to Jane, they are the defendant.  ");
    expect(result).toEqual({ ok: true });
    expect(addActivity).toHaveBeenCalledWith({
      pursuitId: "p1",
      kind: "note",
      actorId: "user_wr",
      body: "Spoke to Jane, they are the defendant.",
    });
  });

  it("reports a pursuit that no longer exists", async () => {
    vi.mocked(getPursuit).mockResolvedValue(null);
    const result = await actions.addNote("p1", "Spoke to Jane.");
    expect(result).toEqual({ ok: false, error: "This pursuit no longer exists" });
    expect(addActivity).not.toHaveBeenCalled();
  });
});

describe("saveAnswerAsNote", () => {
  it("stores the answer as a note", async () => {
    const result = await actions.saveAnswerAsNote("p1", "The firm is the architect, not the contractor.");
    expect(result).toEqual({ ok: true });
    expect(addResearchDerivedNote).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user_wr",
        body: "The firm is the architect, not the contractor.",
      })
    );
    expectRevalidated();
  });

  it("refuses an empty answer", async () => {
    const result = await actions.saveAnswerAsNote("p1", " ");
    expect(result).toEqual({ ok: false, error: "There is no answer to save" });
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("truncates a long answer to 4,000 characters rather than refusing it", async () => {
    const result = await actions.saveAnswerAsNote("p1", "z".repeat(4500));
    expect(result).toEqual({ ok: true });
    const call = vi.mocked(addResearchDerivedNote).mock.calls[0][0];
    expect(call.body).toHaveLength(4000);
  });
  it("refuses a saved answer when its source was withdrawn during generation", async () => {
    vi.mocked(addResearchDerivedNote).mockResolvedValue(false);
    expect(await actions.saveAnswerAsNote("p1", "Old generated text")).toEqual({ ok: false, error: "The research source has changed; refresh the answer before saving" });
    expect(addActivity).not.toHaveBeenCalled();
  });
});

describe("clearQuestions", () => {
  it("deletes the thread for the pursuit", async () => {
    const result = await actions.clearQuestions("p1");
    expect(result).toEqual({ ok: true });
    expect(deleteQuestions).toHaveBeenCalledWith("p1");
    expectRevalidated();
  });
});

describe("setCompanyNumber", () => {
  it("normalises and stores the firm's number", async () => {
    const result = await actions.setCompanyNumber("p1", " sc 123456 ", "firm");
    expect(result).toEqual({ ok: true });
    expect(patchPursuit).toHaveBeenCalledWith("p1", { companyNumber: "SC123456" });
    expectRevalidated();
  });

  it("stores the party's number on the party column", async () => {
    const result = await actions.setCompanyNumber("p1", "04812345", "party");
    expect(result).toEqual({ ok: true });
    expect(patchPursuit).toHaveBeenCalledWith("p1", { partyCompanyNumber: "04812345" });
  });

  it("refuses a malformed number", async () => {
    const result = await actions.setCompanyNumber("p1", "1234", "firm");
    expect(result).toEqual({ ok: false, error: "Company numbers have eight characters" });
    expect(patchPursuit).not.toHaveBeenCalled();
  });
});

describe("createPursuit", () => {
  it("requires a firm", async () => {
    const result = await actions.createPursuit({ ...validForm, firm: "  " });
    expect(result).toEqual({ ok: false, error: "Give the firm's name" });
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("asks for the firm in the same words when the field is missing altogether", async () => {
    const result = await actions.createPursuit({ ...validForm, firm: undefined as unknown as string });
    expect(result).toEqual({ ok: false, error: "Give the firm's name" });
  });

  it("requires a nature of dispute from the shared list", async () => {
    const result = await actions.createPursuit({ ...validForm, disputeNature: "Something else" });
    expect(result).toEqual({ ok: false, error: "Choose the nature of the dispute" });
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a value band that is not in the shared list", async () => {
    const result = await actions.createPursuit({ ...validForm, approximateValue: "Loads" });
    expect(result).toEqual({ ok: false, error: "Choose a value band from the list" });
  });

  it("refuses a forum that is not in the shared list", async () => {
    const result = await actions.createPursuit({ ...validForm, forum: "Trial by combat" });
    expect(result).toEqual({ ok: false, error: "Choose a forum from the list" });
  });

  it("refuses a malformed email address", async () => {
    const result = await actions.createPursuit({ ...validForm, contactEmail: "not-an-email" });
    expect(result).toEqual({ ok: false, error: "Give a valid email address" });
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a website that is not an address", async () => {
    const result = await actions.createPursuit({ ...validForm, website: "not a website" });
    expect(result).toEqual({ ok: false, error: "Give a valid website address" });
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a malformed company number", async () => {
    const result = await actions.createPursuit({ ...validForm, companyNumber: "123" });
    expect(result).toEqual({ ok: false, error: "Company numbers have eight characters" });
  });

  it("refuses a source the desk does not offer", async () => {
    const result = await actions.createPursuit({
      ...validForm,
      source: "site_form" as PursuitFormInput["source"],
    });
    expect(result).toEqual({ ok: false, error: "Choose where the pursuit came from" });
  });

  it("keeps the summary to 4,000 characters", async () => {
    const result = await actions.createPursuit({ ...validForm, summary: "s".repeat(4001) });
    expect(result).toEqual({ ok: false, error: "Keep the summary to 4,000 characters" });
  });

  it("creates the pursuit at Enquiry owned by the creator, normalises the details and logs it", async () => {
    const result = await actions.createPursuit(validForm);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.id).toEqual(expect.any(String));
    expect(createPursuitWithEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        firm: "Kubik Construction Ltd",
        contactName: "Matt Bruce",
        contactEmail: "matt@kubik.co.uk",
        contactPhone: "0113 000 0000",
        website: "https://kubik.co.uk/",
        companyNumber: "SC123456",
        party: "Kubik Construction Ltd",
        partyCompanyNumber: null,
        counterparty: "Balfour Beatty",
        disputeNature: "Quantum / final account dispute",
        approximateValue: "Under £1m",
        forum: "Adjudication",
        source: "referral",
        sourceDetail: "Introduced by Jane Partner",
        summary: "Final account dispute on a school.",
        ownerId: "user_wr",
        stage: "enquiry",
        stageChangedAt: expect.any(Date),
        createdBy: "user_wr",
      }),
      { kind: "created", actorId: "user_wr", body: "Created Kubik Construction Ltd" }
    );
    expect(addActivity).not.toHaveBeenCalled();
    expectRevalidated();
  });

  it("stores empty optional fields as null", async () => {
    const result = await actions.createPursuit({
      firm: "Newton Wood",
      disputeNature: "General advisory",
      source: "other",
      contactEmail: "",
      website: "",
      approximateValue: "",
      forum: "",
    });
    expect(result.ok).toBe(true);
    expect(createPursuitWithEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        contactEmail: null,
        website: null,
        approximateValue: null,
        forum: null,
        contactName: null,
        summary: null,
      }),
      expect.anything()
    );
  });
});

describe("updatePursuit", () => {
  it("validates and patches the details without touching stage or owner", async () => {
    const result = await actions.updatePursuit("p1", validForm);
    expect(result).toEqual({ ok: true });
    expect(patchPursuit).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        firm: "Kubik Construction Ltd",
        contactEmail: "matt@kubik.co.uk",
        website: "https://kubik.co.uk/",
        companyNumber: "SC123456",
        source: "referral",
      })
    );
    const patch = vi.mocked(patchPursuit).mock.calls[0][1];
    expect(patch).not.toHaveProperty("stage");
    expect(patch).not.toHaveProperty("ownerId");
    expect(patch).not.toHaveProperty("createdBy");
    expectRevalidated();
  });

  it("returns the first validation error", async () => {
    const result = await actions.updatePursuit("p1", { ...validForm, firm: "" });
    expect(result.ok).toBe(false);
    expect(patchPursuit).not.toHaveBeenCalled();
  });

  it("keeps the site form as a source on a pursuit that came from the site", async () => {
    const result = await actions.updatePursuit("p1", {
      ...validForm,
      source: "site_form" as PursuitFormInput["source"],
    });
    expect(result).toEqual({ ok: true });
    expect(patchPursuit).toHaveBeenCalledWith("p1", expect.objectContaining({ source: "site_form" }));
  });

  it("reports a pursuit that no longer exists", async () => {
    vi.mocked(patchPursuit).mockResolvedValue(null);
    const result = await actions.updatePursuit("p1", validForm);
    expect(result).toEqual({ ok: false, error: "This pursuit no longer exists" });
  });
});

describe("deletePursuit", () => {
  it("deletes the database row before touching captured blobs", async () => {
    vi.mocked(deletePursuitGuarded).mockResolvedValue({ ok: true, blobKeys: ["owned.pdf"] });
    expect(await actions.deletePursuit("p1")).toEqual({ ok: true });
    expect(deleteObjects).toHaveBeenCalledWith(["owned.pdf"]);
    expect(vi.mocked(deletePursuitGuarded).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deleteObjects).mock.invocationCallOrder[0]);
  });
  it("never touches blobs after a refused deletion", async () => {
    vi.mocked(deletePursuitGuarded).mockResolvedValue({ ok: false, code: "linked_actions" });
    expect(await actions.deletePursuit("p1")).toMatchObject({ ok: false });
    expect(deleteObjects).not.toHaveBeenCalled();
  });
  it("records cleanup failure without falsely refusing a completed deletion", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deletePursuitGuarded).mockResolvedValue({ ok: true, blobKeys: ["owned.pdf"] });
    vi.mocked(deleteObjects).mockRejectedValue(new Error("S3 unavailable"));
    expect(await actions.deletePursuit("p1")).toEqual({ ok: true });
    expect(error).toHaveBeenCalled();
  });
});

describe("every action revalidates the portal tree", () => {
  const cases: Array<[string, () => Promise<{ ok: boolean }>]> = [
    ["createPursuit", () => actions.createPursuit(validForm)],
    ["updatePursuit", () => actions.updatePursuit("p1", validForm)],
    ["deletePursuit", () => actions.deletePursuit("p1")],
    ["takePursuit", () => actions.takePursuit("p1")],
    ["declinePursuit", () => actions.declinePursuit("p1", "Out of scope")],
    ["movePursuit", () => actions.movePursuit("p1", "scoping")],
    ["reopenPursuit", () => actions.reopenPursuit("p1")],
    ["setOwner", () => actions.setOwner("p1", "user_md")],
    ["addNote", () => actions.addNote("p1", "Spoke to Jane.")],
    ["saveAnswerAsNote", () => actions.saveAnswerAsNote("p1", "An answer.")],
    ["clearQuestions", () => actions.clearQuestions("p1")],
    ["setCompanyNumber", () => actions.setCompanyNumber("p1", "04812345", "firm")],
  ];

  it.each(cases)("%s revalidates after success", async (_name, run) => {
    await run();
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expectRevalidated();
  });

  it.each(cases)("%s revalidates after a failure", async (_name, run) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPursuit).mockRejectedValue(new Error("boom"));
    vi.mocked(patchPursuit).mockRejectedValue(new Error("boom"));
    vi.mocked(updatePursuitWithActivity).mockRejectedValue(new Error("boom"));
    vi.mocked(declinePursuitGuardedWithActivity).mockRejectedValue(new Error("boom"));
    vi.mocked(createPursuitWithEnquiry).mockRejectedValue(new Error("boom"));
    vi.mocked(takePursuitGuarded).mockRejectedValue(new Error("boom"));
    vi.mocked(deleteQuestions).mockRejectedValue(new Error("boom"));
    vi.mocked(deletePursuitGuarded).mockRejectedValue(new Error("boom"));
    const result = await run();
    expect(result.ok).toBe(false);
    expectRevalidated();
  });
});

describe("stage action independence", () => {
  it("preserves open actions and returns a review affordance when instructed", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "proposal" }));
    vi.mocked(readRelatedActions).mockResolvedValueOnce([viewFixture(), viewFixture({ id: "done", state: "completed" })]);
    expect(await actions.movePursuit("p1", "instructed")).toEqual({ ok: true, remainingActions: 1 });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", { stage: "instructed", stageChangedAt: expect.any(Date) }, expect.anything());
  });
  it("retains successful stage changes when the remaining-actions read fails", async () => {
    vi.mocked(getPursuit).mockResolvedValue(makePursuit({ stage: "proposal" }));
    vi.mocked(readRelatedActions).mockRejectedValueOnce(new Error("Action read unavailable"));
    expect(await actions.movePursuit("p1", "instructed")).toEqual({ ok: true, remainingActionsUnavailable: true });
    expect(updatePursuitWithActivity).toHaveBeenCalledWith("p1", expect.objectContaining({ stage: "instructed" }), expect.anything());
  });
});
