# Memory Log
> Append-only. Never delete or edit previous entries.
> Initialized: 2026-07-25

---
## 2026-07-25 — Generator integration and full-stack foundation

- Studied `C:\Users\Hp\Desktop\arcOne\generator` and treated its scripts, assets, validators, and contract manifest as the collection source of truth.
- Confirmed a 32×32 canvas, 10,000 origin supply, 19 baked legends, 9,981 rolled tokens, and 210 traits across Background, Fur, Eyes, Ears, Tails, Masks, Hats, and Special.
- Documented and ported the generator's exact render order, symbolic fur palette behavior, hat/ear compatibility rules, and validation constraints.
- Revised `PLAN.md` to distinguish the sealed origin collection from community gallery entries and a future onchain extension. Creator trading-fee shares require a separate extension contract or marketplace fee router.
- Added `scripts/sync-collection.py` to validate and sync generator metadata plus real SVG previews into the frontend without modifying `arcOne`.
- Built the Next.js frontend routes and interactions, including the adaptive header, account modal, origin carousel, community voting/feed, application builder, draw studio with persisted drafts, gallery, profile, collection lookup, and admin review views.
- Added a TypeScript renderer verified pixel-for-pixel against 16 Python generator fixtures.
- Built the Express/Prisma backend foundation with X OAuth PKCE, pasted-wallet profiles, idempotent applications, versioned drafts, two-slot submission limits, 24-hour vote locking, abuse restrictions, moderation/audit history, gallery promotion, and fee accounting.
- Verification passed: frontend lint, type check, 16 renderer tests, and production build; backend Prisma validation, type check, 2 API tests, and production build.
- Live Neon migrations and X OAuth cannot be exercised until deployment credentials are provided.

## 2026-07-25 — Prisma 7 and Neon configuration

- Upgraded the backend from Prisma 6.19 to Prisma 7.9 and added the official Neon driver adapter.
- Moved the Prisma CLI connection URL out of `schema.prisma` into root-level `backend/prisma.config.ts`.
- Runtime uses Neon’s pooled `DATABASE_URL`; migrations and other CLI operations use `DATABASE_URL_UNPOOLED`.
- Switched to the Prisma 7 `prisma-client` generator with output under `backend/src/generated/prisma`.
- Removed an exposed Neon credential from `.env.example` and replaced it with safe placeholders; the exposed credential should be rotated in Neon.
- Prisma generation and validation, TypeScript checks, API tests, and the production backend build all pass.

## 2026-07-25 — X API implementation audit

- Audited the X integration against the current official X OAuth, REST API, pricing, and hosted MCP documentation.
- Confirmed `https://api.x.com/mcp` is developer/AI tooling and must not replace per-visitor OAuth in the public website.
- Added the missing `like.read` scope, token refresh support, dedicated token-encryption configuration, X token revocation, and removal of the linked social account on disconnect.
- Implemented application verification using the applicant's X user token: quote ownership/target, recent liked posts, and recent timeline repost/reply references.
- Added strict X status URL parsing and a unique `quotePostId` to prevent the same quote from being submitted through URL variants.
- Added campaign environment variables, a real frontend campaign link, and `docs/X_SETUP.md` with Developer Console and optional MCP setup.

## 2026-07-25 — Replaced paid X integration with pasted usernames

- Removed X OAuth, X REST API activity verification, token storage/refresh/revocation, and all X credential environment variables.
- The connect modal now accepts a pasted X username and creates an unverified 30-day browser session.
- Manual X identities use the `X_MANUAL` provider and are explicitly shown as unverified attribution.
- Like, repost, reply, and quote ownership states remain `PENDING_MANUAL` for admin review.
- Strict quote-post URL validation and duplicate quote-post protection remain in place.
- Updated the plan, README, frontend campaign configuration, profile data source, and `docs/X_SETUP.md` for the no-cost manual flow.

## 2026-07-25 — Discord verification gate

- Added free Discord OAuth2 account linking with the minimal `identify` scope; no bot, guild access, or server installation is required.
- A stable Discord user ID can be linked to only one Mask Born Order profile and is stored as a verified `DISCORD` social identity.
- Added `requireVerifiedDiscord` to wallet changes, applications, votes, server draft saves, submissions, and every admin mutation.
- Anonymous and unverified visitors retain read-only access to public pages and feeds.
- Updated the connect modal to show X attribution, Discord verification, then wallet as three distinct steps.
- Added Discord recovery: a returning user can sign in through the same Discord account and recover the existing profile session.
- Added `docs/DISCORD_SETUP.md` and Discord environment placeholders.

