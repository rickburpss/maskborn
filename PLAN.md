# Mask Born Order implementation plan

## Product shape

Mask Born Order is a pre-launch, community-built pixel collection. People enter through
their X account, paste a wallet address, build or draw a submission, publish it to the
community, and vote on other work. Admins can promote accepted work into the official
gallery as a 1/1, a general trait, or an accessory. Accepted 1/1 artists can receive a
future payout eligibility after launch; the pre-launch site does not display invented
earnings or fee percentages.

The collection itself already exists in `C:\Users\Hp\Desktop\arcOne`. Its executable
generator and current contract-data manifest are the source of truth. The website must
not invent a second body, different layer names, or a simplified composition model.

The first implementation is split into:

- `frontend`: Next.js App Router, TypeScript, Tailwind CSS, Motion, Zustand, Lenis,
  TanStack Query, Zod.
- `backend`: Node.js, Express, TypeScript, Prisma, PostgreSQL/Neon, Zod.

Three.js is intentionally excluded from the first pass. The interface is pixel art and
layer compositing, so DOM/canvas tools are lighter and easier to keep crisp.

## Generator source of truth

### Current collection

- Fixed canvas: 32×32.
- Supply: 10,000.
- Current generator source has 19 reserved bespoke 1/1s and 9,981 rolled tokens.
- Rolled tokens draw exactly one trait from eight ordered categories:
  `Background`, `Fur`, `Eyes`, `Ears`, `Tails`, `Masks`, `Hats`, `Special`.
- Current trait counts are 32 backgrounds, 18 furs, 46 eyes, 10 ears, 10 tails,
  13 masks, 65 hats, and 16 specials. This is 210 rolled traits.
- Each category's rarity weights are basis points summing to 10,000. The current tiers
  are Common, Mini Grail, and Grail.
- The 1/1 list is read from `legendaries.LEGENDS`; it currently ends with `Mr A`.

These numbers are documented here for clarity, but application code must load the
generated snapshot. It must not duplicate them as handwritten constants. Some older
comments and handoff notes still say 18 legendaries; the executable generator,
`contracts/data/manifest.json`, and current exported assets say 19.

### Composition is not a normal image stack

The website previewer must reproduce `generate_collection.compose()` and
`export_onchain.decode_token()` in this order:

1. Draw the tail behind the body.
2. Draw the shared base body without ears, tail, mask, or default eye cells.
3. Resolve hat/ear compatibility and draw all ears, left ear only, or no ears.
4. Reapply the body's left-edge shade.
5. Draw the mask.
6. Reapply the default eyes over the mask.
7. Recolor symbolic fur cells (`G`, `D`, `L`, `W`) and draw the fur pattern.
8. Draw the selected eye trait.
9. Run the four-neighbour outline pass. Keyline does not propagate keyline.
10. Draw fur glow, hat, then special. These assets carry their own keylines.
11. Shift the complete character down two pixels.
12. Fill every remaining empty cell from the selected background.

Changing that order changes the art. In particular, masks/ears/tails alter the
silhouette before outlining, fur is a symbolic four-color remap rather than an overlay,
and large eye traits must remain above fur patterns.

### Existing compatibility and validation rules

- Hat and ear compatibility is generator logic, not a visual suggestion:
  - seven full-head hats currently suppress both ears;
  - nine hats keep only the left side of the selected ear trait;
  - `Crown × Pinned` suppresses ears for that pair only.
- Hat authoring checks the eye cells and, for original crown-mounted hats, prevents art
  below y=11 from burying the mask. Side-mounted/ported/full-head art has explicit
  exceptions.
- Normal eye traits stay inside the mask sockets at y=13–14, x=14–23, and avoid the
  face wedge at x=19. Full-face eyewear and ported art use explicit exception classes.
- Tail art must touch the lower body but maintain enough mid-height clearance for a
  background pixel to survive between its outline and the body's outline.
- Fur patterns must sit on fur outside the face box. Fur glow is a post-outline layer.
- Mask art must stay inside the head silhouette.
- Original special art cannot cover eye cells or leave the canvas.
- Backgrounds must render uniquely.

Community submission validation will expose these rules in plain language and run the
same machine checks before publish. Admin approval cannot bypass a broken render
silently; any override requires an explicit reason in the audit log.

### Generator sync

`maskborn/scripts/sync-collection.mjs` is the JavaScript validation bridge from the generator snapshot:

- Source: `ARCONE_GENERATOR_PATH`, defaulting locally to
  `C:\Users\Hp\Desktop\arcOne\generator`.
- Inputs: the exported contract-data manifest plus the checked-in portable collection
  and renderer snapshots produced from the generator.
- Outputs committed into this project:
  - a versioned trait/rarity/compatibility JSON snapshot;
  - canonical base and layer-preview SVGs;
  - baked 1/1 SVGs;
  - fixture combinations and their expected pixel hashes;
  - an explicit `PRELAUNCH` collection status.
- The sync fails if category totals drift, required previews or 1/1s are missing, the
  canvas is not 32×32, or rolled plus legendary supply does not equal total supply.

