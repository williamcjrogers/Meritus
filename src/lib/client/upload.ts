/**
 * Runs one multipart upload from the browser: open (or resume) a session, sign part urls a batch
 * at a time so they cannot expire mid-file, PUT parts with a small worker pool, then complete.
 * No server imports: this file runs in the browser and in jsdom.
 */

export type CreateResponse = { id: string; key: string; partSize: number; partCount: number };
export type CompletedPart = { partNumber: number; etag: string };
export type UploadDescription = {
  id: string;
  status: string;
  partSize: number;
  partCount: number;
  parts: { partNumber: number; etag: string; size: number }[];
};
export type UploadedDocument = { id: string; title: string; size: number };

export type UploadTransport = {
  create(file: { name: string; size: number; type: string }): Promise<CreateResponse>;
  describe(id: string): Promise<UploadDescription>;
  sign(id: string, partNumbers: number[]): Promise<Record<string, string>>;
  putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<string>;
  complete(id: string, parts: CompletedPart[]): Promise<{ document: UploadedDocument }>;
  abort(id: string): Promise<void>;
};

export type UploadOptions = {
  concurrency?: number;
  signBatch?: number;
  resumeId?: string | null;
  onProgress?: (fraction: number) => void;
  onSession?: (id: string) => void;
};

type Plan = { id: string; partSize: number; partCount: number };

export async function uploadFile(file: File, transport: UploadTransport, options: UploadOptions = {}): Promise<UploadedDocument> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const signBatch = Math.max(1, options.signBatch ?? 50);
  const done = new Map<number, string>();
  let plan: Plan | null = null;

  if (options.resumeId) {
    try {
      const described = await transport.describe(options.resumeId);
      if (described.status === "pending") {
        plan = { id: described.id, partSize: described.partSize, partCount: described.partCount };
        for (const part of described.parts) done.set(part.partNumber, part.etag);
      }
    } catch {
      plan = null;
    }
  }
  if (!plan) {
    const created = await transport.create({ name: file.name, size: file.size, type: file.type });
    plan = { id: created.id, partSize: created.partSize, partCount: created.partCount };
  }
  const session = plan;
  options.onSession?.(session.id);

  const bytesOf = (n: number) => Math.min(session.partSize, file.size - (n - 1) * session.partSize);
  let doneBytes = [...done.keys()].reduce((sum, n) => sum + bytesOf(n), 0);
  const inFlight = new Map<number, number>();
  const report = () => {
    const loaded = doneBytes + [...inFlight.values()].reduce((a, b) => a + b, 0);
    options.onProgress?.(file.size === 0 ? 1 : Math.min(1, loaded / file.size));
  };
  report();

  const pending = Array.from({ length: session.partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
  const urls = new Map<number, string>();
  let next = 0;

  async function urlFor(n: number, fresh = false): Promise<string> {
    if (!fresh && urls.has(n)) return urls.get(n)!;
    const start = pending.indexOf(n);
    const batch = fresh ? [n] : pending.slice(start, start + signBatch);
    const signed = await transport.sign(session.id, batch);
    for (const [key, value] of Object.entries(signed)) urls.set(Number(key), value);
    const url = urls.get(n);
    if (!url) throw new Error(`No url for part ${n}`);
    return url;
  }

  async function putWithRetry(n: number, blob: Blob): Promise<string> {
    const onProgress = (loaded: number) => {
      inFlight.set(n, loaded);
      report();
    };
    try {
      return await transport.putPart(await urlFor(n), blob, onProgress);
    } catch {
      inFlight.set(n, 0);
      return transport.putPart(await urlFor(n, true), blob, onProgress);
    }
  }

  async function worker(): Promise<void> {
    while (next < pending.length) {
      const n = pending[next++];
      const start = (n - 1) * session.partSize;
      const blob = file.slice(start, Math.min(start + session.partSize, file.size));
      const etag = await putWithRetry(n, blob);
      inFlight.delete(n);
      done.set(n, etag);
      doneBytes += blob.size;
      report();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

  const parts = [...done.entries()].map(([partNumber, etag]) => ({ partNumber, etag })).sort((a, b) => a.partNumber - b.partNumber);
  const { document } = await transport.complete(session.id, parts);
  return document;
}
