import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isVericaseStorageConfigured } from "@/lib/env";

const PUT_EXPIRES_SECONDS = 15 * 60;

type StorageSettings = {
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function settings(): StorageSettings | null {
  if (!isVericaseStorageConfigured()) return null;
  return {
    region: process.env.VERICASE_AWS_REGION ?? "",
    bucket: process.env.VERICASE_S3_BUCKET ?? "",
    prefix: process.env.VERICASE_S3_PREFIX ?? "",
    accessKeyId: process.env.VERICASE_AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.VERICASE_AWS_SECRET_ACCESS_KEY ?? "",
  };
}

export function vericaseStoragePrefix(): string {
  return settings()?.prefix ?? "";
}

let cached: S3Client | null = null;

function client(): S3Client {
  const conf = settings();
  if (!conf) {
    throw new Error("VeriCase storage is not connected");
  }
  if (!cached) {
    cached = new S3Client({
      region: conf.region,
      credentials: {
        accessKeyId: conf.accessKeyId,
        secretAccessKey: conf.secretAccessKey,
      },
    });
  }
  return cached;
}

export async function createDumpUpload(input: {
  storageKey: string;
  mime: string;
}): Promise<{ url: string; method: "PUT"; headers: Record<string, string> }> {
  const conf = settings();
  if (!conf) {
    throw new Error("VeriCase storage is not connected");
  }
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: conf.bucket,
      Key: input.storageKey,
      ContentType: input.mime,
    }),
    { expiresIn: PUT_EXPIRES_SECONDS }
  );
  return { url, method: "PUT", headers: { "Content-Type": input.mime } };
}

export async function dumpObjectExists(storageKey: string): Promise<boolean> {
  const conf = settings();
  if (!conf) return false;
  try {
    await client().send(new HeadObjectCommand({ Bucket: conf.bucket, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
}

export async function readDumpObject(storageKey: string): Promise<{
  stream: ReadableStream;
  contentType?: string;
} | null> {
  const conf = settings();
  if (!conf) return null;
  const response = await client().send(new GetObjectCommand({ Bucket: conf.bucket, Key: storageKey }));
  if (!response.Body) return null;
  return {
    stream: response.Body.transformToWebStream(),
    contentType: response.ContentType,
  };
}

export async function deleteDumpObject(storageKey: string): Promise<void> {
  const conf = settings();
  if (!conf) return;
  await client().send(new DeleteObjectCommand({ Bucket: conf.bucket, Key: storageKey }));
}