Deployment never reads `C:\Users\Hp\Desktop\arcOne` directly. The sync creates portable
assets in this repository before build.

## Pages and routes

### Public

- `/`: moving featured 1/1 gallery using the real baked collection assets, latest
  submissions, filters, voting, share links.
- `/collection`: pre-launch generator previews, trait counts, and the current 1/1 set;
  it does not claim a deployed contract or wallet ownership.
- `/gallery`: accepted community work, filterable by 1/1 and the eight real generator
  categories.
- `/community`: all published community submissions with vote state and status.
- `/art/[slug]`: shareable artwork page with creator, layers, vote totals, and gallery
  status.
- `/apply`: campaign checklist, Maskborn builder, quote-post URL, pasted wallet, submit.
- `/draw`: editor for 1/1 work or one/more trait types, compatibility preview, autosave.

### Account

- `/profile`: X identity, wallet, submission slots, drafts, all submissions, vote state,
  moderation result, gallery status, share links, and future payout-eligible names.

### Admin

- `/admin`: queue counts, community review, gallery promotion, campaign settings,
  submission limits, spam restrictions, trait management, payout ledger, and audit log.
- Admin authorization is a server role check. Hiding the route in the client is not
  considered access control.

## Main interface

### Navigation

- Resting state: one floating bone capsule containing Home, Gallery, Draw, Apply, and
  Community Gallery. Connect sits in a separate capsule.
- While scrolling: nav follows the page with a damped spring, shrinks to three primary
  destinations, and reveals Menu. Menu expands the full set.
- Mobile: Menu, current page, and Connect remain visible.
- Connect opens a modal for X sign-in, pasted-wallet management, profile navigation,
  and disconnect.
- Reduced-motion users get instant state changes and a non-autoplay carousel.

### Featured gallery

- Infinite horizontal track with five visible depth positions where space allows.
- Initial featured items are the real baked 1/1 SVGs from `legend_mint.py`; community
  1/1s enter the track only after admin approval.
- Center artwork is largest. Each next outer item is smaller.
- Slow autoplay, pointer/touch dragging, previous/next buttons, pause/play, keyboard
  arrows, and focus-safe controls.
- Autoplay pauses on hover, drag, focus, hidden tab, reduced-motion preference, or the
  explicit pause control.

### Latest creations

- Art cards show preview, type, title, X username linking to the creator's X profile,
  submission time, gallery state, vote controls, totals, and share action.
- Sort/filter options: newest, oldest, most upvoted, most downvoted, least voted,
  unvoted, 1/1, and accessories/traits.
- Logged-out voting opens Connect. A restricted voter sees the exact unlock time.
- Optimistic voting is rolled back if the API rejects the transaction.

## Identity and application

1. User pastes an X username. It is public attribution only and is stored as
   `UNVERIFIED`; it is not proof that the user owns the X account.
2. User links a Discord account through OAuth2 `identify`. The stable Discord user ID
   is unique to one Mask Born Order profile and changes the identity gate to verified.
   Visitors without verified Discord may browse but cannot vote, save server drafts,
   add wallets, apply, publish, or perform admin mutations.
3. User pastes a wallet. The API normalizes and validates it. A wallet can belong to one
   active profile unless an admin resolves a conflict.
4. Apply page links to the campaign post and records checklist confirmation for like,
   repost, and comment.
5. User assembles a Maskborn from the 210 synced traits. Preview composition follows
   the generator/contract order exactly.
6. User quote-posts the result and pastes the X post URL.
7. API validates Discord verification, the post URL format and uniqueness, wallet, slot allowance, and
   idempotency key.
8. The application is accepted into the review queue with all X action states set to
   `PENDING_MANUAL` for an administrator to check.

The app never claims a pasted username or campaign action is verified automatically.
There are no X API credentials or paid X API calls in the website flow.

## Draw and trait compatibility

- Every 1/1 starts with the actual canonical raccoon body from `raccoon.py`, including
  its symbolic fur keys and separated default-eye cells.
- Post types: `ONE_OF_ONE` or `TRAIT_EXTENSION`.
- Trait categories are the generator's categories: Background, Fur, Eyes, Ears, Tails,
  Masks, Hats, and Special. The UI can use "accessory" as friendly copy, but stored data
  must name its generator stage. A general head accessory maps to Hats; a mouth or
  companion accessory maps to Special.
- A trait post can declare multiple changed trait types.
- A submission that changes multiple categories stores a separate delta for each stage.
  It is never flattened into one ambiguous overlay.
- Hat submissions are previewed against all 10 ears in both raw and applied modes,
  mirroring `hat_ear_matrix.py`. The author sees which pixels collide and may propose
  `DRAW_ALL`, `LEFT_ONLY`, `NO_EARS`, or narrow pair exceptions.
- Eyes are tested against every mask and fur-pattern combination that touches the face.
  Tails run the clearance validator. Fur, masks, specials, and backgrounds run their
  generator-specific validators.
