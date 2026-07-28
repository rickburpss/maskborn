# Submission storage and generator export

Mask Born Order stores relational records in Neon and artwork objects in Cloudflare R2.
The source pixel JSON is never replaced by the PNG or SVG preview.

## Buckets

Create two R2 buckets:

1. `maskborn-private` for exact source JSON and canonical accepted JSON.
2. `maskborn-public` for immutable SVG previews used by the website.

Keep the private bucket private. Enable an `r2.dev` URL or, preferably, a custom domain
such as `https://assets.maskborn.example` for the public bucket.

Create an R2 API token with object read/write permission for these buckets. Copy the
account ID, access-key ID, and secret access key. Do not put these credentials in the
frontend.

Set the backend environment:

```text
BACKEND_PUBLIC_URL=https://api.maskborn.example
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_PRIVATE_BUCKET=maskborn-private
R2_PUBLIC_BUCKET=maskborn-public
R2_PUBLIC_BASE_URL=https://assets.maskborn.example
```

All six R2 values must be configured together. Production startup rejects missing R2
configuration so artwork is not accidentally written to an ephemeral server disk.

No R2 credentials are required locally. Development falls back to:

```text
backend/.local-storage/private
backend/.local-storage/public
```

Local public previews are served through `GET /api/assets/*`. The directory is ignored
by Git.

## Database update

After setting the Neon URLs, apply the storage-reference fields:

```powershell
cd backend
npx prisma generate
npx prisma db push
```

For an established production database, inspect the generated SQL before applying it.
The existing `pixelData` and `previewAssetUrl` fields remain readable for older rows.

## Stored objects

A new publish writes:

```text
private/submissions/{userId}/{sourceHash}/source.json
public/submissions/{userId}/{previewHash}/preview.svg
```

Neon stores the keys, SHA-256 hashes, byte length, public preview URL, categories,
creator, voting counters, and review state. The feed explicitly excludes source JSON.

Admins can retrieve exact source data with:

```text
GET /api/mboadmin/submissions/{submissionId}/source
```

## Export an accepted submission

The exporter accepts a database ID or slug:

```powershell
cd backend
npm run export:submission -- submission-id-or-slug
```

It refuses pending or rejected work. For an accepted submission it:

1. Retrieves the exact source JSON from private storage.
2. Verifies its stored SHA-256 hash.
3. Validates the 32×32 coordinates, colors, layer count, and allowed trait kinds.
4. Removes invisible layers.
5. Resolves overlapping same-category pixels in layer order.
6. Sorts pixels deterministically by row and column.
7. Writes source JSON, canonical JSON, and a generator-ready JavaScript module.
8. Stores the canonical JSON privately and records its key and hash in Neon.

Default output:

```text
backend/exports/accepted/{slug}.source.json
backend/exports/accepted/{slug}.canonical.json
backend/exports/accepted/{slug}.mjs
```

Choose another output directory with:

```powershell
npm run export:submission -- submission-id --out "C:\path\to\accepted-traits"
```

The canonical JSON is language-neutral. Its `traits` entries contain ordered
`[x, y, "#RRGGBB"]` tuples for Background, Eyes, Hats, and Special. That file is the
safe input for coding the accepted art into the collection generator and later packing
it into onchain bytes.
