// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveClientDomain } from "@/lib/db/client-domains";
import { getClientUpload, insertClientUpload, listStaleClientUploads, updateClientUpload } from "@/lib/db/client-uploads";
import { insertDocument } from "@/lib/db/documents";
import type { ClientUpload, DocumentRow } from "@/lib/db/schema";
import { deleteObjects } from "@/lib/portal/s3";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  listUploadedParts,
  presignUploadPart,
} from "@/lib/portal/s3-transfer";
import { PART_SIZE } from "./rules";
import { abortUpload, completeUpload, createUpload, describeUpload, signParts, sweepStaleUploads } from "./service";

vi.mock("@/lib/db/client-domains", () => ({ findActiveClientDomain: vi.fn() }));
vi.mock("@/lib/db/client-uploads", () => ({
  insertClientUpload: vi.fn(),
  getClientUpload: vi.fn(),
  updateClientUpload: vi.fn(),
  listStaleClientUploads: vi.fn(),
}));
vi.mock("@/lib/db/documents", () => ({ insertDocument: vi.fn() }));
vi.mock("@/lib/portal/s3", () => ({
  objectKey: (pathname: string) => `meritus/${pathname}`,
  deleteObjects: vi.fn(),
}));
vi.mock("@/lib/portal/s3-transfer", () => ({
  createMultipartUpload: vi.fn(),
  presignUploadPart: vi.fn(),
  listUploadedParts: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
  headObject: vi.fn(),
  s3Url: (key: string) => `s3://vericase-test/${key}`,
}));

const NOW = new Date("2026-09-12T10:00:00Z");
const client = { userId: "user_c", role: "client" as const, domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" };
const director = { userId: "user_wr", role: "director" as const, domain: null, email: "w@meritusvia.com" };
const domainRow = { id: "cd_1", domain: "example-firm.co.uk", firm: "Example Firm LLP", pursuitId: "p1", createdBy: "user_wr", createdAt: NOW, removedAt: null };

function upload(overrides: Partial<ClientUpload> = {}): ClientUpload {
  return {
    id: "up_1",
    clientDomainId: "cd_1",
    pursuitId: "p1",
    userId: "user_c",
    uploaderEmail: "jane@example-firm.co.uk",
    key: "meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
    uploadId: "s3up",
    fileName: "bundle.pdf",
    mime: "application/pdf",
    size: PART_SIZE + 10,
    partSize: PART_SIZE,
    status: "pending",
    documentId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("S3_BUCKET", "vericase-test");
  vi.stubEnv("S3_REGION", "eu-west-2");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret");
  vi.mocked(findActiveClientDomain).mockResolvedValue(domainRow);
  vi.mocked(listStaleClientUploads).mockResolvedValue([]);
  vi.mocked(createMultipartUpload).mockResolvedValue({ uploadId: "s3up" });
  vi.mocked(insertClientUpload).mockImplementation(async (values) => upload(values as Partial<ClientUpload>));
  vi.mocked(getClientUpload).mockResolvedValue(upload());
  vi.mocked(presignUploadPart).mockImplementation(async (_k, _u, n) => `https://s3/part/${n}`);
  vi.mocked(listUploadedParts).mockResolvedValue([]);
  vi.mocked(updateClientUpload).mockResolvedValue(true);
  vi.mocked(deleteObjects).mockResolvedValue(undefined);
  vi.mocked(headObject).mockResolvedValue({ size: PART_SIZE + 10, contentType: "application/pdf" });
  vi.mocked(insertDocument).mockImplementation(async (values) => ({ extractedText: null, createdAt: NOW, ...values }) as DocumentRow);
});

afterEach(() => vi.unstubAllEnvs());

describe("createUpload", () => {
  it("opens a multipart upload under the domain and records it", async () => {
    const result = await createUpload(client, { fileName: "Trial bundle.pdf", size: PART_SIZE + 10, mime: "application/pdf" }, NOW);
    expect(result).toMatchObject({ ok: true, partSize: PART_SIZE, partCount: 2 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.key).toMatch(/^meritus\/clients\/example-firm\.co\.uk\/[0-9a-f-]{36}-Trial bundle\.pdf$/);
    expect(createMultipartUpload).toHaveBeenCalledWith(result.key, "application/pdf");
    expect(insertClientUpload).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id, clientDomainId: "cd_1", pursuitId: "p1", userId: "user_c", uploaderEmail: "jane@example-firm.co.uk", key: result.key, uploadId: "s3up", size: PART_SIZE + 10, partSize: PART_SIZE, status: "pending" })
    );
  });

  it("refuses a director, a removed domain, a bad type and an oversized file", async () => {
    expect(await createUpload(director, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 403, error: "No client domain" });
    vi.mocked(findActiveClientDomain).mockResolvedValue(null);
    expect(await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 403, error: "Access for this domain has ended" });
    vi.mocked(findActiveClientDomain).mockResolvedValue(domainRow);
    expect((await createUpload(client, { fileName: "a.exe", size: 5, mime: "" }, NOW))).toMatchObject({ ok: false, status: 400 });
    expect((await createUpload(client, { fileName: "a.pdf", size: 51 * 1024 ** 3, mime: "" }, NOW))).toMatchObject({ ok: false, status: 400 });
    expect(createMultipartUpload).not.toHaveBeenCalled();
  });

  it("answers 503 without storage", async () => {
    vi.stubEnv("S3_BUCKET", "");
    expect(await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW)).toEqual({ ok: false, status: 503, error: "VeriCase S3 is not configured" });
  });

  it("sweeps stale uploads first, best effort", async () => {
    vi.mocked(listStaleClientUploads).mockResolvedValue([upload({ id: "old", key: "k-old", uploadId: "u-old" })]);
    await createUpload(client, { fileName: "a.pdf", size: 5, mime: "" }, NOW);
    expect(abortMultipartUpload).toHaveBeenCalledWith("k-old", "u-old");
    expect(updateClientUpload).toHaveBeenCalledWith("old", { status: "aborted" });
  });
});

