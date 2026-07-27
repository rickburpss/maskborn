import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { adminDiscordIds, config } from "../config.js";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute } from "../utils.js";

export const authRouter = Router();

const sessionHash = (value: string) =>
  createHash("sha256").update(`${config.SESSION_PEPPER}:${value}`).digest("hex");
const sessionLifetimeMs = 365 * 24 * 60 * 60 * 1000;
const cookieSecurity = {
  secure: config.NODE_ENV === "production",
  sameSite: config.NODE_ENV === "production" ? "none" as const : "lax" as const,
};

const setSessionCookie = (res: Response, token: string) => {
  res.cookie("mbo_session", token, {
    httpOnly: true,
    ...cookieSecurity,
    maxAge: sessionLifetimeMs,
  });
};

const usernameBody = z.object({
  username: z.string()
    .trim()
    .transform((value) => value.replace(/^@/, "").toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9_]{1,15}$/, "Enter a valid X username.")),
});

authRouter.post("/auth/username", asyncRoute(async (req, res) => {
  const { username } = usernameBody.parse(req.body);
  const user = await db.$transaction(async (tx) => {
    if (req.auth) {
      const existing = await tx.socialAccount.findFirst({
        where: { userId: req.auth.userId, provider: "X_MANUAL" },
      });
      if (existing) {
        await tx.socialAccount.update({
          where: { id: existing.id },
          data: { username },
        });
      } else {
        await tx.socialAccount.create({
          data: {
            userId: req.auth.userId,
            provider: "X_MANUAL",
            providerAccountId: `manual:${randomUUID()}`,
            username,
            verificationState: "UNVERIFIED",
          },
        });
      }
      return tx.user.update({
        where: { id: req.auth.userId },
        data: { displayName: `@${username}` },
      });
    }

    return tx.user.create({
      data: {
        displayName: `@${username}`,
        socialAccounts: {
          create: {
            provider: "X_MANUAL",
            providerAccountId: `manual:${randomUUID()}`,
            username,
            verificationState: "UNVERIFIED",
          },
        },
      },
    });
  });

  const sessionToken = randomBytes(32).toString("base64url");
  if (req.auth) {
    await db.session.deleteMany({ where: { userId: req.auth.userId } });
  }
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sessionHash(sessionToken),
      expiresAt: new Date(Date.now() + sessionLifetimeMs),
    },
  });
  setSessionCookie(res, sessionToken);
  res.status(201).json({
    user: { id: user.id, username, verificationState: "UNVERIFIED" },
  });
}));

authRouter.get("/auth/discord/start", asyncRoute(async (_req, res) => {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET || !config.DISCORD_CALLBACK_URL) {
    res.redirect(`${config.FRONTEND_URL}/?discord=not-configured`);
    return;
  }
  const state = randomBytes(24).toString("base64url");
  res.cookie("mbo_discord_state", state, {
    httpOnly: true,
    ...cookieSecurity,
    maxAge: 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.DISCORD_CLIENT_ID,
    scope: "identify",
    state,
    redirect_uri: config.DISCORD_CALLBACK_URL,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
}));

authRouter.get("/auth/discord/callback", asyncRoute(async (req, res) => {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET || !config.DISCORD_CALLBACK_URL) {
    res.redirect(`${config.FRONTEND_URL}/?discord=not-configured`);
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state || state !== req.cookies?.mbo_discord_state) {
    res.redirect(`${config.FRONTEND_URL}/?discord=invalid-state`);
    return;
  }

  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.DISCORD_CALLBACK_URL,
    }),
  });
  if (!tokenResponse.ok) {
    res.redirect(`${config.FRONTEND_URL}/?discord=token-failed`);
    return;
  }
  const tokens = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    res.redirect(`${config.FRONTEND_URL}/?discord=profile-failed`);
    return;
  }
  const profile = await profileResponse.json() as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
    bot?: boolean;
  };
  if (profile.bot) {
    res.redirect(`${config.FRONTEND_URL}/?discord=bot-account`);
    return;
  }

  const linked = await db.socialAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "DISCORD",
        providerAccountId: profile.id,
      },
    },
  });
  const currentAuth = req.auth;
  if (!linked && !currentAuth) {
    res.redirect(`${config.FRONTEND_URL}/?discord=create-profile-first`);
    return;
  }
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith("a_") ? "gif" : "png"}`
    : null;
  const role = adminDiscordIds.has(profile.id) ? "ADMIN" as const : undefined;
  const userId = await db.$transaction(async (tx) => {
    if (linked) {
      await tx.socialAccount.update({
        where: { id: linked.id },
        data: { username: profile.username, verificationState: "VERIFIED" },
      });
      await tx.user.update({
        where: { id: linked.userId },
        data: { avatarUrl, role },
      });
      return linked.userId;
    }
    if (currentAuth) {
      await tx.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "DISCORD",
            providerAccountId: profile.id,
          },
        },
        create: {
          userId: currentAuth.userId,
          provider: "DISCORD",
          providerAccountId: profile.id,
          username: profile.username,
          verificationState: "VERIFIED",
        },
        update: {
          username: profile.username,
          verificationState: "VERIFIED",
        },
      });
      await tx.user.update({
        where: { id: currentAuth.userId },
        data: { avatarUrl, role },
      });
      return currentAuth.userId;
    }
    throw new Error("Discord authentication reached an invalid account state.");
  });

  const sessionToken = randomBytes(32).toString("base64url");
  await db.session.deleteMany({ where: { userId } });
  await db.session.create({
    data: {
      userId,
      tokenHash: sessionHash(sessionToken),
      expiresAt: new Date(Date.now() + sessionLifetimeMs),
    },
  });
  res.clearCookie("mbo_discord_state", cookieSecurity);
  setSessionCookie(res, sessionToken);
  res.redirect(`${config.FRONTEND_URL}/profile?discord=linked`);
}));

authRouter.post("/auth/disconnect", requireAuth, asyncRoute(async (req, res) => {
  const token = req.cookies?.mbo_session;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sessionHash(token) } });
  }
  res.clearCookie("mbo_session", cookieSecurity);
  res.status(204).end();
}));
