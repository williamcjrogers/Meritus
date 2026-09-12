// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/portal/auth";
import { intelligenceServiceConfig } from "./config";
import {
  backendRequestPath, GATEWAY_TIMEOUT_MS, INTELLIGENCE_GATEWAY_PATH,
  MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, proxyIntelligenceRequest, signBridgeRequest,
} from "./gateway";
import * as route from "@/app/api/portal/intelligence/desk/[[...path]]/route";

vi.mock("@/lib/portal/auth", () => ({ requirePortalUser: vi.fn() }));

const ORIGIN = "https://meritus.example";
const SERVICE = "https://analyst.internal.example";
const SECRET = "a-test-secret-at-least-32-characters";
const fetchMock = vi.fn<typeof fetch>();

function request(path = "/", init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (init.method && !["GET", "HEAD"].includes(init.method)) {
    if (!headers.has("origin")) headers.set("origin", ORIGIN);
    if (!headers.has("sec-fetch-site")) headers.set("sec-fetch-site", "same-origin");
  }
  return new Request(ORIGIN + INTELLIGENCE_GATEWAY_PATH + path, { ...init, headers });
}

function stream(chunks: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) { for (const size of chunks) controller.enqueue(new Uint8Array(size)); controller.close(); },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("INTELLIGENCE_SERVICE_URL", SERVICE);
  vi.stubEnv("INTELLIGENCE_BRIDGE_SECRET", SECRET);
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(requirePortalUser).mockResolvedValue({ userId: "user_director_123" });
  fetchMock.mockResolvedValue(new Response('{"items":[]}', { headers: { "content-type": "application/json" } }));
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("runtime configuration", () => {
  it("accepts a fixed HTTPS service origin and preserves the raw shared key", () => {
    vi.stubEnv("INTELLIGENCE_SERVICE_URL", SERVICE + "/");
    vi.stubEnv("INTELLIGENCE_BRIDGE_SECRET", ` ${SECRET} `);
    expect(intelligenceServiceConfig()).toEqual({ origin: SERVICE, secret: ` ${SECRET} ` });
  });
  it.each(["", "https://", "http://analyst.example", "https://user:password@analyst.example", `${SERVICE}/private`, `${SERVICE}?token=secret`, `${SERVICE}#fragment`, "javascript:alert(1)"])("rejects invalid or credential-bearing service URLs: %s", value => {
    vi.stubEnv("INTELLIGENCE_SERVICE_URL", value);
    expect(intelligenceServiceConfig()).toBeNull();
  });
  it.each(["", "x".repeat(31), " ".repeat(32), "😀".repeat(16)])("rejects missing or too-short keys", key => {
    vi.stubEnv("INTELLIGENCE_BRIDGE_SECRET", key);
    expect(intelligenceServiceConfig()).toBeNull();
  });
});

