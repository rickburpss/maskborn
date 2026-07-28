# Render deployment setup

Use two Render web services: one rooted at `backend`, and one rooted at `frontend`.
The frontend proxies `/api/*` to the backend so Discord and session cookies remain on
the website origin.

## Backend service

- Root directory: `backend`
- Build command: `npm install && npx prisma generate && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Set the existing Neon, R2, Discord, and pepper secrets, plus:

```env
NODE_ENV=production
FRONTEND_URL=https://YOUR-FRONTEND.onrender.com
BACKEND_PUBLIC_URL=https://YOUR-BACKEND.onrender.com
DISCORD_CALLBACK_URL=https://YOUR-FRONTEND.onrender.com/api/auth/discord/callback
ADMIN_DISCORD_IDS=YOUR_DISCORD_USER_ID
```

Add that exact `DISCORD_CALLBACK_URL` under OAuth2 Redirects in the Discord Developer
Portal. Run `npx prisma db push` from the backend directory once after deploying this
schema update.

## Frontend service

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

Set:

```env
BACKEND_URL=https://YOUR-BACKEND.onrender.com
NEXT_PUBLIC_SITE_URL=https://YOUR-FRONTEND.onrender.com
NEXT_PUBLIC_X_CAMPAIGN_POST_URL=https://x.com/YOUR_ACCOUNT/status/YOUR_POST_ID
```

Do not put the Discord secret, database URL, R2 secret, or peppers in the frontend.
All browser API requests use the website's same-origin `/api` route. Do not set
`NEXT_PUBLIC_API_URL` to Render; doing so bypasses the cookie-preserving proxy.

The branded Discord wake page prevents users from being sent directly to Render's
cold-start screen. It cannot eliminate the free backend's wake time; an always-on paid
instance or an external uptime monitor is required to avoid cold starts completely.
