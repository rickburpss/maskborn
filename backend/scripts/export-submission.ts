import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db.js";
import { objectStorage } from "../src/object-storage.js";
import { canonicalizePixelData, jsonBuffer, sha256, sourcePixelDataSchema } from "../src/submission-art.js";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const identifier = process.argv.slice(2).find((value) => !value.startsWith("--") && value !== argument("--out"));
const outputRoot = path.resolve(argument("--out") ?? path.join("exports", "accepted"));

if (!identifier) {
  console.error("Usage: npm run export:submission -- <submission-id-or-slug> [--out path]");
  process.exitCode = 1;
  await db.$disconnect();
} else {
  try {
    const submission = await db.submission.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
      include: {
        user: {
          select: {
            id: true,
            wallets: { where: { isPrimary: true }, select: { address: true }, take: 1 },
          },
        },
      },
    });
    if (!submission) throw new Error(`Submission "${identifier}" was not found.`);
    if (!["ACCEPTED", "GALLERY_ADDED"].includes(submission.status)) {
      throw new Error(`Submission "${submission.slug}" is ${submission.status}; accept it before exporting.`);
    }

    let source: unknown = submission.pixelData;
    let sourceBytes = jsonBuffer(source);
    if (submission.pixelDataKey) {
      const stored = await objectStorage.getPrivate(submission.pixelDataKey);
      sourceBytes = Buffer.from(stored.body);
      if (submission.sourceHash && sha256(sourceBytes) !== submission.sourceHash) {
        throw new Error("Stored source JSON failed its SHA-256 integrity check.");
      }
      source = JSON.parse(sourceBytes.toString("utf8")) as unknown;
    }

    const parsed = sourcePixelDataSchema.parse(source);
    const artwork = canonicalizePixelData(parsed);
    const canonical = {
      ...artwork,
      submission: {
        id: submission.id,
        slug: submission.slug,
        title: submission.title,
        kind: submission.kind,
        categories: submission.categories,
        generatorVersion: submission.generatorVersion,
      },
      creator: {
        userId: submission.user.id,
        wallet: submission.user.wallets[0]?.address ?? null,
      },
    };
    const canonicalBytes = jsonBuffer(canonical);
    const canonicalHash = sha256(canonicalBytes);
    const canonicalDataKey = `accepted/${submission.id}/${canonicalHash}/canonical.json`;
    await objectStorage.putPrivate(canonicalDataKey, canonicalBytes, "application/json; charset=utf-8");

    await mkdir(outputRoot, { recursive: true });
    const baseName = submission.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const sourcePath = path.join(outputRoot, `${baseName}.source.json`);
    const canonicalPath = path.join(outputRoot, `${baseName}.canonical.json`);
    const modulePath = path.join(outputRoot, `${baseName}.mjs`);
    const moduleSource = [
      `// Generated from accepted Mask Born Order submission ${submission.id}.`,
      `// Canonical SHA-256: ${canonicalHash}`,
      `export const acceptedSubmission = Object.freeze(${JSON.stringify(canonical, null, 2)});`,
      "export default acceptedSubmission;",
      "",
    ].join("\n");

    await Promise.all([
      writeFile(sourcePath, sourceBytes),
      writeFile(canonicalPath, canonicalBytes),
      writeFile(modulePath, moduleSource, "utf8"),
      db.submission.update({
        where: { id: submission.id },
        data: { canonicalDataKey, canonicalHash },
      }),
    ]);

    console.log(`Exported ${submission.slug}`);
    console.log(`Source:    ${sourcePath}`);
    console.log(`Canonical: ${canonicalPath}`);
    console.log(`Module:    ${modulePath}`);
    console.log(`SHA-256:   ${canonicalHash}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
