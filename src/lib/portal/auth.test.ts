// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { resolveIdentity } from "./roles";
import { requireActionUser, requireClientUser, requirePortalUser } from "./auth";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("./roles", () => ({ resolveIdentity: vi.fn() }));

const director = { userId: "user_wr", role: "director" as const, domain: null, email: "william@meritusvia.com" };
const client = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  process.env.CLERK_SECRET_KEY = "sk_test";
  process.env.DATABASE_URL = "postgres://test";
  vi.mocked(auth).mockResolvedValue({ userId: "user_wr", sessionClaims: { sub: "user_wr" } } as never);
  vi.mocked(resolveIdentity).mockResolvedValue(director);
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.DATABASE_URL;
});

describe("requirePortalUser", () => {
  it("admits a director", async () => {
    expect(await requirePortalUser()).toEqual({ userId: "user_wr" });
    expect(resolveIdentity).toHaveBeenCalledWith("user_wr", { sub: "user_wr" });
  });
  it("answers 401 when nobody is signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(401);
  });
  it("answers 403 to a client and to a user with no role", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect((await requirePortalUser()).error?.status).toBe(403);
    vi.mocked(resolveIdentity).mockResolvedValue({ ...director, role: null });
    const result = await requirePortalUser();
    expect(result.error?.status).toBe(403);
    expect(await result.error?.json()).toEqual({ error: "Directors only", code: "FORBIDDEN" });
  });
  it("answers 503 when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;
    expect((await requirePortalUser()).error?.status).toBe(503);
  });
});

describe("requireActionUser", () => {
  it("admits a director", async () => {
    expect(await requireActionUser()).toEqual({ ok: true, userId: "user_wr" });
  });
  it("refuses a client", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect(await requireActionUser()).toEqual({ ok: false, error: "Directors only" });
  });
  it("asks for a sign-in when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    expect(await requireActionUser()).toEqual({ ok: false, error: "Sign in again" });
  });
});

describe("requireClientUser", () => {
  it("admits a client with their domain", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_c", sessionClaims: null } as never);
    vi.mocked(resolveIdentity).mockResolvedValue(client);
    expect(await requireClientUser()).toEqual({ identity: client });
  });
  it("admits a director with no domain", async () => {
    expect(await requireClientUser()).toEqual({ identity: director });
  });
  it("answers 403 to a user with no role and 401 to nobody", async () => {
    vi.mocked(resolveIdentity).mockResolvedValue({ ...client, role: null });
    expect((await requireClientUser()).error?.status).toBe(403);
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    expect((await requireClientUser()).error?.status).toBe(401);
  });
});
