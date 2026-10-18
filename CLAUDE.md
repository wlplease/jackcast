# Selfcaster

A Farcaster client you deploy for yourself. One user per deploy, one password, no algorithm. The point is a calm, chronological, genuinely *yours* way to read and post on Farcaster.

This file is the working guide for anyone changing the code, people and AI coding agents alike: what's where, why it works the way it does, and how to check your work.

The repo is **public**, and so is every fork. Never commit secrets, `.env*` files, or anyone's personal data.

## Conventions

- UI copy: plain, precise, casual. No em dashes. No filler or hype. The wordmark is lowercase (`self` + `caster`, from `lib/brand.ts`).
- Most people who deploy this won't use a terminal. Setup and settings should work from the browser: in-app flows, the Vercel dashboard, GitHub web.
- For UI changes, look at the real pages at phone width (390px) in light and dark before you call it done.
- Keep it single-user. Anything that needs accounts, a database or multi-tenancy is a different project.

## Stack

- Next.js 15 (App Router, server actions), React 19, TypeScript 5
- `@neynar/nodejs-sdk` v3 for all Farcaster reads and writes (server side only)
- `viem` (browser only, for signing the key request in `/setup`), `qrcode`, `hls.js` (loaded on first video tap)
- Fonts self-hosted via Fontsource: Bricolage Grotesque Variable (display), Geist Variable (UI and reading), Geist Mono Variable (meta)
- Vercel (the Hobby plan is enough), Vercel Blob for photos

## Map

```
middleware.ts               password gate (APP_PASSWORD, hashed cookie). Covers /api routes too. Skips /login, /i/, icons.
app/layout.tsx              root: renders the chosen color theme into <head>, icons, viewport color
app/actions.ts              publish (text, photos/links, quote), like/recast, login, logout
app/(main)/                 feed, channels (/c/x), threads (/cast/0x..), profiles (/u/x), notifications
app/(main)/compose/         composer page: ?quote=0xhash, ?url=&text= (prefill), Android share target
app/(main)/search/          casts, people, channels
app/(main)/me/              "You": profile, cast stats, theme, favorite channels, filters, account; /me/edit for profile
app/api/upload/             issues Vercel Blob upload tokens (requires a connected signer)
app/api/head/               newest timestamps for the "new casts" pill
app/i/[...path]/            public, cached copies of photos from a private Blob store (outside the password gate)
app/setup/                  in-browser signer setup: sign, approve, done
lib/brand.ts                name, wordmark and description. Change these to rebrand.
lib/themes.ts               color themes (token sets for light and dark) and themeCss(); checked by scripts/check-themes.ts
lib/viewer.ts               who's using the app: env vars, else the /setup cookie, else read-only
lib/data.ts                 feed fetchers, filtering, followed channels and favorites (cached 10 min)
lib/prefs.ts, prefs-shared  settings (mutes, quality, recasts, reply/mini app filters, repeated-link grouping, favorites, Friends/custom feed people and name, app-local pinned cast, theme, mode), per device in the selfcaster_prefs cookie
lib/filters.ts              mute matching and score filtering (your own casts are never hidden)
lib/players.ts              which links get inline players
lib/image.ts                browser-side resize/compress (2048px JPEG) and square avatar crop
lib/stats.ts                stats over your last 30 days of top-level casts
components/                 CastCard, Composer, Embeds, VideoEmbed, Player, Feed, CaughtUp, NewCastsPill, ThemeForm, ...
public/                     icons (favicon, PWA, maskable), manifest, brand image
```

## Identity and signing (why it works this way)

- Writing to Farcaster from your own app needs a **signer** (an Ed25519 key) approved by your account, and Farcaster requires every new signer to be requested by an app FID with an EIP-712 signature from that FID's custody wallet.
- **Sign in with Neynar (SIWN) is retired.** Neynar stopped issuing new SIWN connections after August 14, 2026, so there's no hosted one-click connect. We use Neynar managed signers.
- `/setup` does the custody signature **in the browser**: the recovery phrase is read from a password input, used once by `viem`'s `mnemonicToAccount`, then cleared. It is never put in React state, never sent to a server action, never stored, never logged. Only the signature goes to the server. **Keep it that way.** SECURITY.md promises this to users.
- The app FID is the user's own FID (or a throwaway account's). Registration tries `sponsored_by_neynar: true` first, then falls back to unsponsored.
- Approval: QR on desktop, "Open in Farcaster" button (new tab) on phones. The pending request id is kept in `sessionStorage` so iOS unloading the tab mid-approval doesn't lose it, and the page re-checks on `visibilitychange`.
- Once approved, a signed (HMAC) httpOnly cookie connects that device. The done screen shows `SIGNER_UUID` and `MY_FID` to paste into Vercel so every device is connected.
- `lib/viewer.ts` resolution order: env `SIGNER_UUID` + `MY_FID`, then the setup cookie, then `MY_FID` alone (read-only), else redirect to `/setup`.

