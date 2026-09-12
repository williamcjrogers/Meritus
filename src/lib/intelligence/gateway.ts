import { createHash, createHmac } from "node:crypto";
import { requirePortalUser } from "@/lib/portal/auth";
import { intelligenceServiceConfig } from "./config";

export const INTELLIGENCE_GATEWAY_PATH = "/api/portal/intelligence/desk";
export const MAX_REQUEST_BYTES = 1_000_000;
// Allows for a serverless binary response envelope within Vercel's 4.5 MB limit.
export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
export const GATEWAY_TIMEOUT_MS = 90_000;
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const SAFE_METHODS = new Set(["GET", "HEAD"]);

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'",
};

class GatewayFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** A fixed origin and strict path keep encoded separators or nested URLs out of the proxy. */
export function backendRequestPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const pathname = url.pathname;
  if (url.hash || (pathname !== INTELLIGENCE_GATEWAY_PATH && !pathname.startsWith(`${INTELLIGENCE_GATEWAY_PATH}/`))) {
    throw new GatewayFailure(400, "Invalid Intelligence request path.");
  }
  const path = pathname.slice(INTELLIGENCE_GATEWAY_PATH.length) || "/";
  if (path.includes("//") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new GatewayFailure(400, "Invalid Intelligence request path.");
  }
  for (const segment of path.split("/")) {
    let decoded: string;
    try { decoded = decodeURIComponent(segment); } catch { throw new GatewayFailure(400, "Invalid Intelligence request path."); }
    if (decoded === "." || decoded === ".." || /[%/\\\u0000-\u001f\u007f]/.test(decoded)) {
      throw new GatewayFailure(400, "Invalid Intelligence request path.");
    }
  }
  const result = path + url.search;
  if (result.length > 8192) throw new GatewayFailure(414, "The Intelligence request URL is too long.");
  return result;
}

export function signBridgeRequest(userId: string, method: string, path: string, body: Uint8Array, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: userId,
    iat: Math.floor(now / 1000),
    method,
    path,
    body_sha256: createHash("sha256").update(body).digest("hex"),
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function boundedBody(stream: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal, oversized: GatewayFailure): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let rejectAborted: (error: Error) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAborted = reject; });
  const onAbort = () => {
    rejectAborted(new GatewayFailure(504, "Intelligence took too long to respond. Please try again."));
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted) onAbort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw oversized;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Keep the deadline and upstream cancellation alive for the whole download. */
function downloadStream(source: ReadableStream<Uint8Array>, signal: AbortSignal, cleanup: () => void): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let finished = false;
  let output: ReadableStreamDefaultController<Uint8Array>;
  const finish = () => {
    if (finished) return;
    finished = true;
    signal.removeEventListener("abort", abort);
    cleanup();
  };
  const release = () => { try { reader.releaseLock(); } catch { /* A cancelled read is settling. */ } };
  const abort = () => {
    if (finished) return;
    finish();
    output.error(new Error("The Intelligence download was interrupted. Please try again."));
    void reader.cancel().catch(() => undefined).finally(release);
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (finished) return;
        if (done) { finish(); release(); controller.close(); }
        else controller.enqueue(value);
      } catch {
        if (!finished) {
          finish();
          controller.error(new Error("The Intelligence download was interrupted. Please try again."));
        }
        release();
      }
    },
    async cancel(reason) { finish(); try { await reader.cancel(reason); } finally { release(); } },
  });
}

function failureResponse(request: Request, status: number, detail: string): Response {
  const headers = new Headers(PRIVATE_HEADERS);
  if (status === 503 || status === 504) headers.set("Retry-After", "5");
  const isDocument = request.method === "GET" && request.headers.get("sec-fetch-dest") === "iframe";
  if (isDocument) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Intelligence unavailable</title><style>body{margin:0;padding:clamp(24px,6vw,64px);font:16px/1.6 system-ui,sans-serif;color:#233b36;background:#f7f8f5}main{max-width:38rem}h1{font-size:26px;line-height:1.25}a{color:inherit}</style><main><h1>Intelligence is unavailable</h1><p role="alert">${escapeHtml(detail)}</p><p>Use Refresh desk above to try again.</p></main></html>`, { status, headers });
  }
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ detail }), { status, headers });
}

