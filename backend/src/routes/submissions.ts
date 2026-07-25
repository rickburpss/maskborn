import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { GeneratorCategory, Prisma, SubmissionKind } from "../generated/prisma/client.js";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { requireVerifiedDiscord } from "../middleware/auth.js";
import { objectStorage } from "../object-storage.js";
import { sourcePixelDataSchema } from "../submission-art.js";
import { asyncRoute, requestHash, slugify } from "../utils.js";

export const submissionsRouter = Router();

const submissionBody = z.object({
  kind: z.nativeEnum(SubmissionKind),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(1).max(1200),
  generatorVersion: z.string().min(1).max(100),
  categories: z.array(z.nativeEnum(GeneratorCategory)).min(1).max(8),
  pixelData: sourcePixelDataSchema,
  compatibility: z.record(z.string(), z.unknown()).optional(),
  mediaHash: z.string().regex(/^[a-f0-9]{64}$/i),
  previewAssetUrl: z.string().url().max(150_000).refine(
    (value) => value.startsWith("data:image/svg+xml"),
    "The publish preview must be an SVG data URL.",
  ),
  sourcePostUrl: z.string().url().max(2048).optional(),
});
const communityTraitCategories = new Set<GeneratorCategory>(["BACKGROUND", "EYES", "HATS", "SPECIAL"]);

function decodeSvgDataUrl(value: string) {
  const comma = value.indexOf(",");
  if (comma === -1) throw new ApiError(422, "PREVIEW_INVALID", "The SVG preview could not be decoded.");
  const metadata = value.slice(0, comma);
  const payload = value.slice(comma + 1);
  try {
    return Buffer.from(metadata.includes(";base64") ? payload : decodeURIComponent(payload), metadata.includes(";base64") ? "base64" : "utf8");
  } catch {
    throw new ApiError(422, "PREVIEW_INVALID", "The SVG preview could not be decoded.");
  }
}

submissionsRouter.post("/submissions", requireVerifiedDiscord, asyncRoute(async (req, res) => {
  const body = submissionBody.parse(req.body);
  const userId = req.auth!.userId;
  if (body.kind === "TRAIT_EXTENSION") {
    const unsupported = body.categories.filter((category) => !communityTraitCategories.has(category));
    if (unsupported.length > 0) {
      throw new ApiError(422, "UNSUPPORTED_TRAIT_CATEGORY", "Trait submissions can contain only Background, Eyes, Hats, and Special.");
    }
  }
  const key = req.header("idempotency-key");
  if (!key || key.length > 100) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Send a unique Idempotency-Key when publishing.");
  }
  if (body.kind === "TRAIT_EXTENSION" && !body.compatibility) {
    throw new ApiError(422, "COMPATIBILITY_REQUIRED", "Trait extensions need completed compatibility results.");
  }

  const scope = "publish-submission";
  const hash = requestHash(body);
  const prior = await db.idempotencyRecord.findUnique({ where: { userId_scope_key: { userId, scope, key } } });
  if (prior) {
    if (prior.requestHash !== hash) {
      throw new ApiError(409, "IDEMPOTENCY_MISMATCH", "That key was used for a different submission.");
    }
    res.status(prior.responseCode ?? 201).json(prior.responseBody);
    return;
  }
  const sourceBody = Buffer.from(`${JSON.stringify(body.pixelData, null, 2)}\n`, "utf8");
  const sourceHash = createHash("sha256").update(sourceBody).digest("hex");
  const previewBody = decodeSvgDataUrl(body.previewAssetUrl);
  const calculatedMediaHash = createHash("sha256").update(previewBody).digest("hex");
  if (calculatedMediaHash !== body.mediaHash.toLowerCase()) {
    throw new ApiError(422, "MEDIA_HASH_MISMATCH", "The preview hash does not match the uploaded artwork.");
  }
  const pixelDataKey = `submissions/${userId}/${sourceHash}/source.json`;
  const previewAssetKey = `submissions/${userId}/${calculatedMediaHash}/preview.svg`;

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const categories = [...new Set(body.categories)];

    if (body.kind === "ONE_OF_ONE") {
      const oneOfOneCount = await tx.submission.count({ where: { userId, kind: "ONE_OF_ONE" } });
      if (oneOfOneCount >= 2) {
        throw new ApiError(409, "SUBMISSION_LIMIT_REACHED", "Both lifetime 1/1 submission slots are already used.");
      }
    } else {
      const priorTraitSubmissions = await tx.submission.findMany({
        where: { userId, kind: "TRAIT_EXTENSION", categories: { hasSome: categories } },
        select: { categories: true },
      });
      const previouslySubmitted = new Set(priorTraitSubmissions.flatMap((submission) => submission.categories));
      const repeatedCategories = categories.filter((category) => previouslySubmitted.has(category));
      if (repeatedCategories.length > 0) {
        throw new ApiError(
          409,
          "TRAIT_CATEGORY_ALREADY_SUBMITTED",
          `You have already submitted: ${repeatedCategories.map((category) => category.toLowerCase()).join(", ")}.`,
          { categories: repeatedCategories },
        );
      }
    }

    const restriction = await tx.voteRestriction.findFirst({
      where: { userId, type: { in: ["SUBMISSION", "ACCOUNT"] }, liftedAt: null, expiresAt: { gt: new Date() } },
    });
    if (restriction) {
      throw new ApiError(429, "SUBMISSION_RESTRICTED", "Publishing is temporarily paused.", { expiresAt: restriction.expiresAt });
    }

    await Promise.all([
      objectStorage.putPrivate(pixelDataKey, sourceBody, "application/json; charset=utf-8"),
      objectStorage.putPublic(previewAssetKey, previewBody, "image/svg+xml; charset=utf-8"),
    ]);
    const previewAssetUrl = objectStorage.publicUrl(previewAssetKey);
    const slug = `${slugify(body.title)}-${randomBytes(3).toString("hex")}`;
    const submission = await tx.submission.create({
      data: {
        userId,
        slug,
        kind: body.kind,
        title: body.title,
        description: body.description,
        generatorVersion: body.generatorVersion,
        categories,
        pixelData: {
          schemaVersion: body.pixelData.schemaVersion ?? 1,
          objectKey: pixelDataKey,
          sha256: sourceHash,
          byteLength: sourceBody.byteLength,
        } as Prisma.InputJsonValue,
        pixelDataKey,
        sourceHash,
        compatibility: body.compatibility as Prisma.InputJsonValue | undefined,
        mediaHash: calculatedMediaHash,
        previewAssetUrl,
        previewAssetKey,
        storageProvider: objectStorage.provider,
        sourcePostUrl: body.sourcePostUrl,
        statusEvents: { create: { toStatus: "PENDING", actorId: userId, note: "Published by creator" } },
      },
    });
    const response = { submission };
    await tx.idempotencyRecord.create({
      data: {
        userId, scope, key, requestHash: hash, responseCode: 201,
        responseBody: response, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return response;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  res.status(201).json(result);
}));
