// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "@/lib/db/documents";
import type { DocumentRow } from "@/lib/db/schema";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { DIRECT_DOWNLOAD_BYTES } from "@/lib/portal/files";
import { getObjectStream, presignDownload } from "@/lib/portal/s3-transfer";
import { GET } from "./route";

vi.mock("@/lib/portal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/auth")>("@/lib/portal/auth");
  return { ...actual, requirePortalUser: vi.fn(), requireDatabaseOr503: vi.fn() };
});
vi.mock("@/lib/env", () => ({ isStorageConfigured: () => true }));
vi.mock("@/lib/db/documents", () => ({ getDocument: vi.fn(), deleteDocumentRow: vi.fn() }));
vi.mock("@/lib/db/activity", () => ({ addActivity: vi.fn() }));
vi.mock("@/lib/portal/s3", () => ({ deleteObjects: vi.fn() }));
vi.mock("@/lib/portal/s3-transfer", () => ({ getObjectStream: vi.fn(), presignDownload: vi.fn() }));

function doc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "d1",
    scope: "pursuit",
    pursuitId: "p1",
    clientDomainId: "cd_1",
    title: "Trial bundle.pdf",
    blobUrl: "s3://vericase-test/meritus/clients/x/d1-Trial bundle.pdf",
    blobPathname: "meritus/clients/x/d1-Trial bundle.pdf",
    fileName: "Trial bundle.pdf",
    mime: "application/pdf",
    size: 1234,
    extractedText: null,
    uploadedBy: "user_c",
    uploaderEmail: "jane@example-firm.co.uk",
    createdAt: new Date("2026-09-12T10:00:00Z"),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "d1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePortalUser).mockResolvedValue({ userId: "user_wr" });
  vi.mocked(requireDatabaseOr503).mockReturnValue(null);
  vi.mocked(getDocument).mockResolvedValue(doc());
  vi.mocked(getObjectStream).mockResolvedValue({
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("%PDF")); controller.close(); } }),
    size: 1234,
    contentType: "application/pdf",
  });
  vi.mocked(presignDownload).mockResolvedValue("https://vericase-test.s3.eu-west-2.amazonaws.com/k?X-Amz-Expires=60");
});

describe("GET /api/portal/documents/[id]", () => {
  it("streams a small file as an attachment with the right headers", async () => {
    const res = await GET(new Request("http://localhost/api/portal/documents/d1"), context);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe("1234");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="Trial bundle.pdf"; filename*=UTF-8''Trial%20bundle.pdf`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("%PDF");
    expect(presignDownload).not.toHaveBeenCalled();
  });

  it("redirects a large file to a one-minute presigned url", async () => {
    vi.mocked(getDocument).mockResolvedValue(doc({ size: DIRECT_DOWNLOAD_BYTES + 1 }));
    const res = await GET(new Request("http://localhost/api/portal/documents/d1"), context);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("X-Amz-Expires=60");
    expect(presignDownload).toHaveBeenCalledWith("meritus/clients/x/d1-Trial bundle.pdf", "Trial bundle.pdf");
    expect(getObjectStream).not.toHaveBeenCalled();
  });

  it("answers 404 when the row or the object is missing", async () => {
    vi.mocked(getObjectStream).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(404);
    vi.mocked(getDocument).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(404);
  });

  it("passes the guard's answer through", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requirePortalUser).mockResolvedValue({ error: NextResponse.json({ error: "Directors only" }, { status: 403 }) });
    expect((await GET(new Request("http://localhost/api/portal/documents/d1"), context)).status).toBe(403);
  });
});
