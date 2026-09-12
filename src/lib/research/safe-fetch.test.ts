// @vitest-environment node
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/research", () => ({ reserveSourceRequest: vi.fn() }));
import { createResearchTransport, publicAddress, registerProviderHeaders, retryAfterMilliseconds } from "./safe-fetch";
import type { SourceRecord } from "./contracts";

const source: SourceRecord = { id: "source-1", provider: "fixture", hosts: ["example.com", "other.example"], status: "ready", credentialRef: null };
const response = (status = 200, chunks = ["data"], headers: Record<string, string> = {}) => Object.assign(Readable.from(chunks.map(c => Buffer.from(c))), { statusCode: status, headers }) as IncomingMessage;
const resolve = vi.fn(); const connect = vi.fn(); const reserve = vi.fn(); const secret = vi.fn();
const transport = createResearchTransport({ resolve, connect, reserve, secret });
const options = () => ({ source, signal: new AbortController().signal, maxBytes: 100 });
beforeEach(() => {
  vi.resetAllMocks(); resolve.mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
  connect.mockImplementation(async () => response()); reserve.mockResolvedValue(undefined);
});
it.each(["http://example.com", "https://user:secret@example.com/", "https://example.com:8443/", "https://127.0.0.1/", "https://evil.example/"])("blocks unauthorised URL %s before DNS", async (url) => {
  await expect(transport.safeFetch(url, options())).rejects.toMatchObject({ code: "url_blocked" });
  expect(resolve).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled();
});
it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.100.100.100", "::1", "::ffff:127.0.0.1", "fc00::1", "2001:db8::1", "192.0.2.1"])("rejects private or special address %s", async (address) => {
  expect(publicAddress(address)).toBe(false);
  resolve.mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }]);
  await expect(transport.safeFetch("https://example.com", options())).rejects.toMatchObject({ code: "address_blocked" });
  expect(connect).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled();
});
it("passes the validated address into the connection and reserves each attempt", async () => {
  const result = await transport.safeFetch("https://example.com/path", options());
  expect(result.body.toString()).toBe("data");
  expect(connect.mock.calls[0][1]).toMatchObject({ address: "93.184.215.14", family: 4 });
  expect(reserve).toHaveBeenCalledExactlyOnceWith("source-1");
});
it("strips credentials permanently after crossing hosts, even when redirected back", async () => {
  registerProviderHeaders("fixture", value => ({ Authorization: `Bearer ${value}` })); secret.mockReturnValue("test-secret");
  connect.mockResolvedValueOnce(response(302, [], { location: "https://other.example/" }))
    .mockResolvedValueOnce(response(302, [], { location: "https://example.com/final" }))
    .mockResolvedValueOnce(response());
  await transport.safeFetch("https://example.com", { ...options(), source: { ...source, credentialRef: "FIXTURE_KEY" } });
  expect(connect.mock.calls.map(c => c[1].headers.Authorization)).toEqual(["Bearer test-secret", undefined, undefined]);
  expect(reserve).toHaveBeenCalledTimes(3);
});
it("validates DNS again after redirects", async () => {
  connect.mockResolvedValueOnce(response(302, [], { location: "/next" }));
  resolve.mockResolvedValueOnce([{ address: "93.184.215.14", family: 4 }]).mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
  await expect(transport.safeFetch("https://example.com", options())).rejects.toMatchObject({ code: "address_blocked" });
  expect(connect).toHaveBeenCalledTimes(1);
});
it("bounds streamed bytes and refuses encoded or truncated responses", async () => {
  connect.mockResolvedValueOnce(response(200, ["123", "456"]));
  await expect(transport.safeFetch("https://example.com", { ...options(), maxBytes: 5 })).rejects.toMatchObject({ code: "body_too_large" });
  connect.mockResolvedValueOnce(response(200, ["data"], { "content-encoding": "gzip" }));
  await expect(transport.safeFetch("https://example.com", options())).rejects.toMatchObject({ code: "encoded_body_blocked" });
  connect.mockResolvedValueOnce(response(200, ["short"], { "content-length": "50" }));
  await expect(transport.safeFetch("https://example.com", options())).rejects.toMatchObject({ code: "content_length_mismatch" });
});
it("does not charge or connect without required credentials", async () => {
  await expect(transport.safeFetch("https://example.com", { ...options(), source: { ...source, credentialRef: "FIXTURE_KEY" } })).rejects.toMatchObject({ code: "credential_missing" });
  expect(connect).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled();
});
it("cancels stalled DNS without connecting", async () => {
  resolve.mockReturnValue(new Promise(() => {})); const controller = new AbortController();
  const pending = expect(transport.safeFetch("https://example.com", { ...options(), signal: controller.signal })).rejects.toMatchObject({ code: "request_aborted" });
  controller.abort(); await pending; expect(connect).not.toHaveBeenCalled();
});
it("keeps 404/410 visible and preserves a Retry-After pause on errors", async () => {
  connect.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(410)).mockResolvedValueOnce(response(429, [], { "retry-after": "300" }));
  expect((await transport.safeFetch("https://example.com", options())).status).toBe(404);
  expect((await transport.safeFetch("https://example.com", options())).status).toBe(410);
  await expect(transport.safeFetch("https://example.com", options())).rejects.toMatchObject({ status: 429, retryAfterMs: 300000 });
  expect(retryAfterMilliseconds("invalid")).toBeNull();
});
it("classifies Contracts Finder's documented403 as a rate pause", async () => {
  connect.mockResolvedValueOnce(response(403));
  await expect(transport.safeFetch("https://example.com", { ...options(), source: { ...source, provider: "contracts-finder" } })).rejects.toMatchObject({ code: "source_rate_limit", status: 403, retryAfterMs: 300000 });
});
