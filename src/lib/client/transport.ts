import type { UploadTransport } from "./upload";

const BASE = "/api/client/uploads";

async function json<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

function post(url: string, body: unknown, method = "POST"): Promise<Response> {
  return fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** The real transport: JSON to the Meritus routes, and an XMLHttpRequest PUT to S3 for byte-level progress. */
export const browserTransport: UploadTransport = {
  async create(file) {
    return json(await post(BASE, { fileName: file.name, size: file.size, mime: file.type }));
  },
  async describe(id) {
    return json(await fetch(`${BASE}/${encodeURIComponent(id)}`));
  },
  async sign(id, partNumbers) {
    const data = await json<{ urls: Record<string, string> }>(await post(`${BASE}/${encodeURIComponent(id)}/parts`, { partNumbers }));
    return data.urls;
  },
  putPart(url, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (event) => onProgress(event.loaded);
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Storage answered ${xhr.status}`));
          return;
        }
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("Storage did not return an ETag; the bucket must expose it"));
          return;
        }
        resolve(etag);
      };
      xhr.onerror = () => reject(new Error("The connection dropped while uploading"));
      xhr.send(blob);
    });
  },
  async complete(id, parts) {
    return json(await post(`${BASE}/${encodeURIComponent(id)}/complete`, { parts }));
  },
  async abort(id) {
    await json(await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
};
