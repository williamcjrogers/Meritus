// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireClientUser, requireDatabaseOr503 } from "@/lib/portal/auth";
import { createUpload } from "@/lib/client-uploads/service";
import { POST } from "./route";

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requireClientUser: vi.fn(), requireDatabaseOr503: vi.fn() };
});
vi.mock("@/lib/client-uploads/service", () => ({ createUpload: vi.fn() }));

const identity = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/client/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireClientUser).mockResolvedValue({ identity });
  vi.mocked(requireDatabaseOr503).mockReturnValue(null);
  vi.mocked(createUpload).mockResolvedValue({ ok: true, id: "up_1", key: "meritus/clients/example-firm.co.uk/up_1-a.pdf", partSize: 32 * 1024 * 1024, partCount: 1 });
});

describe("POST /api/client/uploads", () => {
  it("opens an upload for the caller", async () => {
    const res = await post({ fileName: "a.pdf", size: 10, mime: "application/pdf" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, id: "up_1", partCount: 1 });
    expect(createUpload).toHaveBeenCalledWith(identity, { fileName: "a.pdf", size: 10, mime: "application/pdf" });
  });
  it("passes guard failures through", async () => {
    vi.mocked(requireClientUser).mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await post({ fileName: "a.pdf", size: 10 })).status).toBe(401);
    expect(createUpload).not.toHaveBeenCalled();
  });
  it("answers 400 to bad JSON or a bad file, and relays the service's status", async () => {
    expect((await post("{")).status).toBe(400);
    expect((await post({ fileName: "a.exe", size: 10 })).status).toBe(400);
    vi.mocked(createUpload).mockResolvedValue({ ok: false, status: 403, error: "No client domain" });
    const res = await post({ fileName: "a.pdf", size: 10 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No client domain" });
  });
});
