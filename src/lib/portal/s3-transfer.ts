/**
 * Everything the client file drop needs from S3 beyond putObject: multipart control, presigned
 * part and download URLs, HeadObject and a streamed GetObject. Its own client is built with
 * checksum calculation off, because the browser sends the parts and would not know the headers.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition } from "./files";
import { readS3Config, type VericaseS3Config } from "./s3";

export const PART_URL_TTL_SECONDS = 3600;
export const DOWNLOAD_URL_TTL_SECONDS = 60;

export type UploadedPart = { partNumber: number; etag: string; size: number };

function requireConfig(): VericaseS3Config {
  const config = readS3Config();
  if (!config) throw new Error("VeriCase S3 is not configured");
  return config;
}

function transferClient(config: VericaseS3Config): S3Client {
  return new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

export function s3Url(key: string): string {
  return `s3://${requireConfig().bucket}/${key}`;
}

export async function createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string }> {
  const config = requireConfig();
  const response = await transferClient(config).send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );
  if (!response.UploadId) throw new Error("S3 returned no upload id");
  return { uploadId: response.UploadId };
}

export async function presignUploadPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  const config = requireConfig();
  return getSignedUrl(
    transferClient(config),
    new UploadPartCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: PART_URL_TTL_SECONDS }
  );
}

export async function listUploadedParts(key: string, uploadId: string): Promise<UploadedPart[]> {
  const config = requireConfig();
  const client = transferClient(config);
  const parts: UploadedPart[] = [];
  let marker: number | undefined;
  do {
    const page = await client.send(
      new ListPartsCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker?.toString() })
    );
    for (const part of page.Parts ?? []) {
      if (part.PartNumber && part.ETag) {
        parts.push({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size ?? 0 });
      }
    }
    marker = page.IsTruncated && page.NextPartNumberMarker ? Number(page.NextPartNumberMarker) : undefined;
  } while (marker !== undefined);
  return parts;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  const config = requireConfig();
  const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await transferClient(config).send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: ordered.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    })
  );
}

/** Idempotent: an upload S3 no longer knows about is treated as already aborted. */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const config = requireConfig();
  try {
    await transferClient(config).send(
      new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId })
    );
  } catch (error) {
    if (errorName(error) === "NoSuchUpload") return;
    throw error;
  }
}

export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const config = requireConfig();
  try {
    const response = await transferClient(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { size: response.ContentLength ?? 0, contentType: response.ContentType ?? null };
  } catch (error) {
    const name = errorName(error);
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

/** The object as a web stream, so a route can hand it to `new Response()` without buffering. */
export async function getObjectStream(
  key: string
): Promise<{ body: ReadableStream; size: number | null; contentType: string | null } | null> {
  const config = requireConfig();
  try {
    const response = await transferClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!response.Body) return null;
    return {
      body: response.Body.transformToWebStream(),
      size: response.ContentLength ?? null,
      contentType: response.ContentType ?? null,
    };
  } catch (error) {
    const name = errorName(error);
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function presignDownload(key: string, fileName: string): Promise<string> {
  const config = requireConfig();
  return getSignedUrl(
    transferClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(fileName),
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}
