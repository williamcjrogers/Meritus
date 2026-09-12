import { createHash, randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, UploadPartCommand,
} from "@aws-sdk/client-s3";
import { readS3Config } from "@/lib/portal/s3";
import {
  registerResearchStagedObject, getResearchObjectRegistration, listUnclaimedResearchObjects,
  deleteResearchStagedObject, getResearchInvalidation, completeResearchInvalidation,
  failResearchInvalidation, renewResearchLease,
} from "@/lib/db/research";
import type { ConnectorPage, ExtractedEvidence, SourceEnvelope, SourceRecord, StagedRecord } from "./contracts";
import { MAX_RESEARCH_RECORD_BYTES, openValidatedResearchResponse } from "./safe-fetch";

const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const PART_BYTES = 8 * 1024 * 1024;
export type ObjectRegistration = { objectKey: string; sourceId: string; size: number; sha256: string };
type UploadPart = { ETag: string; PartNumber: number };
export type ResearchStore = {
  prefix(): string;
  put(key: string, body: Uint8Array, contentType: string, signal: AbortSignal): Promise<void>;
  read(key: string, start: number, signal: AbortSignal): Promise<AsyncIterable<Uint8Array>>;
  remove(key: string): Promise<void>;
  createMultipart(key: string, contentType: string, signal: AbortSignal): Promise<string>;
  uploadPart(key: string, uploadId: string, part: number, body: Uint8Array, signal: AbortSignal): Promise<string>;
  completeMultipart(key: string, uploadId: string, parts: UploadPart[], signal: AbortSignal): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
};
export type EvidenceDeps = {
  store: ResearchStore;
  register(object: ObjectRegistration): Promise<unknown>;
  registration(key: string): Promise<ObjectRegistration | null>;
  unclaimed(keys?: string[]): Promise<{ objectKey: string }[]>;
  forget(key: string): Promise<unknown>;
  invalidation(id: string): Promise<{ id: string; versionId: string; objectKey: string | null } | null>;
  completeInvalidation(id: string): Promise<unknown>;
  failInvalidation(id: string): Promise<unknown>;
  renew(jobId: string, token: number): Promise<boolean>;
  open: typeof openValidatedResearchResponse;
  snapshotLimit(): number;
};

function configuredStore() {
  const config = readS3Config();
  if (!config) throw new Error("research_storage_unconfigured");
  const client = new S3Client({ region: config.region, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return { client, bucket: config.bucket, prefix: `${config.prefix}/research/` };
}

const store: ResearchStore = {
  prefix: () => configuredStore().prefix,
  async put(Key, Body, ContentType, signal) {
    const { client, bucket: Bucket } = configuredStore();
    await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, ServerSideEncryption: "AES256" }), { abortSignal: signal });
  },
  async read(Key, start, signal) {
    const { client, bucket: Bucket } = configuredStore();
    const result = await client.send(new GetObjectCommand({ Bucket, Key, ...(start ? { Range: `bytes=${start}-` } : {}) }), { abortSignal: signal });
    if (!result.Body || !(Symbol.asyncIterator in result.Body)) throw new Error("research_object_missing");
    return result.Body as AsyncIterable<Uint8Array>;
  },
  async remove(Key) {
    const { client, bucket: Bucket } = configuredStore();
    await client.send(new DeleteObjectCommand({ Bucket, Key }), { abortSignal: AbortSignal.timeout(10_000) });
  },
  async createMultipart(Key, ContentType, signal) {
    const { client, bucket: Bucket } = configuredStore();
    const result = await client.send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType, ServerSideEncryption: "AES256" }), { abortSignal: signal });
    if (!result.UploadId) throw new Error("multipart_id_missing");
    return result.UploadId;
  },
  async uploadPart(Key, UploadId, PartNumber, Body, signal) {
    const { client, bucket: Bucket } = configuredStore();
    const result = await client.send(new UploadPartCommand({ Bucket, Key, UploadId, PartNumber, Body }), { abortSignal: signal });
    if (!result.ETag) throw new Error("part_etag_missing");
    return result.ETag;
  },
  async completeMultipart(Key, UploadId, Parts, signal) {
    const { client, bucket: Bucket } = configuredStore();
    await client.send(new CompleteMultipartUploadCommand({ Bucket, Key, UploadId, MultipartUpload: { Parts } }), { abortSignal: signal });
  },
  async abortMultipart(Key, UploadId) {
    const { client, bucket: Bucket } = configuredStore();
    await client.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId }), { abortSignal: AbortSignal.timeout(10_000) });
  },
};