## Env vars

| Var | Notes |
| --- | --- |
| `NEYNAR_API_KEY` | required |
| `APP_PASSWORD` | required in production (middleware fails closed without it) |
| `SIGNER_UUID`, `MY_FID` | filled in after `/setup` |
| `PINNED_CHANNELS` | default favorites until the user picks; comma separated, no slashes |
| `MIN_USER_SCORE` | default for the quality dial (0 to 1); the dial overrides it per device |
| `BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY` | added by Vercel for newer Blob stores; photos use the presigned flow with the project's OIDC token |
| `BLOB_READ_WRITE_TOKEN` | older Blob stores; photos use the client-token flow |
| `NEYNAR_API_BASE` | local testing only, points the SDK at a mock API |

The Deploy button in the README asks for `NEYNAR_API_KEY` and `APP_PASSWORD` and creates a **public** Blob store (`stores=[{"type":"blob","access":"public"}]`). If you add a required env var, add it to that URL too.

## Feature notes

- **Photos** upload straight from the browser to Vercel Blob, so big files never pass through a function. `app/api/upload` supports both store styles: newer stores (`BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY`, `handleUploadPresigned` + `issueSignedToken`, authenticated by the `x-vercel-oidc-token` Vercel adds to every request) and older ones (`BLOB_READ_WRITE_TOKEN`, `handleUpload`). `GET /api/upload` reports the mode and `lib/upload-client.ts` picks `uploadPresigned()` or `upload()` to match. The presigned flow can't be fully tested locally (no OIDC token outside Vercel). Images are resized to 2048px and re-encoded as JPEG; GIFs pass through. Uploads time out after 60s with a clear error.
- **Private Blob stores**: access is fixed when a store is created. Private-store URLs (`*.private.blob.vercel-storage.com`) can't be opened by other clients, so `lib/upload-client.ts` swaps them for `<origin>/i/<pathname>`, served by `app/i/[...path]/route.ts` with `get(..., { access: "private" })` (OIDC from the `x-vercel-oidc-token` header, or the RW token), `cache-control: public, max-age=31536000, immutable`, only `casts/` and `pfp/` paths with image extensions. `publish` rejects raw private URLs, and `Embeds` routes old ones through `/i/`. To test locally, preload a shim that sends `*.blob.vercel-storage.com` to a mock (Next bundles its own undici, so set the global undici dispatcher).
- **Embeds**: Farcaster allows 2 per cast. Photos, a link and a quote all count, and the composer enforces it.
- **Images in the feed**: native Farcaster photos are `imagedelivery.net` URLs with no extension and often no metadata, so `Embeds` also treats known image hosts as images (`IMAGE_HOSTS`).
- **Videos** (`components/VideoEmbed.tsx`): Farcaster videos are HLS `.m3u8` with `thumbnail.jpg` beside the playlist. Poster until tapped; Safari plays HLS natively, elsewhere `hls.js` is imported on the first tap. Aspect ratio from Neynar's `metadata.video.stream`. Playwright's Chromium has no H.264, so test HLS with a VP9 fMP4 stream.
- **Inline players**: YouTube shows a thumbnail until tapped (no iframe until then). Bandcamp's player id comes from the page's `og:video`.
- **Caught-up line**: `localStorage` key `selfcaster:seen:<feed>` holds the newest timestamp you've seen, written when you leave the page (`visibilitychange`, `pagehide`, unmount), so the line stays put while you read.
- **Likes and recasts** use plain state with a revert on error, not `useOptimistic` (that snapped back when the action ended).
- **New casts pill** polls `/api/head` every 60s while the tab is visible, plus on returning to the tab. Each poll is one Neynar call.
- **Settings** live in the `selfcaster_prefs` cookie so the server can filter and theme before render (no flash). Per device; a database would sync them. `savePrefs()` takes a partial patch and merges it, so each form only sends its own fields.
- **Feed order**: feeds are re-sorted newest first (`byTime` in `lib/data.ts`). Recasts are off by default because a recast carries the original cast's timestamp. `prefs.recasts` turns them on.
- **Favorite channels**: `prefs.tabs` (picked on /me, A to Z), else `PINNED_CHANNELS`. They're the header tabs and the composer's whole channel menu (`composerChannels()`), plus the channel page you're on. The picker searches every followed channel: `fetchUserChannels` caps at 100 per page, so `lib/data.ts` walks the cursor.
- **Friends feed**: `prefs.friends` stores up to 10 `{ fid, username }` entries in the device preferences cookie. `/friends` fetches a chronological Neynar FID-filtered feed, uses the same mute/quality filters, and has its own caught-up marker and new-casts poll. It is private app configuration and does not create a Farcaster group or change who you follow.
- **Custom feed**: `prefs.customPeople` and `prefs.customName` back `/circle`. Navigation always puts Following, Friends, and the named custom feed first; the custom group is another private FID-filtered chronological feed with its own cursor and new-casts poll. Both curated feeds are per-device and capped at 10 people.
- **Repeated link grouping**: `prefs.groupLinks` defaults on. `components/Feed.tsx` groups casts across every feed by their identical set of normalized embed URLs, ignores common tracking query parameters, and shows the newest cast first with an expandable list of the rest. It intentionally does not group by domain or similar text.
- **Feed filters**: `prefs.showReplies` and `prefs.hideMiniApps` filter Following/Friends/custom feeds locally after Neynar returns the page. Mini-app detection uses `metadata.frame`; feeds report the number hidden by all filters.
- **Scroll position**: `FeedScrollRestoration` stores a per-tab `sessionStorage` position by route, so Following, Friends, custom and channel feeds resume where you left off.
- **Drafts and threads**: `Composer` stores only text/link/channel draft fields in browser `localStorage`; photo files are not saved. `/compose/thread` saves up to five text casts locally and `publishThread` sends them in order, returning the confirmed sent count and last hash to resume a partial thread. Network failures can be ambiguous; the UI tells you to check your profile before retrying.
- **AI catch-up**: optional `GOOGLE_AI_API_KEY` enables a manual digest of up to 20 Following casts. Only post text and author names are sent; output is capped at 300 tokens. It cannot post/react and has no search grounding or tools. Provider billing/quota is the cross-instance cost control; do not treat process memory as a durable rate limiter.
- **Profile curation**: public profile headers offer an Add to Friends action backed by the same device cookie and ten-person limit. Profile cover styling uses theme tokens, not fixed colors.
- **Profile pages**: `/u/<username>?view=media` filters to image/video casts and walks at most five Neynar pages per request to find media. The optional pinned cast is chosen from the 30 newest casts and appears only on this Selfcaster profile. Profile banner updates use Neynar's `banner` field and require Neynar Pro; the banner is Farcaster profile data, not a local-only theme setting.
- **Stats** bucket by time of day and weekday in the browser, so they use your own time zone. Bars use `--chart`, which each theme validates against its card color.

