import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { reserveSourceRequest } from "@/lib/db/research";
import type { SourceRecord } from "./contracts";
import { ResearchFetchError } from "./errors";

export const MAX_RESEARCH_RECORD_BYTES = 32 * 1024 * 1024;
const deny = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) deny.addSubnet(ip, bits, "ipv4");
for (const [ip, bits] of [["2001:db8::", 32], ["2001::", 23], ["2002::", 16], ["3fff::", 20]] as const) {
  deny.addSubnet(ip, bits, "ipv6");
}

export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) return !deny.check(ip, "ipv4");
  return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/i.test(ip) && !deny.check(ip, "ipv6");
}

const headersByProvider = new Map<string, (secret: string) => Record<string, string>>();
export function registerProviderHeaders(provider: string, headers: (secret: string) => Record<string, string>): void {
  headersByProvider.set(provider, headers);
}

export function retryAfterMilliseconds(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : null;
}

/** Removes abort listeners as soon as a pending DNS/header operation settles. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new ResearchFetchError("request_aborted"));
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

type PinnedOptions = { address: string; family: number; headers: Record<string, string>; signal: AbortSignal };
export type ResearchTransportDeps = {
  resolve(host: string): Promise<{ address: string; family: number }[]>;
  connect(url: URL, options: PinnedOptions): Promise<IncomingMessage>;
  reserve(sourceId: string): Promise<void>;
  secret(ref: string): string | undefined;
};

/** The validated address is the address used for the connection, with TLS still checking the hostname. */
export function connectPinned(url: URL, options: PinnedOptions): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      agent: false,
      family: options.family,
      signal: options.signal,
      headers: options.headers,
      lookup: ((_host: unknown, _opts: unknown, cb: (error: Error | null, address: string, family: number) => void) => {
        cb(null, options.address, options.family);
      }) as never,
    }, resolve);
    req.once("error", reject);
    req.end();
  });
}

type FetchOptions = { source: SourceRecord; signal: AbortSignal };
type ResearchResponse = { url: string; status: number; contentType: string; body: AsyncIterable<Uint8Array> };
export type FetchedResearchResponse = { url: string; status: number; contentType: string; body: Uint8Array };

function checkedUrl(value: string, source: SourceRecord): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ResearchFetchError("url_blocked"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !source.hosts.includes(url.hostname) || url.hash) throw new ResearchFetchError("url_blocked");
  return url;
}

