import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type VericaseS3Config = {
  bucket: string;
  region: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function trimSlash(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** Same bucket/region/key names VeriCase uses for AWS S3. */
export function readS3Config(): VericaseS3Config | null {
  const bucket = process.env.S3_BUCKET?.trim() || process.env.MINIO_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim();
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID?.trim() || process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY?.trim() || process.env.S3_SECRET_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const prefix = trimSlash(process.env.S3_KEY_PREFIX?.trim() || "meritus");
  return { bucket, region, prefix, accessKeyId, secretAccessKey };
}

export function isStorageConfigured(): boolean {
  return readS3Config() !== null;
}

function requireConfig(): VericaseS3Config {
  const config = readS3Config();
  if (!config) {
    throw new Error("VeriCase S3 is not configured");
  }
  return config;
}

function client(config: VericaseS3Config): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function objectKey(pathname: string, config = requireConfig()): string {
  const clean = trimSlash(pathname);
  return `${config.prefix}/${clean}`;
}

export async function putObject(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<{ key: string; url: string }> {
  const config = requireConfig();
  const key = objectKey(pathname, config);
  await client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );
  return { key, url: `s3://${config.bucket}/${key}` };
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  const config = requireConfig();
  try {
    const response = await client(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    if (!response.Body) return null;
    return await response.Body.transformToByteArray();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;
  const config = requireConfig();
  const s3 = client(config);
  if (unique.length === 1) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: unique[0],
      })
    );
    return;
  }
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: { Objects: unique.map((Key) => ({ Key })), Quiet: true },
    })
  );
}
