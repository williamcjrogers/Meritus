// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/research", () => ({
  registerResearchStagedObject: vi.fn(), getResearchObjectRegistration: vi.fn(), listUnclaimedResearchObjects: vi.fn(),
  deleteResearchStagedObject: vi.fn(), getResearchInvalidation: vi.fn(), completeResearchInvalidation: vi.fn(),
  failResearchInvalidation: vi.fn(), renewResearchLease: vi.fn(), reserveSourceRequest: vi.fn(),
}));
import { createResearchEvidence, type EvidenceDeps, type ObjectRegistration, type ResearchStore } from "./evidence";
import type { ConnectorPage, ExtractedEvidence, SourceRecord } from "./contracts";

const objects = new Map<string, Uint8Array>();
const registered = new Map<string, ObjectRegistration>();
const source: SourceRecord = { id: "00000000-0000-4000-8000-000000000001", provider: "fixture", hosts: ["example.com"], status: "ready", credentialRef: null };
const digest = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");
const store: ResearchStore = {
  prefix: () => "meritus/research/",
  put: vi.fn(async (key, bytes) => { objects.set(key, bytes); }),
  read: vi.fn(async (key, start) => (async function* () { yield objects.get(key)!.subarray(start); })()),
  remove: vi.fn(async key => { objects.delete(key); }),
  createMultipart: vi.fn(async () => "upload-1"), uploadPart: vi.fn(async (_key, _id, part) => `etag-${part}`),
  completeMultipart: vi.fn(async () => {}), abortMultipart: vi.fn(async () => {}),
};
const deps: EvidenceDeps = {
  store, register: vi.fn(async row => { registered.set(row.objectKey, row); }),
  registration: vi.fn(async key => registered.get(key) ?? null), unclaimed: vi.fn(async () => []), forget: vi.fn(async key => { registered.delete(key); }),
  invalidation: vi.fn(async () => null), completeInvalidation: vi.fn(async () => {}), failInvalidation: vi.fn(async () => {}),
  renew: vi.fn(async () => true), open: vi.fn(), snapshotLimit: () => 1024 * 1024 * 1024,
};
const api = createResearchEvidence(deps);
const parsed: ExtractedEvidence = { passages: [{ locator: { kind: "paragraph", value: "1" }, text: "A source observation" }], facts: [], coverage: { complete: true, notes: [] } };
function page(): ConnectorPage {
  return { records: [{ sourceId: source.id, providerId: "fixture-1", url: "https://example.com/source", retrievedAt: "2026-09-12T00:00:00Z", publishedAt: null, updatedAt: null, eventAt: null, body: Buffer.from("source bytes"), contentType: "text/plain", metadata: { parserVersion: "fixture-v1" } }], nextCursor: null, coverage: { complete: true, notes: [] } };
}
beforeEach(() => { vi.clearAllMocks(); objects.clear(); registered.clear(); vi.mocked(deps.renew).mockResolvedValue(true); });

