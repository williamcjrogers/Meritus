// @vitest-environment node
import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  PART_URL_TTL_SECONDS,
  abortMultipartUpload,
  completeMultipartUpload,
  headObject,
  listUploadedParts,
  presignDownload,
  presignUploadPart,
  s3Url,
} from "./s3-transfer";

beforeEach(() => {
  vi.stubEnv("S3_BUCKET", "vericase-test");
  vi.stubEnv("S3_REGION", "eu-west-2");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("S3_KEY_PREFIX", "meritus");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("presigned urls", () => {
  it("signs an upload part for one key, one upload id and one part number, for an hour", async () => {
    const url = new URL(await presignUploadPart("meritus/clients/example-firm.co.uk/abc-bundle.pdf", "up-1", 7));
    expect(url.host).toBe("vericase-test.s3.eu-west-2.amazonaws.com");
    expect(url.pathname).toBe("/meritus/clients/example-firm.co.uk/abc-bundle.pdf");
    expect(url.searchParams.get("partNumber")).toBe("7");
    expect(url.searchParams.get("uploadId")).toBe("up-1");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(PART_URL_TTL_SECONDS));
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs a download for one minute as an attachment", async () => {
    const url = new URL(await presignDownload("meritus/clients/example-firm.co.uk/abc-bundle.pdf", "Trial bundle.pdf"));
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(DOWNLOAD_URL_TTL_SECONDS));
    expect(url.searchParams.get("response-content-disposition")).toContain("attachment");
    expect(url.searchParams.get("response-content-disposition")).toContain("Trial bundle.pdf");
  });

  it("builds the s3 url", () => {
    expect(s3Url("meritus/clients/x/f.pdf")).toBe("s3://vericase-test/meritus/clients/x/f.pdf");
  });
});

describe("multipart control", () => {
  it("completes with the parts in order and the ETag, PartNumber shape S3 expects", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    await completeMultipartUpload("k", "up-1", [
      { partNumber: 2, etag: '"b"' },
      { partNumber: 1, etag: '"a"' },
    ]);
    const command = send.mock.calls[0][0] as unknown as { input: Record<string, unknown> };
    expect(command.input).toEqual({
      Bucket: "vericase-test",
      Key: "k",
      UploadId: "up-1",
      MultipartUpload: { Parts: [{ PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' }] },
    });
  });

  it("lists parts across pages", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 1, ETag: '"a"', Size: 5 }], IsTruncated: true, NextPartNumberMarker: 1 } as never)
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 2, ETag: '"b"', Size: 3 }], IsTruncated: false } as never);
    expect(await listUploadedParts("k", "up-1")).toEqual([
      { partNumber: 1, etag: '"a"', size: 5 },
      { partNumber: 2, etag: '"b"', size: 3 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("swallows NoSuchUpload on abort and NotFound on head", async () => {
    const gone = Object.assign(new Error("gone"), { name: "NoSuchUpload" });
    const missing = Object.assign(new Error("missing"), { name: "NotFound" });
    vi.spyOn(S3Client.prototype, "send").mockRejectedValueOnce(gone as never).mockRejectedValueOnce(missing as never);
    await expect(abortMultipartUpload("k", "up-1")).resolves.toBeUndefined();
    expect(await headObject("k")).toBeNull();
  });

  it("returns size and type from head", async () => {
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({ ContentLength: 42, ContentType: "application/pdf" } as never);
    expect(await headObject("k")).toEqual({ size: 42, contentType: "application/pdf" });
  });
});
