import { Router } from "express";
import { GalleryEntryKind, GeneratorCategory, PublicationState } from "../generated/prisma/client.js";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { requireAdmin, requireVerifiedDiscord } from "../middleware/auth.js";
import { asyncRoute } from "../utils.js";

export const adminRouter = Router();
adminRouter.use(requireVerifiedDiscord, requireAdmin);

adminRouter.get("/review-queue", asyncRoute(async (_req, res) => {
  const items = await db.submission.findMany({
    where: { status: { in: ["PENDING", "REVIEWING"] } },
    orderBy: { publishedAt: "asc" },
    include: {
      user: { select: { id: true, displayName: true, socialAccounts: { where: { provider: "X" }, take: 1 } } },
    },
  });
  res.json({ items });
}));

const reviewBody = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "REVIEWING"]),
  note: z.string().trim().min(2).max(1000),
});

adminRouter.put("/submissions/:id/review", asyncRoute(async (req, res) => {
  const body = reviewBody.parse(req.body);
  const submissionId = req.params.id as string;
  const result = await db.$transaction(async (tx) => {
    const current = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!current) throw new ApiError(404, "SUBMISSION_NOT_FOUND", "That submission was not found.");
    if (["GALLERY_ADDED", "WITHDRAWN"].includes(current.status)) {
      throw new ApiError(409, "SUBMISSION_STATE_INVALID", `A ${current.status.toLowerCase()} submission cannot be reviewed.`);
    }
    const updated = await tx.submission.update({ where: { id: current.id }, data: { status: body.decision } });
    await tx.submissionStatusEvent.create({
      data: {
        submissionId: current.id,
        actorId: req.auth!.userId,
        fromStatus: current.status,
        toStatus: body.decision,
        note: body.note,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: "SUBMISSION_REVIEWED",
        targetType: "Submission",
        targetId: current.id,
        before: { status: current.status },
        after: { status: body.decision },
        reason: body.note,
        requestId: req.id,
      },
    });
    return updated;
  });
  res.json({ submission: result });
}));

const promoteBody = z.object({
  kind: z.nativeEnum(GalleryEntryKind),
  publicationState: z.nativeEnum(PublicationState).default("GALLERY_ONLY"),
  categories: z.array(z.nativeEnum(GeneratorCategory)).min(1).max(8),
  displayOrder: z.number().int().default(0),
  reason: z.string().trim().min(2).max(1000),
  onchain: z.object({
    chainId: z.number().int().positive(),
    contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tokenId: z.string().regex(/^\d+$/),
    metadataUri: z.string().url().optional(),
  }).optional(),
  feeShare: z.object({
    walletId: z.string().cuid(),
    basisPoints: z.number().int().min(1).max(10_000),
  }).optional(),
}).superRefine((value, ctx) => {
  if (value.publicationState === "ONCHAIN_EXTENSION" && !value.onchain) {
    ctx.addIssue({ code: "custom", message: "Onchain publication data is required.", path: ["onchain"] });
  }
  if (value.feeShare && value.kind !== "ONE_OF_ONE") {
    ctx.addIssue({ code: "custom", message: "Creator fee shares currently apply only to 1/1s.", path: ["feeShare"] });
  }
  if (value.feeShare && value.publicationState !== "ONCHAIN_EXTENSION") {
    ctx.addIssue({ code: "custom", message: "A gallery-only item cannot accrue onchain fees.", path: ["feeShare"] });
  }
});

adminRouter.post("/submissions/:id/promote", asyncRoute(async (req, res) => {
  const body = promoteBody.parse(req.body);
  const submissionId = req.params.id as string;
  const entry = await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new ApiError(404, "SUBMISSION_NOT_FOUND", "That submission was not found.");
    if (submission.status !== "ACCEPTED") {
      throw new ApiError(409, "SUBMISSION_NOT_ACCEPTED", "Accept the submission before adding it to the gallery.");
    }
    if (body.feeShare) {
      const wallet = await tx.wallet.findFirst({ where: { id: body.feeShare.walletId, userId: submission.userId } });
      if (!wallet) throw new ApiError(422, "CREATOR_WALLET_INVALID", "The fee-share wallet must belong to the creator.");
    }

    const created = await tx.galleryEntry.create({
      data: {
        submissionId: submission.id,
        kind: body.kind,
        publicationState: body.publicationState,
        categories: [...new Set(body.categories)],
        displayOrder: body.displayOrder,
        tokenChainId: body.onchain?.chainId,
        tokenContract: body.onchain?.contract.toLowerCase(),
        tokenId: body.onchain?.tokenId,
        metadataUri: body.onchain?.metadataUri,
        feeShare: body.feeShare ? {
          create: { walletId: body.feeShare.walletId, basisPoints: body.feeShare.basisPoints },
        } : undefined,
      },
      include: { feeShare: true },
    });
    await tx.submission.update({ where: { id: submission.id }, data: { status: "GALLERY_ADDED" } });
    await tx.submissionStatusEvent.create({
      data: {
        submissionId: submission.id,
        actorId: req.auth!.userId,
        fromStatus: submission.status,
        toStatus: "GALLERY_ADDED",
        note: body.reason,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: "GALLERY_ENTRY_CREATED",
        targetType: "GalleryEntry",
        targetId: created.id,
        before: { submissionStatus: submission.status },
        after: {
          submissionStatus: "GALLERY_ADDED",
          publicationState: created.publicationState,
          tokenContract: created.tokenContract,
          tokenId: created.tokenId,
          feeShareBasisPoints: created.feeShare?.basisPoints,
        },
        reason: body.reason,
        requestId: req.id,
      },
    });
    return created;
  });
  res.status(201).json({ entry });
}));

const liftBody = z.object({ reason: z.string().trim().min(2).max(500) });
adminRouter.post("/restrictions/:id/lift", asyncRoute(async (req, res) => {
  const body = liftBody.parse(req.body);
  const restrictionId = req.params.id as string;
  const result = await db.$transaction(async (tx) => {
    const restriction = await tx.voteRestriction.findUnique({ where: { id: restrictionId } });
    if (!restriction) throw new ApiError(404, "RESTRICTION_NOT_FOUND", "That restriction was not found.");
    const updated = await tx.voteRestriction.update({
      where: { id: restriction.id },
      data: { liftedAt: new Date(), note: body.reason },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: "RESTRICTION_LIFTED",
        targetType: "VoteRestriction",
        targetId: restriction.id,
        before: { liftedAt: restriction.liftedAt, expiresAt: restriction.expiresAt },
        after: { liftedAt: updated.liftedAt },
        reason: body.reason,
        requestId: req.id,
      },
    });
    return updated;
  });
  res.json({ restriction: result });
}));
