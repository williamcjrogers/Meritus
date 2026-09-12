import { describe, expect, it, vi } from "vitest";
import { uploadFile, type UploadTransport } from "./upload";

function fakeTransport(partSize: number, opts: { described?: { partNumber: number; etag: string; size: number }[]; failFirstPut?: boolean } = {}) {
  const calls = { create: 0, describe: 0, sign: [] as number[][], puts: [] as { url: string; size: number }[], complete: [] as unknown[], abort: 0 };
  let failed = false;
  const transport: UploadTransport = {
    async create(file) {
      calls.create += 1;
      return { id: "up_1", key: "k", partSize, partCount: Math.max(1, Math.ceil(file.size / partSize)) };
    },
    async describe() {
      calls.describe += 1;
      if (!opts.described) throw new Error("not found");
      return { id: "up_1", status: "pending", partSize, partCount: 3, parts: opts.described };
    },
    async sign(_id, partNumbers) {
      calls.sign.push(partNumbers);
      return Object.fromEntries(partNumbers.map((n) => [String(n), `https://s3/part/${n}`]));
    },
    async putPart(url, blob, onProgress) {
      if (opts.failFirstPut && !failed) {
        failed = true;
        throw new Error("flaky");
      }
      calls.puts.push({ url, size: blob.size });
      onProgress(blob.size);
      return `"etag-${url.split("/").pop()}"`;
    },
    async complete(_id, parts) {
      calls.complete.push(parts);
      return { document: { id: "doc_1", title: "bundle.pdf", size: 10 } };
    },
    async abort() {
      calls.abort += 1;
    },
  };
  return { transport, calls };
}

const file = new File([new Uint8Array(10)], "bundle.pdf", { type: "application/pdf" });

describe("uploadFile", () => {
  it("creates, signs lazily, puts every part in order and completes with the etags", async () => {
    const { transport, calls } = fakeTransport(4);
    const progress: number[] = [];
    const sessions: string[] = [];
    const result = await uploadFile(file, transport, { concurrency: 1, signBatch: 2, onProgress: (f) => progress.push(f), onSession: (id) => sessions.push(id) });
    expect(result).toEqual({ id: "doc_1", title: "bundle.pdf", size: 10 });
    expect(calls.create).toBe(1);
    expect(sessions).toEqual(["up_1"]);
    expect(calls.sign).toEqual([[1, 2], [3]]);
    expect(calls.puts.map((p) => p.size)).toEqual([4, 4, 2]);
    expect(calls.complete[0]).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
      { partNumber: 3, etag: '"etag-3"' },
    ]);
    expect(progress.at(-1)).toBe(1);
  });

  it("resumes: keeps the parts S3 already holds and uploads the rest", async () => {
    const { transport, calls } = fakeTransport(4, { described: [{ partNumber: 1, etag: '"kept"', size: 4 }] });
    await uploadFile(file, transport, { concurrency: 1, resumeId: "up_1" });
    expect(calls.create).toBe(0);
    expect(calls.puts.map((p) => p.url)).toEqual(["https://s3/part/2", "https://s3/part/3"]);
    expect(calls.complete[0]).toEqual([
      { partNumber: 1, etag: '"kept"' },
      { partNumber: 2, etag: '"etag-2"' },
      { partNumber: 3, etag: '"etag-3"' },
    ]);
  });

  it("starts fresh when the old session is gone", async () => {
    const { transport, calls } = fakeTransport(4);
    await uploadFile(file, transport, { concurrency: 1, resumeId: "stale" });
    expect(calls.describe).toBe(1);
    expect(calls.create).toBe(1);
  });

  it("retries a failed part once with a fresh url", async () => {
    const { transport, calls } = fakeTransport(4, { failFirstPut: true });
    await uploadFile(file, transport, { concurrency: 1 });
    expect(calls.puts.length).toBe(3);
    expect(calls.sign.length).toBeGreaterThanOrEqual(2);
  });

  it("finishes with several workers", async () => {
    const { transport, calls } = fakeTransport(4);
    await uploadFile(file, transport, { concurrency: 3 });
    expect(calls.puts.map((p) => p.size).sort()).toEqual([2, 4, 4]);
    expect(calls.complete.length).toBe(1);
  });
});
