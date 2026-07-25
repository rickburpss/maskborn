import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute } from "../utils.js";

export const sessionRouter = Router();

sessionRouter.get("/session", requireAuth, asyncRoute(async (req, res) => {
  const user = await db.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: {
      id: true,
      role: true,
      displayName: true,
      avatarUrl: true,
      socialAccounts: {
        where: { provider: { in: ["X_MANUAL", "DISCORD"] } },
        select: { provider: true, username: true, verificationState: true },
      },
      wallets: { orderBy: { isPrimary: "desc" }, select: { id: true, chain: true, address: true, isPrimary: true } },
    },
  });
  res.json({ user });
}));

sessionRouter.get("/profile", requireAuth, asyncRoute(async (req, res) => {
  const userId = req.auth!.userId;
  const [user, submissions, drafts, restrictions] = await db.$transaction([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        wallets: true,
        socialAccounts: { where: { provider: "X_MANUAL" } },
      },
    }),
    db.submission.findMany({
      where: { userId },
      orderBy: { publishedAt: "desc" },
      include: { galleryEntry: { include: { feeShare: true } } },
    }),
    db.draft.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    db.voteRestriction.findMany({
      where: { userId, liftedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
    }),
  ]);

  const consumed = {
    oneOfOne: submissions.filter((item) => item.kind === "ONE_OF_ONE" && !["REJECTED", "WITHDRAWN"].includes(item.status)).length,
    trait: submissions.filter((item) => item.kind === "TRAIT_EXTENSION" && !["REJECTED", "WITHDRAWN"].includes(item.status)).length,
  };
  res.json({ user, submissions, drafts, restrictions, slots: { limit: 2, consumed } });
}));
