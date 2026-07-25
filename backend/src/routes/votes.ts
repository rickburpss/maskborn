import { Router } from "express";
import { Prisma, VoteValue } from "../generated/prisma/client.js";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { requireVerifiedDiscord } from "../middleware/auth.js";
import { asyncRoute, requestHash, signalHash } from "../utils.js";

export const votesRouter = Router();
const voteBody = z.object({ value: z.nativeEnum(VoteValue).nullable() });
const SIX_HOURS = 6 * 60 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

votesRouter.put("/submissions/:id/vote", requireVerifiedDiscord, asyncRoute(async (req, res) => {
  const body = voteBody.parse(req.body);
  const userId = req.auth!.userId;
  const submissionId = req.params.id as string;
  const idempotencyKey = req.header("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 100) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Send a unique Idempotency-Key for this vote.");
  }

  const signal = signalHash(req.ip, req.header("user-agent"));
  const now = new Date();
  const scope = `vote:${submissionId}`;
  const payloadHash = requestHash(body);

  const previous = await db.idempotencyRecord.findUnique({
    where: { userId_scope_key: { userId, scope, key: idempotencyKey } },
  });
  if (previous) {
    if (previous.requestHash !== payloadHash) {
      throw new ApiError(409, "IDEMPOTENCY_MISMATCH", "That idempotency key was already used for a different vote.");
    }
    res.status(previous.responseCode ?? 200).json(previous.responseBody);
    return;
  }

  const activeRestriction = await db.voteRestriction.findFirst({
    where: { userId, type: "VOTE", liftedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });
  if (activeRestriction) {
    throw new ApiError(429, "VOTE_RESTRICTED", "Voting is temporarily paused for this account.", {
      expiresAt: activeRestriction.expiresAt,
    });
  }

  const recentCount = await db.voteEvent.count({
    where: {
      OR: [{ userId }, { signalHash: signal }],
      createdAt: { gt: new Date(now.getTime() - FIVE_MINUTES) },
    },
  });
  if (recentCount >= 20) {
    const expiresAt = new Date(now.getTime() + SIX_HOURS);
    await db.$transaction([
      db.riskEvent.create({
        data: { userId, signalHash: signal, eventType: "VOTE_BURST", score: 100, metadata: { recentCount } },
      }),
      db.voteRestriction.create({
        data: { userId, type: "VOTE", reasonCode: "AUTOMATED_BURST", expiresAt },
      }),
    ]);
    throw new ApiError(429, "VOTE_RESTRICTED", "Voting is paused for six hours after an unusual burst.", { expiresAt });
  }

  const result = await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, publishedAt: true, upvoteCount: true, downvoteCount: true, status: true },
    });
    if (!submission || ["REJECTED", "WITHDRAWN"].includes(submission.status)) {
      throw new ApiError(404, "SUBMISSION_NOT_FOUND", "That artwork was not found.");
    }
    const closesAt = new Date(submission.publishedAt.getTime() + 24 * 60 * 60 * 1000);
    if (now >= closesAt) {
      throw new ApiError(409, "VOTE_FROZEN", "This artwork's 24-hour voting window has closed.", { closesAt });
    }

    const existing = await tx.vote.findUnique({
      where: { submissionId_userId: { submissionId: submission.id, userId } },
    });
    const fromValue = existing?.value ?? null;
    if (fromValue === body.value) {
      const response = {
        vote: fromValue,
        upvotes: submission.upvoteCount,
        downvotes: submission.downvoteCount,
        closesAt,
      };
      await tx.idempotencyRecord.create({
        data: {
          userId, scope, key: idempotencyKey, requestHash: payloadHash,
          responseCode: 200, responseBody: response,
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        },
      });
      return response;
    }

    let upDelta = 0;
    let downDelta = 0;
    if (fromValue === "UP") upDelta -= 1;
    if (fromValue === "DOWN") downDelta -= 1;
    if (body.value === "UP") upDelta += 1;
    if (body.value === "DOWN") downDelta += 1;

    if (body.value === null && existing) {
      await tx.vote.delete({ where: { id: existing.id } });
    } else if (body.value !== null) {
      await tx.vote.upsert({
        where: { submissionId_userId: { submissionId: submission.id, userId } },
        create: { submissionId: submission.id, userId, value: body.value },
        update: { value: body.value },
      });
    }

    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: {
        upvoteCount: { increment: upDelta },
        downvoteCount: { increment: downDelta },
      },
      select: { upvoteCount: true, downvoteCount: true },
    });
    await tx.voteEvent.create({
      data: {
        submissionId: submission.id,
        userId,
        fromValue,
        toValue: body.value,
        signalHash: signal,
        requestId: req.id,
      },
    });
    const response = { vote: body.value, upvotes: updated.upvoteCount, downvotes: updated.downvoteCount, closesAt };
    await tx.idempotencyRecord.create({
      data: {
        userId, scope, key: idempotencyKey, requestHash: payloadHash,
        responseCode: 200, responseBody: response,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      },
    });
    return response;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  res.json(result);
}));
