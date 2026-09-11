// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getActorKind } = vi.hoisted(() => ({
  auth: vi.fn(),
  getActorKind: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("./directors", () => ({ getActorKind }));

import { currentActorKind, requireActionUser, requirePortalUser } from "./auth";

const savedEnv = {
  publishable: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secret: process.env.CLERK_SECRET_KEY,
  database: process.env.DATABASE_URL,
};

function restoreEnv() {
  if (savedEnv.publishable === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = savedEnv.publishable;
  if (savedEnv.secret === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = savedEnv.secret;
  if (savedEnv.database === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedEnv.database;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  process.env.CLERK_SECRET_KEY = "sk_test";
  process.env.DATABASE_URL = "postgres://test";
  auth.mockReset();
  getActorKind.mockReset();
  auth.mockResolvedValue({ userId: "user_wr" });
  getActorKind.mockResolvedValue("director");
});

afterEach(() => {
  restoreEnv();
});

describe("requirePortalUser", () => {
  it("rejects a client", async () => {
    getActorKind.mockResolvedValue("client");
    const result = await requirePortalUser();
    expect(result.userId).toBeUndefined();
    expect(result.error?.status).toBe(403);
  });

  it("allows a director", async () => {
    await expect(requirePortalUser()).resolves.toEqual({ userId: "user_wr" });
  });

  it("allows when kind is unknown so a Clerk outage does not lock the desk", async () => {
    getActorKind.mockResolvedValue(null);
    await expect(requirePortalUser()).resolves.toEqual({ userId: "user_wr" });
  });
});

describe("requireActionUser", () => {
  it("rejects a client", async () => {
    getActorKind.mockResolvedValue("client");
    await expect(requireActionUser()).resolves.toEqual({
      ok: false,
      error: "This area is for directors only",
    });
  });
});

describe("currentActorKind", () => {
  it("reads the signed-in actor", async () => {
    getActorKind.mockResolvedValue("client");
    await expect(currentActorKind()).resolves.toBe("client");
    expect(getActorKind).toHaveBeenCalledWith("user_wr");
  });
});
