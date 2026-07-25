import { Router } from "express";
import { GeneratorCategory, SubmissionKind, SubmissionStatus } from "../generated/prisma/client.js";
import { z } from "zod";
import { db } from "../db.js";
import { ApiError } from "../errors.js";
import { asyncRoute } from "../utils.js";

export const publicRouter = Router();

publicRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "maskborn-api" });
});

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
    include: {
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
  res.json({ items, nextCursor: hasMore ? items.at(-1)?.id : null });
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
  res.json({ item: row, voteClosesAt: new Date(row.publishedAt.getTime() + 24 * 60 * 60 * 1000) });
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
