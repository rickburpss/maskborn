# Discord verification setup

Mask Born Order uses Discord OAuth2 as the required identity gate. Anonymous visitors
can view every public page, but only a profile linked to one unique Discord user ID can
vote, save server drafts, add a wallet, apply, publish, or use admin mutations.

This uses only Discord's `identify` scope. It does not require a bot, a server
installation, guild access, email access, or a paid Discord plan.

## Create the Discord application

1. Open `https://discord.com/developers/applications`.
2. Select **New Application**, name it Mask Born Order, and create it.
3. Open **OAuth2** in the application sidebar.
4. Copy the **Client ID**.
5. Reset/copy the **Client Secret** and keep it private.
6. Under **Redirects**, add the exact callback URLs:
   - Local: `http://localhost:4000/api/auth/discord/callback`
   - Production: `https://YOUR-WEBSITE-DOMAIN/api/auth/discord/callback`
7. Save changes. You do not need to create a bot or configure an installation link.

The redirect URI must match exactly, including scheme, hostname, port, path, and
trailing-slash choice.

## Backend environment

Copy `backend/.env.example` to `backend/.env`, then set:

```env
FRONTEND_URL=http://localhost:3000
DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_CALLBACK_URL=http://localhost:4000/api/auth/discord/callback
```

For production:

```env
FRONTEND_URL=https://YOUR-WEBSITE-DOMAIN
DISCORD_CALLBACK_URL=https://YOUR-WEBSITE-DOMAIN/api/auth/discord/callback
```

The production callback deliberately uses the website domain. Next.js proxies that
path to the backend, so the browser receives the session cookie on the same origin as
the website. A Discord ID already linked to an account signs back into that account;
the user does not have to link it again. Never put the Discord client secret in
frontend variables or commit it.

## Frontend environment

`frontend/.env.local` should point at the backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_X_CAMPAIGN_POST_URL=https://x.com/YOUR_ACCOUNT/status/YOUR_POST_ID
```

On Render, point browser requests at the website and let the server-side rewrite reach
the backend:

```env
NEXT_PUBLIC_API_URL=https://YOUR-WEBSITE-DOMAIN
NEXT_PUBLIC_SITE_URL=https://YOUR-WEBSITE-DOMAIN
BACKEND_URL=https://YOUR-BACKEND-DOMAIN
```

The **Link Discord** button first opens `/connect/discord`. That page keeps the user on
the Mask Born Order design while it wakes a sleeping free Render backend, then opens
Discord automatically. This avoids showing Render's loading screen. A free service can
still take tens of seconds to wake; only an always-on instance removes that delay.

Restart both servers after changing environment values. On the site, open Connect,
paste the X username, press **Link Discord**, approve the single `identify` permission,
and return to the profile. The wallet field and all action controls become available
after Discord is linked.

## Database and testing

Apply the current Prisma schema and start both apps:

```powershell
cd backend
npx prisma db push
npm run dev
```

```powershell
cd frontend
npm run dev
```

Test with two profiles to confirm the same Discord account cannot verify two different
Mask Born Order profiles. Discord errors return to the frontend with a short
`?discord=` reason in the URL.
