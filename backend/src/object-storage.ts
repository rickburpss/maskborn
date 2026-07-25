import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

type StoredObject = {
  body: Buffer;
  contentType: string;
};

const hasR2 = Boolean(
  config.R2_ACCOUNT_ID
  && config.R2_ACCESS_KEY_ID
  && config.R2_SECRET_ACCESS_KEY
  && config.R2_PRIVATE_BUCKET
  && config.R2_PUBLIC_BUCKET
  && config.R2_PUBLIC_BASE_URL,
);

const client = hasR2
  ? new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID!,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const localRoot = path.resolve(config.STORAGE_LOCAL_DIR);

function safeKey(key: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..")) {
    throw new Error("Unsafe object-storage key.");
  }
  return key;
}

function localPath(scope: "private" | "public", key: string) {
  const resolved = path.resolve(localRoot, scope, safeKey(key));
  const root = path.resolve(localRoot, scope);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Object key escaped its storage root.");
  return resolved;
}

async function putLocal(scope: "private" | "public", key: string, body: Buffer) {
  const target = localPath(scope, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

async function getLocal(scope: "private" | "public", key: string): Promise<Buffer> {
  return readFile(localPath(scope, key));
}

function contentTypeFor(key: string) {
  if (key.endsWith(".json")) return "application/json; charset=utf-8";
  if (key.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

async function put(bucket: string | undefined, scope: "private" | "public", key: string, body: Buffer, contentType: string) {
  safeKey(key);
  if (client && bucket) {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: scope === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
    }));
    return;
  }
  await putLocal(scope, key, body);
}

async function get(bucket: string | undefined, scope: "private" | "public", key: string): Promise<StoredObject> {
  safeKey(key);
  if (client && bucket) {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`Object ${key} had no body.`);
    return {
      body: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? contentTypeFor(key),
    };
  }
  return { body: await getLocal(scope, key), contentType: contentTypeFor(key) };
}

export const objectStorage = {
  provider: hasR2 ? "R2" : "LOCAL",
  putPrivate: (key: string, body: Buffer, contentType: string) =>
    put(config.R2_PRIVATE_BUCKET, "private", key, body, contentType),
  putPublic: (key: string, body: Buffer, contentType: string) =>
    put(config.R2_PUBLIC_BUCKET, "public", key, body, contentType),
  getPrivate: (key: string) => get(config.R2_PRIVATE_BUCKET, "private", key),
  getPublic: (key: string) => get(config.R2_PUBLIC_BUCKET, "public", key),
  publicUrl: (key: string) => hasR2
    ? `${config.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${safeKey(key)}`
    : `${config.BACKEND_PUBLIC_URL.replace(/\/$/, "")}/api/assets/${safeKey(key)}`,
};