export function createResearchTransport(deps: ResearchTransportDeps) {
  async function openValidatedResearchResponse(value: string, options: FetchOptions): Promise<ResearchResponse> {
    if (options.source.status !== "ready") throw new ResearchFetchError("source_unavailable");
    options.signal.throwIfAborted();
    let url = checkedUrl(value, options.source);
    const origin = url.origin;
    let authAllowed = true;
    const ref = options.source.credentialRef;
    if (ref && !/^[A-Z][A-Z0-9_]{1,127}$/.test(ref)) throw new ResearchFetchError("credential_reference_invalid");
    const secret = ref ? deps.secret(ref) : undefined;
    if (ref && !secret) throw new ResearchFetchError("credential_missing", 401);
    const headerFactory = headersByProvider.get(options.source.provider);
    if (secret && !headerFactory) throw new ResearchFetchError("auth_adapter_missing", 401);

    for (let redirects = 0; redirects <= 3; redirects++) {
      const deadline = new AbortController();
      const timer = setTimeout(() => deadline.abort(), 20_000);
      const signal = AbortSignal.any([options.signal, deadline.signal]);
      let response: IncomingMessage;
      try {
        const addresses = await abortable(deps.resolve(url.hostname), signal);
        if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
          throw new ResearchFetchError("address_blocked");
        }
        signal.throwIfAborted();
        await abortable(deps.reserve(options.source.id), signal);
        signal.throwIfAborted();
        const contact = process.env.RESEARCH_CONTACT_URL;
        const identification = contact && /^(https:\/\/|mailto:)[^\s\r\n]{3,200}$/.test(contact) ? `QCS-Research/1.0 (+${contact})` : "QCS-Research/1.0";
        const headers = { "Accept-Encoding": "identity", "User-Agent": identification, ...(authAllowed && secret ? headerFactory!(secret) : {}) };
        response = await abortable(deps.connect(url, { ...addresses[0], headers, signal }), signal);
      } catch (error) {
        if (error instanceof ResearchFetchError) throw error;
        throw new ResearchFetchError(signal.aborted ? "request_aborted" : "network_failure");
      } finally {
        clearTimeout(timer);
      }

      const status = response.statusCode ?? 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (!response.headers.location) throw new ResearchFetchError("redirect_missing", status);
        if (redirects === 3) throw new ResearchFetchError("redirect_limit", status);
        let next: URL;
        try { next = checkedUrl(new URL(response.headers.location, url).href, options.source); }
        catch { throw new ResearchFetchError("url_blocked"); }
        if (next.origin !== origin) authAllowed = false;
        url = next;
        continue;
      }
      if ((status < 200 || status >= 300) && ![404, 410].includes(status)) {
        response.destroy();
        const cfPause = options.source.provider === "contracts-finder" && status === 403 ? 300_000 : null;
        throw new ResearchFetchError(cfPause ? "source_rate_limit" : "http_failure", status, retryAfterMilliseconds(response.headers["retry-after"]) ?? cfPause);
      }
      const encoding = response.headers["content-encoding"];
      if (encoding && encoding.toLowerCase() !== "identity") {
        response.destroy();
        throw new ResearchFetchError("encoded_body_blocked", status);
      }
      const length = response.headers["content-length"];
      const expected = length === undefined ? null : /^\d+$/.test(length) ? Number(length) : NaN;
      if (expected !== null && !Number.isSafeInteger(expected)) {
        response.destroy(); throw new ResearchFetchError("invalid_content_length", status);
      }
      const body = (async function* () {
        let received = 0;
        const abort = () => response.destroy(new ResearchFetchError("request_aborted"));
        options.signal.addEventListener("abort", abort, { once: true });
        try {
          options.signal.throwIfAborted();
          for await (const chunk of response) {
            options.signal.throwIfAborted();
            const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
            received += bytes.byteLength;
            if (expected !== null && received > expected) throw new ResearchFetchError("content_length_mismatch", status);
            yield bytes;
          }
          if (expected !== null && received !== expected) throw new ResearchFetchError("content_length_mismatch", status);
        } catch (error) {
          if (error instanceof ResearchFetchError) throw error;
          throw new ResearchFetchError(options.signal.aborted ? "request_aborted" : "response_interrupted", status);
        } finally {
          options.signal.removeEventListener("abort", abort);
          response.destroy();
        }
      })();
      return { url: url.href, status, contentType: response.headers["content-type"] ?? "application/octet-stream", body };
    }
    throw new ResearchFetchError("redirect_limit");
  }

  async function safeFetch(value: string, options: FetchOptions & { maxBytes: number }): Promise<FetchedResearchResponse> {
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0 || options.maxBytes > MAX_RESEARCH_RECORD_BYTES) {
      throw new ResearchFetchError("invalid_size_limit");
    }
    const signal = AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]);
    const response = await openValidatedResearchResponse(value, { ...options, signal });
    let size = 0;
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > options.maxBytes) throw new ResearchFetchError("body_too_large", response.status);
      chunks.push(chunk);
    }
    return { ...response, body: Buffer.concat(chunks) };
  }
  return { safeFetch, openValidatedResearchResponse };
}

export const { safeFetch, openValidatedResearchResponse } = createResearchTransport({
  resolve: (host) => lookup(host, { all: true }), connect: connectPinned,
  reserve: reserveSourceRequest, secret: (ref) => process.env[ref],
});

/** Existing company lookups share the provider-wide quota without needing a research run. */
export async function safeFetchCompaniesHouse(url: string, options: { signal: AbortSignal; maxBytes: number }) {
  registerProviderHeaders("companies-house", secret => ({ Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, Accept: "application/json" }));
  const transport = createResearchTransport({
    resolve: host => lookup(host, { all: true }), connect: connectPinned,
    reserve: async () => (await import("@/lib/db/research")).reserveCompaniesHouseBriefRequest(),
    secret: ref => process.env[ref],
  });
  return transport.safeFetch(url, { ...options, source: {
    id: "companies-house-brief", provider: "companies-house", hosts: ["api.company-information.service.gov.uk"],
    credentialRef: "COMPANIES_HOUSE_API_KEY", status: "ready",
  } });
}