- Compatibility outcomes are `WORKS`, `CONFLICTS`, and `UNTESTED`, with an optional
  note. Required compatibility checks must be complete before publishing.
- Rendering uses the exported 32×32 index buffer and the exact mid-pipeline outline
  pass. Nearest-neighbor scaling keeps previews sharp.

### Browser preview strategy

- A local TypeScript reference renderer uses the synced data for instant interaction
  and offline draft work.
- The renderer is hash-compared with checked-in reference fixtures generated from the
  source collection workflow.
- New community pixels are stored as separate 32×32 layers so accepted accessories can
  later be coded into the canonical generator without changing its layer semantics.

## Draft safety

- Zustand persists the active draft locally after each meaningful editor change.
- Signed-in drafts also autosave to the API after a short idle period.
- Each server draft has a monotonically increasing version. Updates use
  `expectedVersion`; a stale tab receives `409 DRAFT_CONFLICT` instead of overwriting.
- Local draft data includes a schema version for migrations.
- The page warns before closing only while a server save is pending. Local persistence
  happens first, so leaving the browser still retains the work.
- Published snapshots are immutable. Continuing edits creates a new draft.

## Voting rules and abuse controls

- Database uniqueness on `(artworkId, userId)` guarantees one current vote per artwork.
- Vote values are `UP` or `DOWN`. The same endpoint handles add, switch, and remove.
- The mutability deadline is `submission.publishedAt + 24 hours`. Server time is the
  authority. Votes are frozen at the deadline.
- Vote counters change in the same database transaction as the vote record.
- Requests include an idempotency key so retries cannot double-apply a vote.
- The API rate-limits by account plus hashed IP/device signals.
- Suspicious bursts, alternating votes, many new accounts sharing a signal, or repeated
  rejected requests add risk events. Crossing the configured threshold creates a
  six-hour `VOTE_RESTRICTION`.
- Admins can review and lift restrictions; every change is audited.

## Submission limits and concurrency

- Default allowance: two published `ONE_OF_ONE` submissions and two published `TRAIT`
  submissions per user.
- Drafts and admin-rejected submissions do not consume a slot. Pending, accepted, and
  gallery-added submissions do.
- The publish transaction locks/checks the allowance and creates the submission
  atomically. Two rapid tabs cannot claim the final slot.
- Every publish request has an idempotency key. Repeating a successful request returns
  the original submission.
- Media uploads use content hashes to detect accidental duplicates.
- Server-side Zod validation limits URLs, titles, notes, canvas size, layer count, and
  payload size.

## Gallery and future creator payouts

- Admin promotion creates an immutable gallery entry linked to the reviewed submission.
- Promotion specifies 1/1 or collection trait, generator category/stage, compatibility,
  display status, and whether its named collection is eligible for a future payout.
- Before launch, profiles list eligible collection names only.
- Fee percentages, accrued balances, trading events, and payout states remain disabled
  until the collection contract, marketplace sources, indexer, and fee policy exist.
- Gallery approval does not itself promise or invent revenue.

## Core data model

- `User`, `SocialAccount`, `Wallet`
- `Session`, `Role`
- `Campaign`, `Application`
- `Draft`, `DraftRevision`
- `Submission`, `SubmissionStatusEvent`, `MediaAsset`
- `ArtworkLayer`, `Trait`, `TraitCompatibility`
- `GeneratorSnapshot`, `GeneratorCategory`, `GeneratorTrait`, `RenderFixture`
- `Vote`, `VoteEvent`, `VoteRestriction`, `RiskEvent`
- `GalleryEntry`, `OnchainPublication`
- `FeeShare`, `TradeFeeEvent`, `CreatorAccrual`, `Payout`
- `AdminAuditLog`, `IdempotencyRecord`

## API groups

- `/api/auth/username`, `/api/auth/discord/*`, `/api/session`, `/api/wallets`
- `/api/campaign`, `/api/applications`
- `/api/submissions`, `/api/artworks`, `/api/gallery`
- `/api/generator/snapshot`, `/api/render`
- `/api/votes`
- `/api/drafts`
- `/api/profile`
- `/api/admin/reviews`, `/api/admin/gallery`, `/api/admin/restrictions`,
  `/api/admin/traits`, `/api/admin/payouts`, `/api/admin/settings`

All mutation responses use a stable error shape with a machine code, human message,
field errors where relevant, and a request ID.

## Delivery order

1. Sync and validate the real generator snapshot and collection artwork.
2. Replace placeholder preview art with the generator-backed TypeScript renderer and
   real baked 1/1s.
3. Build the frontend shell, design tokens, navigation, carousel, latest feed, connect
   modal, Gallery, Collection, Apply, Draw, Profile, artwork detail, and Admin pages.
4. Create Prisma schema, Express middleware, read APIs, vote transaction, drafts,
   submission publishing, and admin promotion.
5. Connect TanStack Query mutations and replace local demo mutations with APIs.
6. Run renderer fixture comparisons, generator validators, lint, type checks, builds,
   Prisma validation, API tests, and responsive browser checks. Document Neon, Discord,
   and campaign environment variables.