it("archives exact bytes with passage identities and stable content hashes", async () => {
  const first = await api.stageResearchPage(page(), async () => parsed);
  const replay = await api.stageResearchPage(page(), async () => parsed);
  expect(first[0].hash).toBe(replay[0].hash);
  expect(first[0].objectKey).not.toBe(replay[0].objectKey);
  expect(first[0].passages[0]).toMatchObject({ text: "A source observation", locator: { kind: "paragraph", value: "1" } });
  expect(await api.readResearchObject(first[0].objectKey, new AbortController().signal)).toEqual(Buffer.from("source bytes"));
});
it("refuses client object keys and unregistered research objects before S3", async () => {
  for (const key of ["meritus/clients/private.pdf", "meritus/research/../clients/private", "meritus/research/unknown"]) {
    await expect(api.readResearchObject(key, new AbortController().signal)).rejects.toThrow();
  }
  expect(store.read).not.toHaveBeenCalled();
});
it("stages imported rows only from a registered original object belonging to that source", async () => {
  const original = await api.storeResearchImport({ sourceId: source.id, body: Buffer.from("original CSV"), contentType: "text/csv", signal: new AbortController().signal });
  const input = page();
  input.records[0].url = `research-object:${original.objectKey}`;
  input.records[0].metadata = { parserVersion: "fixture-v1", import: true, sourceObjectKey: original.objectKey };
  expect(await api.stageResearchPage(input, async () => parsed)).toHaveLength(1);
  input.records[0].sourceId = "00000000-0000-4000-8000-000000000002";
  await expect(api.stageResearchPage(input, async () => parsed)).rejects.toThrow("research_source_required");
  input.records[0].url = "research-object:meritus/clients/private.csv";
  await expect(api.stageResearchPage(input, async () => parsed)).rejects.toThrow("research_object_required");
});
it("records an uncertain object write durably when compensating deletion also fails", async () => {
  const api = createResearchEvidence({ ...deps, store: { ...store,
    put: async () => { throw new Error("uncertain write"); },
    remove: async () => { throw new Error("storage outage"); },
  } });
  await expect(api.storeResearchImport({ sourceId: source.id, body: Buffer.from("data"), contentType: "text/plain", signal: new AbortController().signal })).rejects.toThrow("uncertain write");
  expect(registered.size).toBe(1); expect(deps.forget).not.toHaveBeenCalled();
});
it("does not write any object when its durable registration fails", async () => {
  const api = createResearchEvidence({ ...deps, register: async () => { throw new Error("database outage"); } });
  await expect(api.storeResearchImport({ sourceId: source.id, body: Buffer.from("data"), contentType: "text/plain", signal: new AbortController().signal })).rejects.toThrow("database outage");
  expect(store.put).not.toHaveBeenCalled();
});
it("returns no page and cleans staged objects after a later parse failure", async () => {
  const input = page(); input.records.push({ ...input.records[0], providerId: "fixture-2" });
  const extraction = vi.fn().mockResolvedValueOnce(parsed).mockResolvedValueOnce({ ...parsed, coverage: { complete: false, notes: ["damaged"] } });
  await expect(api.stageResearchPage(input, extraction)).rejects.toThrow("parse_incomplete");
  expect(objects.size).toBe(0); expect(registered.size).toBe(0);
});
it("cancellation stops staging before storage", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(api.stageResearchPage(page(), async () => parsed, controller.signal)).rejects.toThrow();
  expect(store.put).not.toHaveBeenCalled();
});
it("bounds ranged reads and detects a replaced or truncated object", async () => {
  const saved = await api.storeResearchImport({ sourceId: source.id, body: Buffer.from("abcdef"), contentType: "text/plain", signal: new AbortController().signal });
  const stream = await api.readResearchObjectStream(saved.objectKey, new AbortController().signal, 3);
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("def");
  await expect(api.readResearchObjectStream(saved.objectKey, new AbortController().signal, 7)).rejects.toThrow("invalid_research_range");
  objects.set(saved.objectKey, Buffer.from("xxxxxx"));
  await expect(api.readResearchObject(saved.objectKey, new AbortController().signal)).rejects.toThrow("research_object_hash_mismatch");
});
it("processes a withdrawal tombstone without requiring an empty-body parser", async () => {
  const input = page(); input.records[0].metadata = { withdrawn: true }; input.records[0].body = Buffer.alloc(0);
  const extract = vi.fn(); const staged = await api.stageResearchPage(input, extract);
  expect(extract).not.toHaveBeenCalled(); expect(staged[0].passages).toEqual([]);
  expect(staged[0].hash).toBe(digest(Buffer.alloc(0))); expect(objects.get(staged[0].objectKey)).toHaveLength(0);
});
it("cancels a stalled storage stream and destroys its connection", async () => {
  const destroy = vi.fn();
  const key = "meritus/research/stalled";
  registered.set(key, { objectKey: key, sourceId: source.id, size: 10, sha256: "a".repeat(64) });
  const api = createResearchEvidence({ ...deps, store: { ...store, read: async () => ({ destroy, [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) }) } });
  const controller = new AbortController();
  const stream = await api.readResearchObjectStream(key, controller.signal);
  const waiting = expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow("research_object_aborted");
  controller.abort(); await waiting;
  expect(destroy).toHaveBeenCalled();
});
it("invalidates derived content before removing raw evidence and completing the outbox", async () => {
  const events: string[] = [];
  const api = createResearchEvidence({ ...deps,
    invalidation: async () => ({ id: "i", versionId: "v", objectKey: "meritus/research/source" }),
    store: { ...store, remove: async () => { events.push("remove"); } }, completeInvalidation: async () => { events.push("complete"); },
  });
  await api.processResearchInvalidation("i", async () => { events.push("dependants"); });
  expect(events).toEqual(["dependants", "remove", "complete"]);
});
it("retains pending invalidation when dependent or object deletion fails", async () => {
  const api = createResearchEvidence({ ...deps,
    invalidation: async () => ({ id: "i", versionId: "v", objectKey: "meritus/research/source" }),
    store: { ...store, remove: async () => { throw new Error("storage unavailable"); } },
  });
  await expect(api.processResearchInvalidation("i", async () => {})).rejects.toThrow();
  expect(deps.completeInvalidation).not.toHaveBeenCalled(); expect(deps.failInvalidation).toHaveBeenCalledWith("i");
});
it("streams an unknown-length snapshot larger than the record limit with bounded parts", async () => {
  vi.mocked(deps.open).mockResolvedValue({ url: "https://example.com/data.csv", status: 200, contentType: "text/csv", body: (async function* () { for (let i = 0; i < 35; i++) yield Buffer.alloc(1024 * 1024, 65); })() });
  const saved = await api.downloadResearchSnapshot("https://example.com/data.csv", { source, signal: new AbortController().signal, maxBytes: 40 * 1024 * 1024, lease: { jobId: "job", leaseToken: 1 } });
  expect(saved.bytes).toBe(35 * 1024 * 1024); expect(deps.register).toHaveBeenCalledWith(expect.objectContaining({ size: saved.bytes, sha256: saved.sha256 }));
  expect(vi.mocked(store.uploadPart).mock.calls.map(c => c[3].byteLength)).toEqual([8388608, 8388608, 8388608, 8388608, 3145728]);
  expect(store.completeMultipart).toHaveBeenCalledTimes(1); expect(store.abortMultipart).not.toHaveBeenCalled();
});
it("aborts oversized and interrupted multipart transfers without registering evidence", async () => {
  for (const interrupted of [false, true]) {
    vi.mocked(deps.open).mockResolvedValue({ url: "https://example.com/data", status: 200, contentType: "text/csv", body: (async function* () { yield Buffer.from("first"); if (interrupted) throw new Error("connection closed"); yield Buffer.from("second"); })() });
    await expect(api.downloadResearchSnapshot("https://example.com/data", { source, signal: new AbortController().signal, maxBytes: 7, lease: { jobId: "job", leaseToken: 1 } })).rejects.toThrow();
  }
  expect(store.abortMultipart).toHaveBeenCalledTimes(2); expect(store.completeMultipart).not.toHaveBeenCalled(); expect(deps.register).not.toHaveBeenCalled();
});
it("refuses completion after lease theft", async () => {
  vi.mocked(deps.renew).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  vi.mocked(deps.open).mockResolvedValue({ url: "https://example.com/data", status: 200, contentType: "text/csv", body: (async function* () { yield Buffer.from("data"); })() });
  await expect(api.downloadResearchSnapshot("https://example.com/data", { source, signal: new AbortController().signal, maxBytes: 7, lease: { jobId: "job", leaseToken: 1 } })).rejects.toThrow("lease_lost");
  expect(store.abortMultipart).toHaveBeenCalledTimes(1); expect(deps.register).not.toHaveBeenCalled();
});
