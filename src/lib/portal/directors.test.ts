// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserList, getUser, clerkClient, listClientDomainNames } = vi.hoisted(() => {
  const getUserList = vi.fn();
  const getUser = vi.fn();
  const listClientDomainNames = vi.fn(async () => [] as string[]);
  const clerkClient = vi.fn(async () => ({ users: { getUserList, getUser } }));
  return { getUserList, getUser, clerkClient, listClientDomainNames };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient }));
vi.mock("@/lib/db/client-domains", () => ({
  listClientDomainNames,
  listClientDomainHosts: listClientDomainNames,
}));

import {
  UNASSIGNED_INITIALS,
  UNASSIGNED_NAME,
  __resetDirectorsCache,
  directorInitials,
  directorName,
  getActorKind,
  getDirector,
  initialsFor,
  listDirectors,
  type Director,
} from "./directors";
import * as helpers from "./director-helpers";

type ClerkEmail = { id: string; emailAddress: string };

function clerkUser(overrides: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmail[];
  publicMetadata?: Record<string, unknown> | null;
}) {
  return {
    firstName: null,
    lastName: null,
    primaryEmailAddressId: null,
    emailAddresses: [],
    publicMetadata: null,
    ...overrides,
  };
}

const william = clerkUser({
  id: "user_wr",
  firstName: "William",
  lastName: "Rogers",
  primaryEmailAddressId: "em_wr_primary",
  emailAddresses: [
    { id: "em_wr_old", emailAddress: "old@example.com" },
    { id: "em_wr_primary", emailAddress: "william@meritusvia.com" },
  ],
});

const mateo = clerkUser({
  id: "user_ma",
  primaryEmailAddressId: "em_ma",
  emailAddresses: [{ id: "em_ma", emailAddress: "mateo@x.com" }],
});

const expectedMateo: Director = {
  id: "user_ma",
  name: "mateo@x.com",
  email: "mateo@x.com",
  initials: "MA",
};

const expectedWilliam: Director = {
  id: "user_wr",
  name: "William Rogers",
  email: "william@meritusvia.com",
  initials: "WR",
};

const savedEnv = {
  publishable: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secret: process.env.CLERK_SECRET_KEY,
};

