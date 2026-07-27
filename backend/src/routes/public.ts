import { Router } from "express";
import { GeneratorCategory, SubmissionKind, SubmissionStatus } from "../generated/prisma/client.js";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { objectStorage } from "../object-storage.js";
import { asyncRoute } from "../utils.js";

export const publicRouter = Router();

async function attachVoteBreakdown<T extends { id: string }>(items: T[], userId?: string) {
  if (items.length === 0) return [];
  const ids = items.map((item) => item.id);
  const [groups, viewerVotes] = await Promise.all([
    db.vote.groupBy({
      by: ["submissionId", "category", "value"],
      where: { submissionId: { in: ids }, category: { not: null } },
      _count: { _all: true },
    }),
    userId
      ? db.vote.findMany({
        where: { submissionId: { in: ids }, userId },
        select: { submissionId: true, value: true, category: true },
      })
      : Promise.resolve([]),
  ]);
  const breakdown = new Map<string, Map<string, { category: string; upvotes: number; downvotes: number }>>();
  for (const group of groups) {
    if (!group.category) continue;
    const submission = breakdown.get(group.submissionId) ?? new Map();
    const totals = submission.get(group.category) ?? { category: group.category, upvotes: 0, downvotes: 0 };
    if (group.value === "UP") totals.upvotes = group._count._all;
    else totals.downvotes = group._count._all;
    submission.set(group.category, totals);
    breakdown.set(group.submissionId, submission);
  }
  const ownVotes = new Map(viewerVotes.map((vote) => [vote.submissionId, {
    value: vote.value,
    category: vote.category,
  }]));
  return items.map((item) => ({
    ...item,
    traitVotes: [...(breakdown.get(item.id)?.values() ?? [])],
    viewerVote: ownVotes.get(item.id) ?? null,
  }));
}

publicRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "maskborn-api" });
});

publicRouter.get(/^\/assets\/(.+)$/, asyncRoute(async (req, res) => {
  const key = decodeURIComponent(req.path.slice("/assets/".length));
  try {
    const asset = await objectStorage.getPublic(key);
    res.setHeader("content-type", asset.contentType);
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    res.send(asset.body);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "NoSuchKey") {
      throw new ApiError(404, "ASSET_NOT_FOUND", "That artwork asset was not found.");
    }
    throw error;
  }
}));

const feedQuery = z.object({
  sort: z.enum(["newest", "oldest", "up", "down", "least"]).default("newest"),
  kind: z.nativeEnum(SubmissionKind).optional(),
  category: z.nativeEnum(GeneratorCategory).optional(),
  status: z.nativeEnum(SubmissionStatus).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

publicRouter.get("/submissions", asyncRoute(async (req, res) => {
  const query = feedQuery.parse(req.query);
  const orderBy = query.sort === "oldest"
    ? { publishedAt: "asc" as const }
    : query.sort === "up"
      ? { upvoteCount: "desc" as const }
      : query.sort === "down"
        ? { downvoteCount: "desc" as const }
        : query.sort === "least"
          ? [{ upvoteCount: "asc" as const }, { downvoteCount: "asc" as const }]
          : { publishedAt: "desc" as const };

  const rows = await db.submission.findMany({
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    where: {
      kind: query.kind,
      status: query.status ?? { notIn: ["REJECTED", "WITHDRAWN"] },
      categories: query.category ? { has: query.category } : undefined,
    },
    orderBy,
    select: {
      id: true,
      slug: true,
      kind: true,
      title: true,
      description: true,
      categories: true,
      previewAssetUrl: true,
      previewVariants: true,
      status: true,
      publishedAt: true,
      upvoteCount: true,
      downvoteCount: true,
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          socialAccounts: { where: { provider: "X_MANUAL" }, select: { username: true }, take: 1 },
        },
      },
      galleryEntry: { select: { id: true, kind: true, publicationState: true } },
    },
  });
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const enriched = await attachVoteBreakdown(items, req.auth?.userId);
  res.json({ items: enriched, nextCursor: hasMore ? items.at(-1)?.id : null });
}));

publicRouter.get("/submissions/:slug", asyncRoute(async (req, res) => {
  const slug = req.params.slug as string;
  const row = await db.submission.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true, socialAccounts: { where: { provider: "X_MANUAL" } } } },
      statusEvents: { orderBy: { createdAt: "asc" } },
      galleryEntry: { include: { feeShare: true } },
    },
  });
  if (!row || ["REJECTED", "WITHDRAWN"].includes(row.status)) {
    throw new ApiError(404, "SUBMISSION_NOT_FOUND", "That artwork was not found.");
  }
  const [item] = await attachVoteBreakdown([row], req.auth?.userId);
  res.json({ item, voteClosesAt: new Date(row.publishedAt.getTime() + 24 * 60 * 60 * 1000) });
}));

publicRouter.get("/gallery", asyncRoute(async (req, res) => {
  const entries = await db.galleryEntry.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: "asc" }, { addedAt: "desc" }],
    include: {
      submission: {
        include: {
          user: { select: { displayName: true, socialAccounts: { where: { provider: "X_MANUAL" }, take: 1 } } },
        },
      },
    },
  });
  res.json({ items: entries });
}));
