// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { isStorageConfigured, objectKey, readS3Config } from "./s3";

const KEYS = [
  "S3_BUCKET",
  "MINIO_BUCKET",
  "S3_REGION",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_KEY_PREFIX",
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    if (!(key in saved)) saved[key] = process.env[key];
    const next = values[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
}

describe("readS3Config", () => {
  it("accepts the VeriCase AWS names", () => {
    setEnv({
      S3_BUCKET: "vericase-docs",
      S3_REGION: "eu-west-2",
      AWS_ACCESS_KEY_ID: "AKIATEST",
      AWS_SECRET_ACCESS_KEY: "secret",
    });
    expect(readS3Config()).toEqual({
      bucket: "vericase-docs",
      region: "eu-west-2",
      prefix: "meritus",
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
    });
    expect(isStorageConfigured()).toBe(true);
  });

  it("falls back to MINIO_BUCKET and S3_ACCESS_KEY the way VeriCase does", () => {
    setEnv({
      MINIO_BUCKET: "vericase-docs",
      AWS_REGION: "us-east-1",
      S3_ACCESS_KEY: "minio-key",
      S3_SECRET_KEY: "minio-secret",
      S3_KEY_PREFIX: "/meritusvia/",
    });
    expect(readS3Config()).toMatchObject({
      bucket: "vericase-docs",
      region: "us-east-1",
      prefix: "meritusvia",
      accessKeyId: "minio-key",
      secretAccessKey: "minio-secret",
    });
  });

  it("is unset when the bucket or keys are missing", () => {
    setEnv({ S3_BUCKET: "vericase-docs", S3_REGION: "eu-west-2" });
    expect(readS3Config()).toBeNull();
    expect(isStorageConfigured()).toBe(false);
  });

  it("prefixes portal paths so they sit beside VeriCase objects", () => {
    setEnv({
      S3_BUCKET: "vericase-docs",
      S3_REGION: "eu-west-2",
      AWS_ACCESS_KEY_ID: "AKIATEST",
      AWS_SECRET_ACCESS_KEY: "secret",
    });
    expect(objectKey("portal/library/firm/a.pdf")).toBe("meritus/portal/library/firm/a.pdf");
  });
});