function restoreEnv() {
  if (savedEnv.publishable === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = savedEnv.publishable;
  if (savedEnv.secret === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = savedEnv.secret;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_directors";
  process.env.CLERK_SECRET_KEY = "sk_test_directors";
  __resetDirectorsCache();
  clerkClient.mockClear();
  getUserList.mockReset();
  getUser.mockReset();
  listClientDomainNames.mockReset();
  listClientDomainNames.mockResolvedValue([]);
  getUser.mockRejectedValue(new Error("not found"));
  getUserList.mockResolvedValue({ data: [william, mateo], totalCount: 2 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  restoreEnv();
});

describe("initialsFor", () => {
  it("takes the first letters of the first and last names", () => {
    expect(initialsFor({ firstName: "William", lastName: "Rogers" })).toBe("WR");
  });

  it("upper-cases and ignores surrounding whitespace", () => {
    expect(initialsFor({ firstName: " mateo ", lastName: " alvarez " })).toBe("MA");
  });

  it("gives a single letter when only one name is known", () => {
    expect(initialsFor({ firstName: "William", lastName: null, email: "w@x.com" })).toBe("W");
    expect(initialsFor({ firstName: null, lastName: "Rogers", email: "w@x.com" })).toBe("R");
  });

  it("falls back to the first two letters of the email when there are no names", () => {
    expect(initialsFor({ firstName: null, lastName: null, email: "mateo@x.com" })).toBe("MA");
    expect(initialsFor({ email: "w.rogers@x.com" })).toBe("WR");
  });

  it("is empty when nothing is known", () => {
    expect(initialsFor({})).toBe("");
    expect(initialsFor({ firstName: "", lastName: "", email: "" })).toBe("");
  });
});

describe("listDirectors", () => {
  it("maps Clerk users to directors using the primary email, sorted by name", async () => {
    await expect(listDirectors()).resolves.toEqual([expectedMateo, expectedWilliam]);
    expect(getUserList).toHaveBeenCalledWith({ limit: 50 });
  });

  it("omits Clerk users invited as clients", async () => {
    const client = clerkUser({
      id: "user_client",
      firstName: "Jane",
      lastName: "Counsel",
      publicMetadata: { role: "client" },
      emailAddresses: [{ id: "em_c", emailAddress: "jane@firm.com" }],
      primaryEmailAddressId: "em_c",
    });
    getUserList.mockResolvedValue({ data: [william, client], totalCount: 2 });
    await expect(listDirectors()).resolves.toEqual([expectedWilliam]);
    await expect(getActorKind("user_client")).resolves.toBe("client");
    await expect(getActorKind("user_wr")).resolves.toBe("director");
  });

  it("omits Clerk users whose email domain is a listed client domain", async () => {
    const jane = clerkUser({
      id: "user_jane",
      firstName: "Jane",
      lastName: "Bree",
      emailAddresses: [{ id: "em_j", emailAddress: "jane@bree.co.uk" }],
      primaryEmailAddressId: "em_j",
    });
    listClientDomainNames.mockResolvedValue(["bree.co.uk"]);
    getUserList.mockResolvedValue({ data: [william, jane], totalCount: 2 });
    await expect(listDirectors()).resolves.toEqual([expectedWilliam]);
    await expect(getActorKind("user_jane")).resolves.toBe("client");
    await expect(getActorKind("user_wr")).resolves.toBe("director");
  });

  it("never treats meritusvia.com as a client domain", async () => {
    listClientDomainNames.mockResolvedValue(["meritusvia.com"]);
    getUserList.mockResolvedValue({ data: [william], totalCount: 1 });
    await expect(listDirectors()).resolves.toEqual([expectedWilliam]);
    await expect(getActorKind("user_wr")).resolves.toBe("director");
  });

  it("serves the cached list on the second call", async () => {
    await listDirectors();
    await listDirectors();
    expect(getUserList).toHaveBeenCalledTimes(1);
    expect(clerkClient).toHaveBeenCalledTimes(1);
  });

  it("shares one Clerk request between concurrent calls", async () => {
    const [first, second] = await Promise.all([listDirectors(), listDirectors()]);
    expect(first).toEqual(second);
    expect(getUserList).toHaveBeenCalledTimes(1);
  });

  it("fetches again once __resetDirectorsCache has been called", async () => {
    await listDirectors();
    __resetDirectorsCache();
    await listDirectors();
    expect(getUserList).toHaveBeenCalledTimes(2);
  });

  it("fetches again once five minutes have passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    await listDirectors();
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    await listDirectors();
    expect(getUserList).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await listDirectors();
    expect(getUserList).toHaveBeenCalledTimes(2);
  });

  it("is empty without calling Clerk when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;
    await expect(listDirectors()).resolves.toEqual([]);
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("gives up with an empty list after eight seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserList.mockReturnValue(new Promise(() => {}));
    const pending = listDirectors();
    await vi.advanceTimersByTimeAsync(7_999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual([]);
  });

  it("does not cache a timed-out attempt", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserList.mockReturnValueOnce(new Promise(() => {}));
    const pending = listDirectors();
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(pending).resolves.toEqual([]);
    await expect(listDirectors()).resolves.toEqual([expectedMateo, expectedWilliam]);
    expect(getUserList).toHaveBeenCalledTimes(2);
  });

  it("returns a list that arrives inside the timeout", async () => {
    vi.useFakeTimers();
    getUserList.mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() => resolve({ data: [mateo], totalCount: 1 }), 1_000);
      })
    );
    const pending = listDirectors();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual([expectedMateo]);
  });

  it("is empty, and not cached, when Clerk throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserList.mockRejectedValueOnce(new Error("Clerk is down"));
    await expect(listDirectors()).resolves.toEqual([]);
    await expect(listDirectors()).resolves.toEqual([expectedMateo, expectedWilliam]);
  });

  it("uses the first email when a user has no primary, and the email as the name", async () => {
    getUserList.mockResolvedValue({
      data: [
        clerkUser({
          id: "user_np",
          emailAddresses: [{ id: "em_np", emailAddress: "np@x.com" }],
        }),
      ],
      totalCount: 1,
    });
    await expect(listDirectors()).resolves.toEqual([
      { id: "user_np", name: "np@x.com", email: "np@x.com", initials: "NP" },
    ]);
  });
});

