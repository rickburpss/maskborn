# Admin access

The admin page is `/admin`. It appears in the navigation and Connect modal only for an
account whose database role is `ADMIN`.

Use a Discord ID allowlist so the owner account receives that role safely:

1. In Discord, enable **Settings → Advanced → Developer Mode**.
2. Right-click your Discord profile and choose **Copy User ID**.
3. Add the ID to the backend environment:

```env
ADMIN_DISCORD_IDS=YOUR_DISCORD_USER_ID
```

Separate multiple owner IDs with commas. Redeploy the backend, disconnect from Mask
Born Order, then use **Have an account** to log in with that Discord again. The callback
updates the account to `ADMIN`, and the Admin link then appears in the expanded desktop
navigation, mobile menu, and account modal.

Never use a username or display name here. Discord user IDs are stable; names are not.