describe("director gateway authority", () => {
  it.each([401, 403, 503])("denies every document, asset and API request before fetching (%s)", async status => {
    vi.mocked(requirePortalUser).mockResolvedValue({ error: NextResponse.json({ error: "denied" }, { status }) });
    for (const path of ["/", "/assets/index.js", "/assets/style.css", "/api/evidence"]) {
      const response = await proxyIntelligenceRequest(request(path));
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect((await response.json()).detail).toBeTruthy();
    }
    expect(requirePortalUser).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rechecks authority when a signed-in director loses access", async () => {
    vi.mocked(requirePortalUser).mockResolvedValueOnce({ userId: "user_director_123" }).mockResolvedValueOnce({ error: NextResponse.json({}, { status: 403 }) });
    expect((await proxyIntelligenceRequest(request("/api/evidence"))).status).toBe(200);
    expect((await proxyIntelligenceRequest(request("/assets/index.js"))).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns a readable iframe failure when the session has expired", async () => {
    vi.mocked(requirePortalUser).mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    const response = await proxyIntelligenceRequest(request("/", { headers: { "sec-fetch-dest": "iframe" } }));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Your session has expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not disclose provider exceptions or attempt an upstream call", async () => {
    vi.mocked(requirePortalUser).mockRejectedValue(new Error("private provider detail"));
    const response = await proxyIntelligenceRequest(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not attempt an upstream call when runtime configuration is missing", async () => {
    vi.stubEnv("INTELLIGENCE_BRIDGE_SECRET", "");
    const response = await proxyIntelligenceRequest(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: "The analyst service has not been connected to this workspace yet." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("all supported route handlers use the same protected gateway", () => {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const) expect(route[method]).toBe(proxyIntelligenceRequest);
    expect("OPTIONS" in route).toBe(false);
  });
});

describe("request integrity and browser boundaries", () => {
  it("signs the current director, exact encoded path/query, method and raw body with no credential forwarding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
    const body = '{"note":"£ reviewed"}';
    const path = "/api/entities/a%20b?source=x%2Fy&next=https%3A%2F%2Fexample.org&a=1&a=2";
    const response = await proxyIntelligenceRequest(request(path, {
      method: "PATCH", body, headers: {
        "content-type": "application/json", accept: "application/json", cookie: "private-session=123",
        authorization: "Bearer should-never-leave", "x-meritus-bridge": "attacker", "x-forwarded-host": "attacker.example",
      },
    }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SERVICE + path);
    expect(init).toMatchObject({ method: "PATCH", redirect: "manual", credentials: "omit", cache: "no-store" });
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe(body);
    const headers = new Headers(init?.headers);
    expect([...headers.keys()].sort()).toEqual(["accept", "content-type", "x-meritus-bridge"]);
    const [payload, signature] = headers.get("x-meritus-bridge")!.split(".");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      v: 1, sub: "user_director_123", iat: 1789214400, method: "PATCH", path,
      body_sha256: createHash("sha256").update(body).digest("hex"),
    });
    expect(signature).toBe(createHmac("sha256", SECRET).update(payload).digest("hex"));
    expect(await response.text()).not.toContain(SECRET);
  });
  it("uses an empty-body digest and a canonical slash for GET at the gateway root", async () => {
    await proxyIntelligenceRequest(request(""));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SERVICE + "/");
    expect(init?.body).toBeUndefined();
    const token = new Headers(init?.headers).get("x-meritus-bridge")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(payload.body_sha256).toBe(createHash("sha256").update("").digest("hex"));
  });
  it("produces a deterministic protocol token without accepting caller identity fields", () => {
    const token = signBridgeRequest("user_A", "GET", "/api/auth/session", new Uint8Array(), SECRET, 1000);
    const [encoded, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(encoded, "base64url").toString())).toMatchObject({ sub: "user_A", iat: 1, method: "GET", path: "/api/auth/session" });
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
  it("matches the Python bridge verification fixture byte for byte", () => {
    expect(signBridgeRequest("user_directorA", "GET", "/api/auth/me", new Uint8Array(), "bridge-test-secret-that-is-at-least-32-characters", 1789200000000)).toBe(
      "eyJ2IjoxLCJzdWIiOiJ1c2VyX2RpcmVjdG9yQSIsImlhdCI6MTc4OTIwMDAwMCwibWV0aG9kIjoiR0VUIiwicGF0aCI6Ii9hcGkvYXV0aC9tZSIsImJvZHlfc2hhMjU2IjoiZTNiMGM0NDI5OGZjMWMxNDlhZmJmNGM4OTk2ZmI5MjQyN2FlNDFlNDY0OWI5MzRjYTQ5NTk5MWI3ODUyYjg1NSJ9.5ffa6648c005fc9d2722df5a9f819aaa43248581e453bf20e20af531a8f1f9d8",
    );
  });
  it.each([
    { origin: "https://attacker.example", "sec-fetch-site": "same-origin" },
    { origin: ORIGIN, "sec-fetch-site": "cross-site" },
    { origin: ORIGIN, "sec-fetch-site": "same-site" },
    { origin: "null", "sec-fetch-site": "same-origin" },
    { origin: "", "sec-fetch-site": "same-origin" },
    { origin: ORIGIN, "sec-fetch-site": "" },
  ])("rejects mutations without exact origin and same-origin Fetch Metadata (%o)", async headers => {
    const response = await proxyIntelligenceRequest(request("/api/sources/a", { method: "PUT", headers, body: "{}" }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("requires both browser headers for %s", async method => {
    const raw = new Request(ORIGIN + INTELLIGENCE_GATEWAY_PATH + "/api/sources/a", { method, body: "{}" });
    expect((await proxyIntelligenceRequest(raw)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["//evil.example/", "/%2f%2fevil.example", "/api/%5csecret", "/api/%252e%252e/secret", "/api/%00", "/api/%zz"])("rejects encoded or ambiguous paths: %s", async path => {
    expect((await proxyIntelligenceRequest(request(path))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a traversal outside the gateway and an overlong URL", async () => {
    expect((await proxyIntelligenceRequest(request("/../../../private"))).status).toBe(400);
    expect((await proxyIntelligenceRequest(request("/api/evidence?q=" + "x".repeat(8192)))).status).toBe(414);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("cannot proxy another API path or accept a fragment", () => {
    expect(() => backendRequestPath(ORIGIN + "/api/other")).toThrow("Invalid Intelligence request path");
    expect(() => backendRequestPath(ORIGIN + INTELLIGENCE_GATEWAY_PATH + "/#secret")).toThrow("Invalid Intelligence request path");
  });
});

describe("bounded private transport", () => {
  it("rejects a declared oversized request without contacting the service", async () => {
    const response = await proxyIntelligenceRequest(request("/api/imports", { method: "POST", body: "{}", headers: { "content-length": String(MAX_REQUEST_BYTES + 1) } }));
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("counts streamed request bytes even when content-length is absent or false", async () => {
    const response = await proxyIntelligenceRequest(request("/api/imports", {
      method: "POST", body: stream([500_000, 500_001]), headers: { "content-length": "2" }, duplex: "half",
    } as RequestInit));
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("forwards downloads with only allowed private response headers", async () => {
    fetchMock.mockResolvedValue(new Response("column\nvalue", { headers: {
      "content-type": "text/csv", "content-disposition": 'attachment; filename="snapshot.csv"',
      "set-cookie": "private-backend-session=secret", location: "https://private.example",
      "access-control-allow-origin": "*", "cache-control": "public,max-age=3600", "x-provider-secret": "hidden",
      "content-length": "12", "content-encoding": "gzip",
    } }));
    const response = await proxyIntelligenceRequest(request("/api/exports/a.csv"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("column\nvalue");
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="snapshot.csv"');
    for (const key of ["set-cookie", "location", "access-control-allow-origin", "x-provider-secret", "content-length", "content-encoding"]) expect(response.headers.has(key)).toBe(false);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
  });
  it.each([301, 302, 303, 307, 308])("rejects a redirect without contacting its target: %s", async status => {
    fetchMock.mockResolvedValue(new Response("redirect", { status, headers: { location: "https://untrusted.example" } }));
    const response = await proxyIntelligenceRequest(request());
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("bounds a streamed response even without a trustworthy content-length", async () => {
    fetchMock.mockResolvedValue(new Response(stream([MAX_RESPONSE_BYTES, 1])));
    const response = await proxyIntelligenceRequest(request("/api/exports/a.csv"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ detail: "The Intelligence response is too large to open here. Please contact the workspace operator." });
  });
  it("rejects an oversized declared response before buffering it", async () => {
    fetchMock.mockResolvedValue(new Response("small", { headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) } }));
    expect((await proxyIntelligenceRequest(request())).status).toBe(502);
  });
  it("preserves a bodyless HEAD response and a successful DELETE", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const head = await proxyIntelligenceRequest(request("/api/evidence", { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const deleted = await proxyIntelligenceRequest(request("/api/reviews/a", { method: "DELETE" }));
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
  });
  it("times out an upstream request without disclosing connection details", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("internal host detail")), { once: true });
    }));
    const pending = proxyIntelligenceRequest(request());
    await vi.advanceTimersByTimeAsync(GATEWAY_TIMEOUT_MS + 1);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.text()).not.toContain("internal host");
  });
  it("times out a stalled response body", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start() { /* Upstream never completes. */ } })));
    const pending = proxyIntelligenceRequest(request());
    await vi.advanceTimersByTimeAsync(GATEWAY_TIMEOUT_MS + 1);
    expect((await pending).status).toBe(504);
  });
  it("times out a stalled request body before connecting upstream", async () => {
    vi.useFakeTimers();
    const pending = proxyIntelligenceRequest(request("/api/imports", { method: "POST", body: new ReadableStream({ start() {} }), duplex: "half" } as RequestInit));
    await vi.advanceTimersByTimeAsync(GATEWAY_TIMEOUT_MS + 1);
    expect((await pending).status).toBe(504);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sanitises transport failures", async () => {
    fetchMock.mockRejectedValue(new Error("shared secret and internal hostname"));
    const response = await proxyIntelligenceRequest(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("shared secret");
  });
  it.each(["csv", "html"])("streams a complete large %s export without the buffered response limit", async extension => {
    const bytes = 14 * 1024 * 1024;
    fetchMock.mockResolvedValue(new Response(stream([bytes / 2, bytes / 2]), { headers: { "content-disposition": `attachment; filename="snapshot.${extension}"`, "content-length": String(bytes) } }));
    const response = await proxyIntelligenceRequest(request(`/api/exports/snapshot-test.${extension}`));
    expect(response.status).toBe(200);
    expect(response.headers.has("content-length")).toBe(false);
    expect((await response.arrayBuffer()).byteLength).toBe(bytes);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps the deadline active after handing a download to the browser", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel: cancelled }), { headers: { "content-disposition": "attachment" } }));
    const response = await proxyIntelligenceRequest(request("/api/exports/test.csv"));
    const reading = response.arrayBuffer();
    const rejected = expect(reading).rejects.toThrow("download was interrupted");
    await vi.advanceTimersByTimeAsync(GATEWAY_TIMEOUT_MS + 1);
    await rejected;
    expect(cancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels upstream transfer and clears the deadline when the browser cancels", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel: cancelled }), { headers: { "content-disposition": "attachment" } }));
    const response = await proxyIntelligenceRequest(request("/api/exports/test.csv"));
    await response.body!.cancel();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not relax limits for error responses or non-export attachment paths", async () => {
    fetchMock.mockResolvedValueOnce(new Response(stream([MAX_RESPONSE_BYTES + 1]), { status: 403, headers: { "content-disposition": "attachment" } }))
      .mockResolvedValueOnce(new Response(stream([MAX_RESPONSE_BYTES + 1]), { headers: { "content-disposition": "attachment" } }));
    expect((await proxyIntelligenceRequest(request("/api/exports/test.csv"))).status).toBe(502);
    expect((await proxyIntelligenceRequest(request("/api/evidence"))).status).toBe(502);
  });
});
