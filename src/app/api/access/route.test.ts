// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findClientDomainForEmail } from "@/lib/db/client-domains";
import { registerAccessAttempt } from "@/lib/db/throttle";
import { issueAccessLink } from "@/lib/access/link";
import { sendAccessLink } from "@/lib/access/mail";
import { POST } from "./route";

vi.mock("@/lib/db/client-domains", () => ({ findClientDomainForEmail: vi.fn() }));
vi.mock("@/lib/db/throttle", () => ({ registerAccessAttempt: vi.fn() }));
vi.mock("@/lib/access/link", () => ({ issueAccessLink: vi.fn() }));
vi.mock("@/lib/access/mail", () => ({ sendAccessLink: vi.fn() }));

/** `after()` work is captured so a test can wait for it; in Next it runs once the reply has gone. */
const deferred = vi.hoisted(() => ({ jobs: [] as Promise<unknown>[] }));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (work: () => Promise<unknown>) => {
      deferred.jobs.push(Promise.resolve().then(work));
    },
  };
});

async function settle() {
  await Promise.all(deferred.jobs.splice(0));
}

const domainRow = {
  id: "cd_1",
  domain: "example-firm.co.uk",
  firm: "Example Firm LLP",
  pursuitId: null,
  createdBy: "user_wr",
  createdAt: new Date("2026-09-12T09:00:00Z"),
  removedAt: null,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/access", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.mocked(registerAccessAttempt).mockResolvedValue(true);
  vi.mocked(findClientDomainForEmail).mockResolvedValue(domainRow);
  vi.mocked(issueAccessLink).mockResolvedValue({ ok: true, url: "https://meritusvia.com/access/continue?ticket=t", userId: "user_c" });
  vi.mocked(sendAccessLink).mockResolvedValue({ sentAt: "2026-09-12T09:00:00.000Z" });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/access", () => {
  it("issues and sends a link for a listed domain and answers generically", async () => {
    const res = await post({ email: "Jane@Example-Firm.co.uk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await settle();
    expect(registerAccessAttempt).toHaveBeenCalledWith({
      email: expect.stringMatching(/^access-email:[0-9a-f]{64}$/),
      ip: expect.stringMatching(/^access-ip:[0-9a-f]{64}$/),
    });
    expect(issueAccessLink).toHaveBeenCalledWith({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(sendAccessLink).toHaveBeenCalledWith({ to: "jane@example-firm.co.uk", url: "https://meritusvia.com/access/continue?ticket=t" });
  });

  it("answers the same way for an unlisted domain and sends nothing", async () => {
    vi.mocked(findClientDomainForEmail).mockResolvedValue(null);
    const res = await post({ email: "someone@unlisted.co.uk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await settle();
    expect(issueAccessLink).not.toHaveBeenCalled();
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it("answers the same way for a director's address", async () => {
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: false, reason: "director" });
    const res = await post({ email: "jane@example-firm.co.uk" });
    expect(res.status).toBe(200);
    await settle();
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it("refuses a bad address, bad JSON and a filled honeypot without any lookup", async () => {
    expect((await post({ email: "not an email" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    const trap = await post({ email: "jane@example-firm.co.uk", company_website: "http://spam" });
    expect(trap.status).toBe(200);
    expect(registerAccessAttempt).not.toHaveBeenCalled();
    expect(findClientDomainForEmail).not.toHaveBeenCalled();
  });

  it("answers 429 when throttled, before any lookup", async () => {
    vi.mocked(registerAccessAttempt).mockResolvedValue(false);
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(429);
    await settle();
    expect(findClientDomainForEmail).not.toHaveBeenCalled();
  });

  it("answers 503 when Resend or the database is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(503);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("DATABASE_URL", "");
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(503);
  });

  it("still answers 200 when the link cannot be prepared or sent, and logs only the domain id", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: false, reason: "clerk_error" });
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(200);
    await settle();
    expect(warn).toHaveBeenCalledWith("Access: link not prepared", { domainId: "cd_1" });
    vi.mocked(issueAccessLink).mockResolvedValue({ ok: true, url: "u", userId: "user_c" });
    vi.mocked(sendAccessLink).mockResolvedValue({ error: "boom" });
    expect((await post({ email: "jane@example-firm.co.uk" })).status).toBe(200);
    await settle();
    expect(warn).toHaveBeenCalledWith("Access: link not sent", { domainId: "cd_1", error: "boom" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("jane@");
  });
});
