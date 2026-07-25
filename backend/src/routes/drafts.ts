import { Router } from "express";
import { Prisma, SubmissionKind } from "../generated/prisma/client.js";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { requireVerifiedDiscord } from "../middleware/auth.js";
import { asyncRoute } from "../utils.js";

export const draftsRouter = Router();

const draftBody = z.object({
  expectedVersion: z.number().int().positive().optional(),
  kind: z.nativeEnum(SubmissionKind),
  title: z.string().trim().min(1).max(100),
  schemaVersion: z.number().int().positive().default(1),
  generatorVersion: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
  previewAssetUrl: z.string().url().max(2048).optional(),
});

draftsRouter.put("/drafts/:id", requireVerifiedDiscord, asyncRoute(async (req, res) => {
  const body = draftBody.parse(req.body);
  const userId = req.auth!.userId;
  const draftId = req.params.id as string;

  if (draftId === "new") {
    const draft = await db.draft.create({
      data: {
        userId,
        kind: body.kind,
        title: body.title,
        schemaVersion: body.schemaVersion,
        generatorVersion: body.generatorVersion,
        payload: body.payload as Prisma.InputJsonValue,
        previewAssetUrl: body.previewAssetUrl,
        revisions: { create: { version: 1, payload: body.payload as Prisma.InputJsonValue } },
      },
    });
    res.status(201).json({ draft });
    return;
  }

  if (!body.expectedVersion) {
    throw new ApiError(422, "EXPECTED_VERSION_REQUIRED", "Send the version you last loaded.");
  }

  const draft = await db.$transaction(async (tx) => {
    const owned = await tx.draft.findFirst({ where: { id: draftId, userId } });
    if (!owned) throw new ApiError(404, "DRAFT_NOT_FOUND", "That draft was not found.");
    if (owned.version !== body.expectedVersion) {
      throw new ApiError(409, "DRAFT_CONFLICT", "A newer copy of this draft already exists.", {
        currentVersion: owned.version,
        updatedAt: owned.updatedAt,
      });
    }
    const nextVersion = owned.version + 1;
    return tx.draft.update({
      where: { id: owned.id },
      data: {
        kind: body.kind,
        title: body.title,
        schemaVersion: body.schemaVersion,
        generatorVersion: body.generatorVersion,
        payload: body.payload as Prisma.InputJsonValue,
        previewAssetUrl: body.previewAssetUrl,
        version: nextVersion,
        revisions: { create: { version: nextVersion, payload: body.payload as Prisma.InputJsonValue } },
      },
    });
  }, { isolationLevel: "Serializable" });

  res.json({ draft });
}));
