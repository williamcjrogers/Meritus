// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePortalUser: vi.fn(),
  requireDatabaseOr503: vi.fn(),
  isBlobConfigured: vi.fn(),
  getPursuit: vi.fn(),
  storePortalDocument: vi.fn(),
}));

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return {
    ...actual,
    requirePortalUser: mocks.requirePortalUser,
    requireDatabaseOr503: mocks.requireDatabaseOr503,
  };
});
vi.mock("@/lib/env", () => ({ isBlobConfigured: mocks.isBlobConfigured }));
vi.mock("@/lib/db/pursuits", () => ({ getPursuit: mocks.getPursuit }));
vi.mock("@/lib/portal/upload", () => ({ storePortalDocument: mocks.storePortalDocument }));

import { POST } from "./route";

function request(body?: FormData): Request {
  return new Request("http://localhost/api/portal/pursuits/p1/documents", {
    method: "POST",
    body,
  });
}

function context(id = "p1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePortalUser.mockResolvedValue({ userId: "user_wr" });
  mocks.requireDatabaseOr503.mockReturnValue(null);
  mocks.isBlobConfigured.mockReturnValue(true);
  mocks.getPursuit.mockResolvedValue({ id: "p1", firm: "Brewster Bye Architects" });
  mocks.storePortalDocument.mockResolvedValue({ id: "d1", title: "Letter of claim.pdf" });
});

describe("POST /api/portal/pursuits/[id]/documents", () => {
  it("returns 404 when the pursuit does not exist", async () => {
    mocks.getPursuit.mockResolvedValue(null);
    const form = new FormData();
    form.append("file", new File(["%PDF"], "Letter of claim.pdf", { type: "application/pdf" }));
    const response = await POST(request(form), context("missing"));
    expect(response.status).toBe(404);
    expect(mocks.storePortalDocument).not.toHaveBeenCalled();
  });

  it("stores the file against the pursuit as the signed-in director", async () => {
    const form = new FormData();
    form.append("file", new File(["%PDF"], "Letter of claim.pdf", { type: "application/pdf" }));
    form.append("title", "Letter of claim");
    const response = await POST(request(form), context());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ document: { id: "d1", title: "Letter of claim.pdf" } });
    expect(mocks.storePortalDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "pursuit",
        pursuitId: "p1",
        uploadedBy: "user_wr",
        title: "Letter of claim",
      })
    );
  });

  it("returns 400 when no file is attached", async () => {
    const response = await POST(request(new FormData()), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "File is required" });
  });

  it("returns 400 rather than failing when the body is not a multipart form", async () => {
    const json = new Request("http://localhost/api/portal/pursuits/p1/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: "Letter of claim.pdf" }),
    });
    const response = await POST(json, context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Expected a multipart form" });
    expect(mocks.storePortalDocument).not.toHaveBeenCalled();
  });

  it("falls back to the file name when the title field is not text", async () => {
    const form = new FormData();
    form.append("file", new File(["%PDF"], "Letter of claim.pdf", { type: "application/pdf" }));
    form.append("title", new File(["x"], "odd.txt", { type: "text/plain" }));
    const response = await POST(request(form), context());
    expect(response.status).toBe(201);
    expect(mocks.storePortalDocument).toHaveBeenCalledWith(
      expect.objectContaining({ title: undefined })
    );
  });

  it("returns 400 with the message when the upload is refused", async () => {
    mocks.storePortalDocument.mockRejectedValue(new Error("File type not allowed"));
    const form = new FormData();
    form.append("file", new File(["MZ"], "setup.exe", { type: "application/octet-stream" }));
    const response = await POST(request(form), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "File type not allowed" });
  });

  it("passes the auth gate response through", async () => {
    const { NextResponse } = await import("next/server");
    mocks.requirePortalUser.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await POST(request(new FormData()), context());
    expect(response.status).toBe(401);
  });
});