## Design system

- Color tokens: defaults (the Selfcaster theme) at the top of `app/globals.css`; every theme, Selfcaster included, is a token set in `lib/themes.ts`. `app/layout.tsx` renders the chosen theme into `<style id="sc-theme">` in the head (`html:root` outranks the `:root` defaults), so the first paint is right, and `ThemeForm` rewrites that tag to preview instantly. Mode is auto (system), light or dark.
- Themes: Selfcaster (deep green #0D3733, poppy #F0A0D0, lemon #E0E868, from the brand kit), Orange, Stone, Farcaster (#866AFF), Higher, Twitter, X.
- After changing any color, run `npm run check:themes`: body text 7:1, secondary text and links 4.5:1, meta, likes, recasts and chart bars 3:1, button labels 4.5:1. If a theme fails, nudge the color; don't loosen the rule. Keep the Selfcaster values in `globals.css` in sync with `lib/themes.ts`.
- `--brand` is for fills (buttons, active tab, top bar, badges, focus). `--accent` is for text (links, channel names, the second half of the wordmark). `--on-brand` is text on brand fills.
- Type tokens: `--display`, `--display-weight`, `--display-tracking`, `--display-fvs`, `--wordmark-weight`, `--wordmark-em`, `--sans`, `--read`, `--read-size`, `--mono`. Swapping a type direction means changing these, not individual rules.
- New styles use tokens, never raw hex (except fixed media chrome like the video letterbox).

## Gotchas

- Call `requireViewer()` at the **top** of a page, outside any `try/catch`. `redirect()` throws, and a catch block will swallow it.
- The SDK's generated `PostCastReqBodyEmbeds` type merges URL and cast variants. A bare `{ url }` is correct; it's cast in `app/actions.ts`.
- Farcaster limits: max 2 embeds per cast, 1024 bytes of text.
- Neynar `signer_uuid` values only work with the API key that created them.

## Verify before shipping

```bash
npm run typecheck
npm run check:themes
NEYNAR_API_KEY=x npm run build
```

For UI changes, screenshot the real pages at phone width in light and dark (and a couple of color themes; set the `selfcaster_prefs` cookie to `{"theme":"x","mode":"dark"}` to pin one). The easiest way: run a small mock Neynar server, start the dev server with `NEYNAR_API_BASE` pointing at it plus `MY_FID`/`SIGNER_UUID`, and drive it with Playwright. Also check that no page scrolls sideways at 390px (`document.documentElement.scrollWidth` equals the viewport width).

## Roadmap

See `ROADMAP.md`. DMs are out of scope on purpose.