export function createResearchEvidence(deps: EvidenceDeps) {
  function assertResearchKey(key: string): void {
    if (!key.startsWith(deps.store.prefix()) || key.includes("..") || key.includes("\\") || key.includes("\0")) {
      throw new Error("research_object_required");
    }
  }
  async function deleteResearchObject(key: string): Promise<void> {
    assertResearchKey(key);
    await deps.store.remove(key);
  }
  async function storeResearchImport(input: { sourceId: string; body: Uint8Array; contentType: string; signal: AbortSignal }) {
    input.signal.throwIfAborted();
    if (!/^[a-f0-9-]{36}$/i.test(input.sourceId) || input.body.byteLength > MAX_RESEARCH_RECORD_BYTES) throw new Error("invalid_research_import");
    const sha256 = hash(input.body);
    const objectKey = `${deps.store.prefix()}staged/${input.sourceId}/${randomUUID()}/${sha256}`;
    // Register before writing: even an uncertain S3 response leaves a durable cleanup record.
    await deps.register({ objectKey, sourceId: input.sourceId, size: input.body.byteLength, sha256 });
    try {
      await deps.store.put(objectKey, input.body, input.contentType, input.signal);
      input.signal.throwIfAborted();
      return { objectKey, bytes: input.body.byteLength, sha256 };
    } catch (error) {
      try { await deps.store.remove(objectKey); await deps.forget(objectKey); } catch { /* The durable staging collector retries. */ }
      throw error;
    }
  }

  async function stageResearchPage(page: ConnectorPage, extract: (e: SourceEnvelope) => Promise<ExtractedEvidence>, signal = new AbortController().signal): Promise<StagedRecord[]> {
    const result: StagedRecord[] = [];
    try {
      for (const envelope of page.records) {
        signal.throwIfAborted();
        let url: URL;
        try { url = new URL(envelope.url); } catch { throw new Error("research_source_required"); }
        let registeredImport = false;
        if (url.protocol === "research-object:" && envelope.metadata.import === true) {
          const key = envelope.url.slice("research-object:".length);
          assertResearchKey(key);
          const registration = await deps.registration(key);
          registeredImport = registration?.sourceId === envelope.sourceId && envelope.metadata.sourceObjectKey === key;
        }
        if ((!registeredImport && url.protocol !== "https:") || url.username || url.password || envelope.providerId.startsWith("meritus/clients/") || envelope.body.byteLength > MAX_RESEARCH_RECORD_BYTES) {
          throw new Error("research_source_required");
        }
        const tombstone = envelope.metadata.withdrawn === true;
        const parsed: ExtractedEvidence = tombstone ? { passages: [], facts: [], coverage: { complete: true, notes: [] } } : await extract(envelope);
        if (!parsed.coverage.complete) throw new Error("parse_incomplete");
        const parserVersion = tombstone ? "qcs-withdrawal-v1" : envelope.metadata.parserVersion;
        if (typeof parserVersion !== "string" || !parserVersion) throw new Error("parser_version_required");
        const saved = await storeResearchImport({ sourceId: envelope.sourceId, body: envelope.body, contentType: envelope.contentType, signal });
        const metadata = { sourceId: envelope.sourceId, providerId: envelope.providerId, url: envelope.url, retrievedAt: envelope.retrievedAt,
          publishedAt: envelope.publishedAt, updatedAt: envelope.updatedAt, eventAt: envelope.eventAt, contentType: envelope.contentType };
        result.push({ ...metadata, hash: hash(envelope.body), objectKey: saved.objectKey, parserVersion,
          metadata: { ...envelope.metadata, facts: parsed.facts },
          passages: parsed.passages.map(p => ({ ...p, hash: hash(JSON.stringify(p.locator) + "\n" + p.text) })),
        });
      }
      signal.throwIfAborted();
      return result;
    } catch (error) {
      // Registered staging rows survive failed deletion so the scheduled collector can retry.
      for (const row of result) {
        try { await deleteResearchObject(row.objectKey); await deps.forget(row.objectKey); } catch { /* Retry through the staging collector. */ }
      }
      throw error;
    }
  }

  async function readResearchObjectStream(key: string, signal: AbortSignal, startByte = 0): Promise<AsyncIterable<Uint8Array>> {
    assertResearchKey(key); signal.throwIfAborted();
    const registration = await deps.registration(key);
    if (!registration) throw new Error("research_object_unavailable");
    if (!Number.isSafeInteger(startByte) || startByte < 0 || startByte > registration.size || registration.size > deps.snapshotLimit()) throw new Error("invalid_research_range");
    if (startByte === registration.size) return (async function* () {})();
    const input = await deps.store.read(key, startByte, signal);
    return (async function* () {
      let bytes = 0; const digest = createHash("sha256");
      const iterator = input[Symbol.asyncIterator]();
      const destroy = () => (input as { destroy?: () => void }).destroy?.();
      signal.addEventListener("abort", destroy, { once: true });
      try {
        while (true) {
          signal.throwIfAborted();
          let abort: (() => void) | undefined;
          const next = await Promise.race([
            iterator.next(),
            new Promise<never>((_, reject) => {
              abort = () => reject(new Error("research_object_aborted"));
              signal.addEventListener("abort", abort, { once: true });
            }),
          ]).finally(() => { if (abort) signal.removeEventListener("abort", abort); });
          if (next.done) break;
          const chunk = next.value;
          signal.throwIfAborted(); bytes += chunk.byteLength;
          if (bytes > registration.size - startByte) throw new Error("research_object_size_mismatch");
          if (!startByte) digest.update(chunk);
          yield chunk;
        }
        signal.throwIfAborted();
        if (bytes !== registration.size - startByte) throw new Error("research_object_size_mismatch");
        if (!startByte && digest.digest("hex") !== registration.sha256) throw new Error("research_object_hash_mismatch");
      } finally {
        signal.removeEventListener("abort", destroy);
        destroy();
        // Do not await a stalled provider iterator while handling an abort.
        if (iterator.return) void Promise.resolve(iterator.return()).catch(() => undefined);
      }
    })();
  }
  async function readResearchObject(key: string, signal: AbortSignal): Promise<Uint8Array> {
    const stream = await readResearchObjectStream(key, signal);
    let bytes = 0; const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      bytes += chunk.byteLength;
      if (bytes > MAX_RESEARCH_RECORD_BYTES) throw new Error("research_object_too_large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async function downloadResearchSnapshot(url: string, options: { source: SourceRecord; signal: AbortSignal; maxBytes: number; lease: { jobId: string; leaseToken: number } }) {
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0 || options.maxBytes > deps.snapshotLimit()) throw new Error("invalid_snapshot_limit");
    const leaseLost = new AbortController();
    const signal = AbortSignal.any([options.signal, leaseLost.signal]);
    const renew = async () => {
      if (!await deps.renew(options.lease.jobId, options.lease.leaseToken)) throw new Error("lease_lost");
    };
    await renew(); signal.throwIfAborted();
    let renewalPending = false;
    const timer = setInterval(() => {
      if (renewalPending) return;
      renewalPending = true;
      void renew().catch(() => leaseLost.abort()).finally(() => { renewalPending = false; });
    }, 30_000);
    let uploadId: string | undefined;
    let completed = false;
    let registeredObject = false;
    const objectKey = `${deps.store.prefix()}staged/${options.source.id}/${randomUUID()}/snapshot`;
    try {
      const response = await deps.open(url, { source: options.source, signal });
      if (response.status !== 200) throw new Error("snapshot_unavailable");
      uploadId = await deps.store.createMultipart(objectKey, response.contentType, signal);
      const parts: UploadPart[] = []; let pending: Buffer = Buffer.alloc(0); let bytes = 0;
      const digest = createHash("sha256");
      const upload = async (body: Buffer) => {
        signal.throwIfAborted();
        const PartNumber = parts.length + 1;
        const ETag = await deps.store.uploadPart(objectKey, uploadId!, PartNumber, body, signal);
        parts.push({ PartNumber, ETag });
      };
      for await (const chunk of response.body) {
        signal.throwIfAborted(); bytes += chunk.byteLength;
        if (bytes > options.maxBytes) throw new Error("snapshot_too_large");
        digest.update(chunk); pending = Buffer.concat([pending, chunk]);
        while (pending.length >= PART_BYTES) {
          await upload(pending.subarray(0, PART_BYTES)); pending = pending.subarray(PART_BYTES);
        }
      }
      if (!bytes) throw new Error("empty_snapshot");
      if (pending.length) await upload(pending);
      await renew(); signal.throwIfAborted();
      const sha256 = digest.digest("hex");
      await deps.register({ objectKey, sourceId: options.source.id, size: bytes, sha256 });
      registeredObject = true;
      await renew(); signal.throwIfAborted();
      await deps.store.completeMultipart(objectKey, uploadId, parts, signal); completed = true;
      await renew(); signal.throwIfAborted();
      return { objectKey, bytes, sha256, contentType: response.contentType };
    } catch (error) {
      if (uploadId && !completed) await deps.store.abortMultipart(objectKey, uploadId).catch(() => undefined);
      if (registeredObject) {
        try { await deps.store.remove(objectKey); await deps.forget(objectKey); } catch { /* An uncertain completion remains registered for cleanup. */ }
      }
      throw error;
    } finally {
      clearInterval(timer);
    }
  }

  async function processResearchInvalidation(id: string, invalidateDependants: (versionId: string) => Promise<void>): Promise<void> {
    const row = await deps.invalidation(id);
    if (!row) return;
    try {
      await invalidateDependants(row.versionId);
      if (row.objectKey) await deleteResearchObject(row.objectKey);
      await deps.completeInvalidation(id);
    } catch (error) {
      await deps.failInvalidation(id);
      throw error;
    }
  }
  async function cleanResearchStaging(keys?: string[]): Promise<number> {
    let removed = 0;
    for (const row of await deps.unclaimed(keys)) {
      await deleteResearchObject(row.objectKey);
      await deps.forget(row.objectKey); removed++;
    }
    return removed;
  }
  return { stageResearchPage, storeResearchImport, readResearchObject, readResearchObjectStream,
    downloadResearchSnapshot, processResearchInvalidation, cleanResearchStaging, deleteResearchObject };
}

export const { stageResearchPage, storeResearchImport, readResearchObject, readResearchObjectStream,
  downloadResearchSnapshot, processResearchInvalidation, cleanResearchStaging, deleteResearchObject } = createResearchEvidence({
  store, register: registerResearchStagedObject, registration: getResearchObjectRegistration,
  unclaimed: listUnclaimedResearchObjects, forget: deleteResearchStagedObject,
  invalidation: getResearchInvalidation, completeInvalidation: completeResearchInvalidation,
  failInvalidation: failResearchInvalidation, renew: renewResearchLease, open: openValidatedResearchResponse,
  snapshotLimit: () => {
    const value = Number(process.env.RESEARCH_SNAPSHOT_MAX_BYTES ?? 1_073_741_824);
    if (!Number.isSafeInteger(value) || value <= 0 || value > 1_073_741_824) throw new Error("invalid_snapshot_configuration");
    return value;
  },
});