describe("getActorKind", () => {
  it("is null for a missing id without calling Clerk", async () => {
    await expect(getActorKind(null)).resolves.toBeNull();
    await expect(getActorKind(undefined)).resolves.toBeNull();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("is null for a user who is not in the cached list", async () => {
    await listDirectors();
    await expect(getActorKind("user_zz")).resolves.toBeNull();
  });

  it("classifies an unknown user from Clerk when they are not in the cache yet", async () => {
    await listDirectors();
    getUser.mockResolvedValue(
      clerkUser({
        id: "user_jane",
        emailAddresses: [{ id: "em_j", emailAddress: "jane@bree.co.uk" }],
        primaryEmailAddressId: "em_j",
      })
    );
    listClientDomainNames.mockResolvedValue(["bree.co.uk"]);
    await expect(getActorKind("user_jane")).resolves.toBe("client");
  });

  it("is null when Clerk is down so directors are not locked out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockRejectedValue(new Error("Clerk is down"));
    await expect(getActorKind("user_wr")).resolves.toBeNull();
  });

  it("classifies by email domain when the directors cache is empty", async () => {
    listClientDomainNames.mockResolvedValue(["bree.co.uk"]);
    getUser.mockResolvedValue(
      clerkUser({
        id: "user_jane",
        emailAddresses: [{ id: "em_j", emailAddress: "jane@bree.co.uk" }],
        primaryEmailAddressId: "em_j",
      })
    );
    await expect(getActorKind("user_jane")).resolves.toBe("client");
    expect(getUserList).not.toHaveBeenCalled();
  });
});

describe("getDirector", () => {
  it("finds a director by id", async () => {
    await expect(getDirector("user_wr")).resolves.toEqual(expectedWilliam);
  });

  it("is null for an unknown id", async () => {
    await expect(getDirector("user_zz")).resolves.toBeNull();
  });

  it("is null for a missing id without calling Clerk", async () => {
    await expect(getDirector(null)).resolves.toBeNull();
    await expect(getDirector(undefined)).resolves.toBeNull();
    expect(clerkClient).not.toHaveBeenCalled();
  });
});

describe("directorInitials", () => {
  const directors = [expectedMateo, expectedWilliam];

  it("gives the initials of a known director", () => {
    expect(directorInitials(directors, "user_wr")).toBe("WR");
  });

  it("gives the placeholder for an unknown or missing id", () => {
    expect(directorInitials(directors, "user_zz")).toBe(UNASSIGNED_INITIALS);
    expect(directorInitials(directors, null)).toBe(UNASSIGNED_INITIALS);
    expect(directorInitials([], undefined)).toBe(UNASSIGNED_INITIALS);
  });

  it("uses a placeholder that is not an em dash", () => {
    expect(UNASSIGNED_INITIALS).not.toContain("\u2014");
    expect(UNASSIGNED_INITIALS.length).toBeGreaterThan(0);
  });
});

describe("directorName", () => {
  const directors = [expectedMateo, expectedWilliam];

  it("gives the name of a known director", () => {
    expect(directorName(directors, "user_wr")).toBe("William Rogers");
  });

  it("reads Unassigned for an unknown or missing id", () => {
    expect(UNASSIGNED_NAME).toBe("Unassigned");
    expect(directorName(directors, "user_zz")).toBe("Unassigned");
    expect(directorName(directors, null)).toBe("Unassigned");
    expect(directorName([], undefined)).toBe("Unassigned");
  });
});

describe("director-helpers", () => {
  it("is the code the server module re-exports, so both import paths agree", () => {
    expect(helpers.initialsFor).toBe(initialsFor);
    expect(helpers.directorInitials).toBe(directorInitials);
    expect(helpers.directorName).toBe(directorName);
    expect(helpers.UNASSIGNED_INITIALS).toBe(UNASSIGNED_INITIALS);
    expect(helpers.UNASSIGNED_NAME).toBe(UNASSIGNED_NAME);
  });

  it("imports nothing from Clerk or Next, so client components can bundle it", () => {
    const source = readFileSync(fileURLToPath(new URL("./director-helpers.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/from\s+["'](@clerk\/|next\/|server-only)/);
  });
});
