# X username and application setup

Mask Born Order does not call the X API. Users paste a public X username, so there are
no X developer credentials, API credits, OAuth callbacks, or MCP services to configure.

## Frontend configuration

Put the campaign post URL in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_X_CAMPAIGN_POST_URL=https://x.com/YOUR_ACCOUNT/status/YOUR_POST_ID
```

Use the production API and campaign URLs when deploying.

## How identity works

- A user pastes an X username with or without `@`.
- The backend validates X's username format and creates a 30-day browser session.
- The username is displayed for attribution and links to that public X profile.
- No API call is made to X and the username is stored as `UNVERIFIED`.
- The wallet is pasted separately and does not require a signature.
- Like, repost, reply, and quote-post requirements are reviewed manually by an admin.
- The quote URL must be a complete `x.com` or `twitter.com` status URL, and one quote
  post cannot be used for multiple applications.

Because X does not verify the username, this flow cannot prove account ownership.
Anyone can enter another public handle. Clearing cookies or disconnecting also removes
access to that browser profile; there is no username-based account recovery.

## Optional MCP

`https://api.x.com/mcp` is unrelated to the website flow. It is optional tooling for
AI clients and would require a separate X developer app and paid X API access. Mask
Born Order does not need it.
