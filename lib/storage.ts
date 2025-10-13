import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";

let cachedClient: S3Client | null = null;

function hasS3Config() {
  return (
    Boolean(process.env.S3_BUCKET) &&
    Boolean(process.env.S3_ACCESS_KEY) &&
    Boolean(process.env.S3_SECRET_KEY)
  );
}

function getClient() {
  if (cachedClient) return cachedClient;

  if (!hasS3Config()) {
    throw new Error("S3 configuration is missing");
  }

  cachedClient = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });

  return cachedClient;
}

export async function createSignedUploadUrl({
  key,
  contentType,
  expiresIn,
}: {
  key: string;
  contentType: string;
  expiresIn: number;
}) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    const baseUrl = process.env.S3_FAKE_PUT_URL ?? "http://localhost:9000";
    return `${baseUrl}/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

export async function createSignedDownloadUrl({
  key,
  expiresIn,
}: {
  key: string;
  expiresIn: number;
}) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    const baseUrl = process.env.S3_FAKE_GET_URL ?? "http://localhost:9000";
    return `${baseUrl}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

async function collectBody(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
      );
    }
    return Buffer.concat(chunks);
  }

  const readableCandidate = body as {
    getReader?: () => {
      read: () => Promise<{ done?: boolean; value?: Uint8Array | undefined }>;
    };
  };

  if (typeof readableCandidate?.getReader === "function") {
    const reader = readableCandidate.getReader();
    const parts: Buffer[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = Boolean(result.done);
      if (result.value) {
        parts.push(Buffer.from(result.value));
      }
    }
    return Buffer.concat(parts);
  }

  return Buffer.alloc(0);
}

export async function readObjectChunk({
  key,
  length = 8192,
}: {
  key: string;
  length?: number;
}) {
  if (length <= 0) return Buffer.alloc(0);

  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    const baseUrl = process.env.S3_FAKE_GET_URL ?? "http://localhost:9000";
    const response = await fetch(`${baseUrl}/${key}`, {
      headers: {
        Range: `bytes=0-${Math.max(0, length - 1)}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to read object from storage");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: `bytes=0-${Math.max(0, length - 1)}`,
  });
  const result = await getClient().send(command);
  return collectBody(result.Body);
}

export async function deleteObject({ key }: { key: string }) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await getClient().send(command);
}

export async function moveObject({
  sourceKey,
  destinationKey,
}: {
  sourceKey: string;
  destinationKey: string;
}) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    return false;
  }

  const normalizedSource = encodeURIComponent(sourceKey).replace(/%2F/g, "/");
  const copyCommand = new CopyObjectCommand({
    Bucket: bucket,
    Key: destinationKey,
    CopySource: `${bucket}/${normalizedSource}`,
  });

  const client = getClient();

  await client.send(copyCommand);
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    }),
  );

  return true;
}

async function getObjectBuffer(key: string): Promise<Buffer> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !hasS3Config()) {
    const baseUrl = process.env.S3_FAKE_GET_URL ?? "http://localhost:9000";
    const response = await fetch(`${baseUrl}/${key}`);
    if (!response.ok) {
      throw new Error("Failed to read object from storage");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const result = await getClient().send(command);
  return collectBody(result.Body);
}

export async function calculateObjectHash({ key }: { key: string }) {
  const buffer = await getObjectBuffer(key);
  return createHash("sha256").update(buffer).digest("hex");
}
