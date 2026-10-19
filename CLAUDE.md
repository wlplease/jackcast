# Jackcaster (Selfcaster fork)

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
middleware.ts               password gate (APP_PASSWORD, HMAC session cookie). Covers /api routes too. Skips /login, /i/, icons.
app/layout.tsx              root: renders the chosen color theme into <head>, icons, viewport color
app/actions.ts              publish (text, photos/links, quote), like/recast, login, logout
app/(main)/                 Following, Saved, Media, Friends, Top, Recasts, custom, channels, threads, profiles, notifications
app/(main)/compose/         composer page: ?quote=0xhash, ?url=&text= (prefill), Android share target
app/(main)/search/          casts, people, channels
app/(main)/me/              consolidated settings; /profile for profile and analytics; /me/edit for profile editing
app/(main)/mini-apps/       weekly Mini Apps discovery, search, categories, per-device saved apps
app/(main)/dev/             creator-attributed apps, Farcaster publishing docs, fork/upstream links
app/api/upload/             issues Vercel Blob upload tokens (requires a connected signer)
app/api/head/               newest timestamps for the "new casts" pill
app/api/feed/[feed]/        protected cursor pages for Following, Friends, Top, and Media
app/i/[...path]/            public, cached copies of photos from a private Blob store (outside the password gate)
app/setup/                  in-browser signer setup: sign, approve, done
lib/brand.ts                name, wordmark and description. Change these to rebrand.
lib/themes.ts               color themes (token sets for light and dark) and themeCss(); checked by scripts/check-themes.ts
lib/viewer.ts               who's using the app: env vars, else the /setup cookie, else read-only
lib/data.ts                 feed fetchers, 10-FID batching, bounded scans, provider caches, profile/Mini App discovery
lib/prefs.ts, prefs-shared  settings (filters, feeds, pinned cast, up to 30 saved casts, saved apps, up to 3 personal audio tracks, theme), per device in the selfcaster_prefs cookie
lib/filters.ts              mute matching and score filtering (your own casts are never hidden)
lib/players.ts              which links get inline players
lib/image.ts                browser-side resize/compress (2048px JPEG) and square avatar crop
lib/stats.ts                stats over your last 30 days of top-level casts
components/                 CastCard, Composer, GIF/meme picker, listening dock, saved-cast state, Mini App launch tray, Feed, ThemeForm, ...
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
| `GOOGLE_AI_API_KEY` | optional; enables the manually requested Gemini digest |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | optional; enables read-aloud for a generated digest |
| `ELEVELN_LAB_API_KEY` | legacy misspelled ElevenLabs key alias accepted by the speech route; prefer `ELEVENLABS_API_KEY` |
| `NEXT_PUBLIC_GIPHY_API_KEY` | optional public GIPHY web key for GIF search; restrict it in the GIPHY dashboard |
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
- **Settings** live in the `selfcaster_prefs` cookie so the server can filter and theme before render (no flash). The gear opens `/me`; profile and analytics are at `/profile`. Settings are per device; a database would sync them. `savePrefs()` takes a partial patch and merges it, so each form only sends its own fields.
- **Feed order**: Following, Friends, and custom feeds exclude recasts. `/recasts` compares Neynar's following feed with recasts on and off, then shows casts present only when recasts are included. Neynar's feed response does not identify which followed account recasted a cast, so the UI says “Recasted by someone you follow” rather than guessing.
- **Favorite channels**: `prefs.tabs` (picked and ordered in Settings), else `PINNED_CHANNELS`. The user's order drives header tabs and the composer's whole channel menu (`composerChannels()`), plus the channel page you're on. The picker searches every followed channel: `fetchUserChannels` caps at 100 per page, so `lib/data.ts` walks the cursor.
- **Friends feed**: `prefs.friends` stores up to 50 `{ fid, username }` entries in the device preferences cookie. `/friends` fetches a chronological Neynar FID-filtered feed in batches of at most 10 FIDs per request, then applies shared feed filters and cursor pagination. Suggestions scan up to 1,000 casts from the latest 90-day Following activity and are cached per FID for 24 hours. The saved-list activity check has a hard budget of 10 requests / up to 1,000 casts, is cached for a week, and manual refresh is scoped to that viewer. It does not create a Farcaster group or change follows.
- **Top Accounts**: combines up to 20 curated ecosystem accounts and up to 20 active accounts from the viewer's network. FIDs are deduplicated, then split into groups of at most 10 per Neynar filter request. The activity ranking reuses the 24-hour suggestions cache.
- **Custom feed**: `prefs.customPeople` and `prefs.customName` back `/circle`. It holds up to 20 accounts and uses at most two 10-FID feed requests per page. It remains separate from Friends and Following. Followed-account and channel directories are cached per FID for one hour.
- **Saved casts**: `SavedCastsProvider` keeps the local bookmark list in sync with the cookie; `/saved` resolves up to 30 hashes through one bulk-casts request.
- **Media feed**: `/media` filters the viewer's Following feed locally into images, video, or audio. Sparse results can advance a small bounded number of cursor pages as the reader scrolls.
- **Repeated link grouping**: `prefs.groupLinks` defaults on. `components/Feed.tsx` groups casts across every feed by their identical set of normalized embed URLs, ignores common tracking query parameters, and shows the newest cast first with an expandable list of the rest. It intentionally does not group by domain or similar text.
- **Feed filters**: `prefs.showReplies` and `prefs.hideMiniApps` filter Following/Friends/custom feeds locally after Neynar returns the page. Mini-app detection uses `metadata.frame`; feeds report the number hidden by all filters.
- **Scroll position**: `FeedScrollRestoration` stores a per-tab `sessionStorage` position by route, so Following, Friends, custom and channel feeds resume where you left off.
- **Drafts and threads**: `Composer` stores only text/link/channel draft fields in browser `localStorage`; photo files are not saved. `/compose/thread` saves up to five text casts locally and `publishThread` sends them in order, returning the confirmed sent count and last hash to resume a partial thread. Network failures can be ambiguous; the UI tells you to check your profile before retrying.
- **AI catch-up**: optional `GOOGLE_AI_API_KEY` enables a manual digest of up to 40 loaded Following casts, each text excerpt capped at 420 characters. Google receives cast text, author names, dates, and public engagement counts. The route requests structured JSON with a storyline, up to five topic sections, and up to four insights; output is capped at 1,200 tokens. Each section and insight cites source hashes; the UI also shows an expandable list of every analyzed post, with direct cast links. Optional ElevenLabs read-aloud requires `ELEVENLABS_API_KEY` (or legacy `ELEVELN_LAB_API_KEY`) and `ELEVENLABS_VOICE_ID`; speech accepts up to 2,400 characters and sends only the digest. Audio stays in a browser object URL. Both providers can bill separately; the UI attempt limit is not a durable rate limiter, so use provider account limits. Neither integration can post/react or use tools.
- **Mini Apps**: `/mini-apps` uses Neynar's `7d` catalog ranking and a FID-personalized relevance request, both cached for seven days; search is on demand. Favorites (including manually added HTTPS links) are capped at six in the device preferences cookie; recently launched apps live in localStorage. Manual URLs are untrusted and go through the same native-host or sandboxed-browser launch path. `/dev` combines exact FID matches from Neynar app search, cached catalog results, and app embeds in the latest 100 top-level casts. This is index discovery, not a complete registry; manual refresh invalidates creator discovery. `MiniAppHostReady` verifies the official SDK host before calling `ready()`. Launch uses native `openMiniApp` in Farcaster and a full-viewport sandboxed iframe preview in a browser. `MiniAppSessionProvider` sits in the main route layout so minimizing preserves the iframe and its tray stays available while navigating between app pages. The browser preview does not expose host wallet or session capabilities.
- **Listening player**: `ListeningDock` is in the masthead and remains mounted across main routes. It offers eight bundled tracks plus up to three personal HTTPS URLs. Playback never starts automatically; the list is stored in this device's preferences.
- **Donations**: `DonationPanel` is shared by Settings and Dev. The recipient addresses and Base USDC contract are centralized in `lib/donation-recipients.ts`. It uses the Mini App wallet provider when hosted in Farcaster, otherwise `window.ethereum`. Native ETH is quoted approximately from Coinbase spot data; USDC uses 6 decimals. Donations require an explicit wallet confirmation and are linked to BaseScan after submission. Keep recipient addresses and chain/token metadata reviewed as wallet integrations change.
- **Infinite feeds**: Following and Friends use `/api/feed/following` and `/api/feed/friends`, protected by the same middleware gate as the app. Cursor length is bounded and control characters are rejected; API responses are no-store. The client appends unique casts, skips up to four empty/filtered pages at a time, uses IntersectionObserver with a visible Load more button fallback, and keeps the initial batch for the AI digest.
- **Profile curation and analytics**: public profile headers offer an Add to Friends action backed by the same device cookie and 50-person limit. Own analytics use up to 100 recent casts and a five-minute server cache, with 7/30/90-day and loaded-cast views. Profile cover styling uses theme tokens, not fixed colors.
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
- Neynar feed filters accept at most 10 FIDs per request. Use the `groupFeedFids` helper for Friends, Top, and activity scans; see [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md).
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