describe("signParts", () => {
  it("signs the asked parts of the caller's own upload", async () => {
    expect(await signParts(client, "up_1", [1, 2])).toEqual({ ok: true, urls: { "1": "https://s3/part/1", "2": "https://s3/part/2" } });
  });
  it("hides another domain's upload and refuses parts outside the plan", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ clientDomainId: "cd_other" }));
    expect(await signParts(client, "up_1", [1])).toEqual({ ok: false, status: 404, error: "Upload not found" });
    vi.mocked(getClientUpload).mockResolvedValue(upload());
    expect((await signParts(client, "up_1", [3])).ok).toBe(false);
  });
  it("refuses a finished upload", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ status: "complete" }));
    expect(await signParts(client, "up_1", [1])).toEqual({ ok: false, status: 409, error: "Upload already finished" });
  });
});

describe("describeUpload", () => {
  it("returns the plan and the parts S3 already holds", async () => {
    vi.mocked(listUploadedParts).mockResolvedValue([{ partNumber: 1, etag: '"a"', size: PART_SIZE }]);
    expect(await describeUpload(client, "up_1")).toEqual({ ok: true, id: "up_1", status: "pending", partSize: PART_SIZE, partCount: 2, parts: [{ partNumber: 1, etag: '"a"', size: PART_SIZE }] });
  });
});

describe("completeUpload", () => {
  const parts = [{ partNumber: 1, etag: '"a"' }, { partNumber: 2, etag: '"b"' }];

  it("completes, verifies the size and writes the document on the linked pursuit", async () => {
    const result = await completeUpload(client, "up_1", parts);
    expect(completeMultipartUpload).toHaveBeenCalledWith("meritus/clients/example-firm.co.uk/up_1-bundle.pdf", "s3up", parts);
    expect(insertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "pursuit",
        pursuitId: "p1",
        clientDomainId: "cd_1",
        title: "bundle.pdf",
        blobUrl: "s3://vericase-test/meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
        blobPathname: "meritus/clients/example-firm.co.uk/up_1-bundle.pdf",
        fileName: "bundle.pdf",
        mime: "application/pdf",
        size: PART_SIZE + 10,
        extractedText: null,
        uploadedBy: "user_c",
        uploaderEmail: "jane@example-firm.co.uk",
      })
    );
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "complete", documentId: expect.any(String) });
    expect(result).toMatchObject({ ok: true, document: { title: "bundle.pdf", size: PART_SIZE + 10, hasText: false } });
  });

  it("uses the client scope when the domain has no pursuit", async () => {
    vi.mocked(getClientUpload).mockResolvedValue(upload({ pursuitId: null }));
    await completeUpload(client, "up_1", parts);
    expect(insertDocument).toHaveBeenCalledWith(expect.objectContaining({ scope: "client", pursuitId: null }));
  });

  it("refuses a second completion that lost the race for the row", async () => {
    vi.mocked(updateClientUpload).mockResolvedValue(false);
    expect(await completeUpload(client, "up_1", parts)).toEqual({ ok: false, status: 409, error: "Upload already finished" });
    expect(insertDocument).not.toHaveBeenCalled();
  });

  it("refuses the wrong number of parts before touching S3", async () => {
    expect((await completeUpload(client, "up_1", [parts[0]])).ok).toBe(false);
    expect(completeMultipartUpload).not.toHaveBeenCalled();
  });

  it("removes the object and marks the upload aborted when the size does not match", async () => {
    vi.mocked(headObject).mockResolvedValue({ size: 5, contentType: null });
    expect(await completeUpload(client, "up_1", parts)).toEqual({ ok: false, status: 409, error: "The uploaded size does not match the file" });
    expect(deleteObjects).toHaveBeenCalledWith(["meritus/clients/example-firm.co.uk/up_1-bundle.pdf"]);
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "aborted" });
    expect(insertDocument).not.toHaveBeenCalled();
  });
});

describe("abortUpload and sweepStaleUploads", () => {
  it("aborts the caller's own pending upload", async () => {
    expect(await abortUpload(client, "up_1")).toEqual({ ok: true });
    expect(abortMultipartUpload).toHaveBeenCalledWith("meritus/clients/example-firm.co.uk/up_1-bundle.pdf", "s3up");
    expect(updateClientUpload).toHaveBeenCalledWith("up_1", { status: "aborted" });
  });
  it("sweeps every stale upload and keeps going past a failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(listStaleClientUploads).mockResolvedValue([upload({ id: "a" }), upload({ id: "b" })]);
    vi.mocked(abortMultipartUpload).mockRejectedValueOnce(new Error("boom"));
    expect(await sweepStaleUploads(NOW)).toBe(1);
    expect(listStaleClientUploads).toHaveBeenCalledWith(new Date(NOW.getTime() - 24 * 60 * 60 * 1000));
    expect(updateClientUpload).toHaveBeenCalledWith("b", { status: "aborted" });
  });
});