/** Every resource, including the compiled UI assets, needs fresh director authority. */
export async function proxyIntelligenceRequest(request: Request): Promise<Response> {
  let actor: Awaited<ReturnType<typeof requirePortalUser>>;
  try { actor = await requirePortalUser(); } catch {
    return failureResponse(request, 503, "We could not verify your access. Please try again.");
  }
  if (actor.error) {
    const status = actor.error.status;
    const detail = status === 401
      ? "Your session has expired. Sign in to the Directors Workspace again."
      : status === 403 ? "Director access is required for Intelligence." : "We could not verify your access. Please try again.";
    return failureResponse(request, status, detail);
  }
  if (!METHODS.has(request.method)) return failureResponse(request, 405, "This Intelligence request method is not supported.");
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(actor.userId)) return failureResponse(request, 503, "We could not verify your access. Please try again.");
  const config = intelligenceServiceConfig();
  if (!config) return failureResponse(request, 503, "The analyst service has not been connected to this workspace yet.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal.addEventListener("abort", onAbort, { once: true });
  let streaming = false;
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", onAbort); };
  try {
    const path = backendRequestPath(request.url);
    if (!SAFE_METHODS.has(request.method)) {
      const expectedOrigin = new URL(request.url).origin;
      if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") !== "same-origin") {
        throw new GatewayFailure(403, "This change must be made from the Directors Workspace. Refresh the page and try again.");
      }
    }
    if (request.signal.aborted) controller.abort();
    const tooLarge = new GatewayFailure(413, "The request exceeds the Intelligence upload limit of 1 MB.");
    const declaredSize = request.headers.get("content-length");
    if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > MAX_REQUEST_BYTES)) throw tooLarge;
    const body = await boundedBody(request.body, MAX_REQUEST_BYTES, controller.signal, tooLarge);
    const headers = new Headers();
    for (const name of ["accept", "content-type"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("X-Meritus-Bridge", signBridgeRequest(actor.userId, request.method, path, body, config.secret));
    const upstream = await fetch(config.origin + path, {
      method: request.method,
      headers,
      body: SAFE_METHODS.has(request.method) ? undefined : body as BodyInit,
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      void upstream.body?.cancel().catch(() => undefined);
      throw new GatewayFailure(502, "Intelligence returned an unexpected redirect. Please try again later.");
    }
    const responseHeaders = new Headers(PRIVATE_HEADERS);
    for (const name of ["content-type", "content-disposition", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Full-corpus reports exceed the buffered Vercel response limit. Stream only
    // successful, explicitly attached report formats after the same rights check.
    if (request.method === "GET" && upstream.status === 200 && upstream.body
        && /^\/api\/exports\/[A-Za-z0-9_-]+\.(csv|html)(?:\?|$)/.test(path)
        && /^attachment(?:;|$)/i.test(upstream.headers.get("content-disposition") ?? "")) {
      const response = new Response(downloadStream(upstream.body, controller.signal, cleanup), { status: upstream.status, headers: responseHeaders });
      streaming = true;
      return response;
    }
    const responseTooLarge = new GatewayFailure(502, "The Intelligence response is too large to open here. Please contact the workspace operator.");
    const responseSize = upstream.headers.get("content-length");
    if (responseSize && Number(responseSize) > MAX_RESPONSE_BYTES) {
      void upstream.body?.cancel().catch(() => undefined);
      throw responseTooLarge;
    }
    const responseBody = await boundedBody(upstream.body, MAX_RESPONSE_BYTES, controller.signal, responseTooLarge);
    return new Response(request.method === "HEAD" || upstream.status === 204 || upstream.status === 205 ? null : responseBody as BodyInit, {
      status: upstream.status, headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof GatewayFailure) return failureResponse(request, error.status, error.message);
    if (controller.signal.aborted) return failureResponse(request, 504, "Intelligence took too long to respond. Please try again.");
    return failureResponse(request, 502, "The analyst service could not be reached. Please try again shortly.");
  } finally {
    if (!streaming) cleanup();
  }
}