## 2026-07-25 — Discord callback and server-secret notes

- Confirmed the local backend generates the Discord OAuth callback
  `http://localhost:4000/api/auth/discord/callback`.
- An `Invalid OAuth2 redirect URL` response means that exact URL is not saved under
  OAuth2 Redirects for the same Discord application referenced by `DISCORD_CLIENT_ID`.
- Discord redirect matching is exact: scheme, hostname, port, path, and trailing slash
  must match. The current local configuration uses `http`, `localhost`, port `4000`,
  and no trailing slash.
- `SESSION_PEPPER` is mixed into stored session-token hashes. Rotating it invalidates
  every existing login session.
- `SIGNAL_PEPPER` is mixed into privacy-preserving IP/user-agent abuse fingerprints.
  Rotating it breaks continuity with previously recorded risk signals.
- Both peppers must be separate, randomly generated backend secrets of at least 32
  characters and must never be committed or exposed to the frontend.

## 2026-07-25 — Pre-launch correction, application flow, and pixel studio

- Corrected the product throughout the visible site, README, plan, and generated
  snapshot to `PRELAUNCH`; the website no longer claims a deployed contract, owner
  lookup, indexed trading activity, earned ETH, or creator fee percentages.
- Replaced the Python website sync entry point with `scripts/sync-collection.mjs` and
  `npm run sync:collection`. The JavaScript validator confirmed 210 traits, 19 1/1
  references, 16 generated fixtures, the 32×32 canvas, and the 10,000-item supply.
- Limited the featured carousel to Red Panda and Skunk as the only 1/1 cards, followed
  by normal generated examples; reduced selected labels and improved small-screen
  visibility.
- Centered and repaired the adaptive MBO header, kept the O inside its circle, added an
  always-available compact mobile menu, and rebuilt the mobile menu and identity modal
  layouts for narrow screens.
- Extended authenticated sessions to one year. A verified Discord identity remains
  attached to its database profile and can recover that same profile through Discord;
  read-only visitors remain able to browse.
- Rebuilt Apply so Like, Repost, and Comment open the configured X campaign actions,
  persist completion locally, and unlock the final fields only after all three. Added
  a self-contained SVG download, up to 30 choices per trait category, wheel-driven
  horizontal trait rails, and permanent one-application enforcement in both local UI
  state and the database/API.
- Rebuilt Draw as a real responsive 32×32 pixel editor in TypeScript with canonical-base
  or blank 1/1 starts, mandatory base starts for accessories, multiple hideable Eyes,
  Hats, and Special layers, pencil/eraser tools, palette, local persistence, versioned
  server autosave, self-contained SVG download, and previews against all ten real ear
  traits.
- Draw publishing now sends idempotent community submissions to the API with pixel
  layers, compatibility evidence, content hash, and preview SVG. The API still enforces
  two active 1/1 slots and two active accessory/trait slots per verified profile.
- Profiles now list future payout-eligible collection names (currently the Bone
  Merchant example) without fabricated balances.
- Verification passed after the changes: frontend TypeScript, ESLint, 16 renderer
  tests, and production build; backend TypeScript, 5 API tests, production build,
  Prisma 7 client generation, and Prisma schema validation.
- The new unique application-per-user database constraint must be applied to the target
  Neon database with the normal Prisma deployment command before production rollout.

## 2026-07-25 — Generated library, carousel, PNG downloads, and color picker

- Kept Red Panda as the only visible pre-launch 1/1 on the public-facing collection
  presentation and removed the separate 1/1 library from the Collection page.
- Expanded the home carousel to Red Panda plus all 16 normal generated fixture masks.
- Made carousel dimensions fluid on desktop and mobile and hid the selected-card
  metadata on narrow screens so it no longer covers the artwork.
- Made the normal generated collection library use every fixture with an adaptive
  desktop grid and a compact two-column mobile grid.
- Changed both Apply builder downloads and Draw studio downloads to crisp 1024×1024
  PNG files with pixel smoothing disabled. Draw still publishes its structured pixel
  layers and SVG preview to the backend for generator review.
- Expanded Draw to 16 common colors and added a native custom color picker with the
  active hexadecimal value, allowing creators to select or mix any color.
- Frontend TypeScript, ESLint, 16 renderer tests, and the production build all passed.
