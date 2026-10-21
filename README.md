<p align="center"><img src="./public/icon-192.png" width="96" height="96" alt=""></p>

<h1 align="center">Jackcaster</h1>

<p align="center"><strong>Your feed, your way.</strong><br>A personal Farcaster client built on the open-source Selfcaster project.</p>

> **Building a client and your own Snapchain node?** Start with the [three-step Snapchain lab](./docs/SNAPCHAIN-LAB.md): provision a VM, install a read/write node, then build a client that reads from your node and submits signed messages through it. It covers current gasless app keys and the separate, paid custody/storage setup for accounts that need it.

<p align="center"><a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast&project-name=jackcast&repository-name=jackcast&env=NEYNAR_API_KEY,APP_PASSWORD&envDescription=Add%20your%20Neynar%20API%20key%20and%20choose%20a%20private%20password%20for%20your%20own%20Jackcaster%20deployment.&envLink=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast%23setup"><img src="https://vercel.com/button" alt="Deploy your own Jackcaster with Vercel"></a></p>

This live site is the maintainer's private instance. To use Jackcaster with your own Farcaster account, use **Deploy with Vercel** to create your own GitHub repository and separate Vercel deployment. You will need your own Neynar API key and a private password; connect your Farcaster account in your deployment's setup flow.

> **Jackcaster** is the app name; **Jackcast** is the repository name. This is an open-source, single-owner fork built on [Selfcaster by GenuineJack](https://github.com/GenuineJack/selfcaster). It keeps the original project's MIT license and credits, while adding optional features for this deployment. It is independent and is not an official Selfcaster release. See [FORK-NOTES.md](./FORK-NOTES.md) for maintenance details and [RELEASE-NOTES.md](./RELEASE-NOTES.md) for the current change summary.

**Jump to:** [Setup](#setup) · [Keys](#environment-variables-required-and-optional) · [Everyday how-tos](#everyday-how-tos) · [GIPHY setup](#gifs-and-memes-in-the-composer) · [Paid profile art](#paid-profile-art-and-credits) · [FAQ](#faq) · [Security](./SECURITY.md)

### New to Jackcaster?

Jackcaster is a personal Farcaster client for one owner. It brings your chronological Following feed, focused lists, conversations, media, Mini Apps, and posts you sent from Jackcaster into one place. The public landing page is a product tour; this repository's live deployment is private. To use the app, deploy your own copy, add a Neynar API key and private app password, then connect your Farcaster account in that copy's Setup screen. Your signer and preferences are per device. Start with [What you need](#what-you-need), then follow [Setup](#setup).

The landing page includes an interactive product preview with sample posts. It is illustrative rather than a recording of a signed-in user's feed.

## How Jackcaster relates to Selfcaster

Selfcaster is the original Farcaster client created and maintained by [GenuineJack](https://github.com/GenuineJack). Its source is at [GenuineJack/selfcaster](https://github.com/GenuineJack/selfcaster), and the original app is at [selfcaster.xyz](https://selfcaster.xyz/). Jackcaster starts from that open-source foundation and keeps its MIT license and attribution.

Jackcaster is maintained separately in [wlplease/jackcast](https://github.com/wlplease/jackcast). It is a personal fork for a single-owner deployment, with its own branding and workflow changes. It is not affiliated with or an official release from GenuineJack. Upstream Selfcaster remains the source for the original app; Jackcaster-specific additions and decisions are documented here for review and selective upstream discussion.

The shared foundation includes the Farcaster client, Neynar integration, in-browser signer setup, posting, profiles, and the original project license. Jackcaster adds focused personal feeds, Recasts separation, Top Friends activity tools, feed controls, profile analytics, Mini Apps discovery, a dedicated settings screen, feed continuation, and the optional AI digest. These additions are maintained in this fork; they do not change Selfcaster or affect its users.

Each deployment is hosted and configured by its operator. Neynar, Vercel, Google Gemini, and ElevenLabs are external services with their own keys, terms, availability, and possible costs. Jackcaster does not bundle their services or claim that every dependency is self-hosted. See [SECURITY.md](./SECURITY.md) and the setup guide before connecting an account.

Compared with the upstream project, Jackcaster adds:

- **More focused timelines:** separate Top Friends, Top Accounts, Recasts, and named custom feeds, followed-account search, reply and mini-app filters, repeated-link grouping, and per-feed scroll restoration. Recasts by people you follow have their own tab and stay out of the regular feeds.
- **A better reading list:** save casts into private, device-local collections, then filter, move, and organize bookmarks without syncing your reading history to a service.
- **Richer profile and posting tools:** Posts and Media profile tabs, a pinned cast, optional cover editing, local drafts, and a thread composer with partial-send recovery.
- **Optional AI catch-up:** a user-triggered Gemini digest with optional ElevenLabs speech. Provider keys stay server-side; see the privacy and cost notes below before enabling them.
- **Fork-specific hardening and polish:** responsive feed media and page layouts, server-side input and upload bounds, safer errors, baseline security headers, and documented security decisions.

These are Jackcast-specific choices, not a claim that Selfcaster should adopt every feature. See [FORK-NOTES.md](./FORK-NOTES.md) for the detailed comparison, [RELEASE-NOTES.md](./RELEASE-NOTES.md) for the current change summary, and [UPSTREAM-ISSUE-DRAFT.md](./UPSTREAM-ISSUE-DRAFT.md) for a proposed discussion with the upstream maintainer.

## What you get

- **A calm Following feed.** Newest first, every time. A caught-up line where you left off, and a "new casts" pill instead of the page jumping around. Following and Top Friends can append more posts as you scroll. Posts shared by people you follow appear in their own Recasts tab.
- **A dedicated Media feed.** Browse images, videos, and audio shared by people you follow, with a filter for each type. Sparse media pages continue through a small, bounded number of feed pages as you scroll.
- **Favorite channels.** Search every channel you follow, pick a few, and reorder them with accessible move controls. The same order appears in your feed tabs and composer.
- **Top Friends.** Keep a private chronological feed of up to 50 accounts. Settings can batch-add the 20 most active people you follow over 90 days and a broad curated roster spanning protocol, builders, creators, community, mini apps, and ecosystem teams, or you can pick people manually. Activity checks stay bounded and cached; Neynar feed batching respects its 10-FID limit. Your selected list stays on this device and out of Following and Custom.
- **A custom feed.** Search accounts you already follow by name or username, add up to 20, and name the tab (for example, Builders or Local). Review and edit the selected list in settings; Following, Top Friends, and this custom feed stay separate.
- **Profiles.** Browse posts or media, pin one cast on your Jackcaster profile, set an optional Farcaster profile cover (Neynar Pro required to update the cover), and optionally create still profile artwork with onchain credits. Video animation and upgrades are currently paused because Google video access has been unreliable; they are hidden from new-generation controls and rejected by the server before it accepts a new attempt. Previously saved animation jobs remain available to check in the same browser, and previously saved media is preserved. The artwork flow is: connect a Base wallet and check credits, buy a pack, describe an image, preview it, choose **Use on my profile**, then confirm with **Save profile changes**. The server records the Farcaster FID, wallet, action, transaction, and timestamps in Blob records and deployment logs. It does not use Firebase Anonymous Auth to claim Farcaster identity. Each confirmed generation attempt consumes one onchain credit, including provider failures. Preview and save are always user-confirmed. See the [profile-media credit contract notes](./contracts/README.md) and deployed Base address/ABI in [`contracts/deployments/base-mainnet.json`](./contracts/deployments/base-mainnet.json).
- **Posting that works.** Photos (up to 2, compressed on your phone first), links, quote casts, replies, threads with context, a GIPHY picker, and a photo meme maker with custom captions. The cast menu can copy cast text or its Farcaster link; your own casts can be deleted after an ownership check and explicit confirmation. Jackcaster adds app attribution to published casts; the app hides the raw attribution URL in its own feed and shows a small “via Jackcast” label. Share opens a cast composer with the original cast embedded; Jackcaster uses Farcaster's native composer in its host and Jackcaster's compose screen in a regular browser.
- **Media inline.** Farcaster videos, YouTube, Spotify, SoundCloud, Bandcamp and archive.org play right in the feed.
- **Around the network globe.** Optionally share a broad area from your browser location. Coordinates are rounded on-device to a 2° grid (roughly 220 km north-to-south); Nostr relays receive only the coarse area cell and public profile details. Precise coordinates are never uploaded. Pins are public, optional, and removable from the browser that shared them. Browser location can be spoofed, so pins are approximate self-reports. The globe uses bundled Natural Earth boundaries and needs no Firebase, map API key, or account setup.
- **Your filters.** Mute words or phrases to quiet recurring topics, or mute an `@handle` to hide that account and posts mentioning it. A quality dial can also hide low-score accounts. These controls are optional and can be reversed in Settings.
- **Repeated links grouped.** When several casts share the same destination, the newest stays in the feed and the others open underneath it. Turn this off in Settings → Feed controls if you want every post shown separately.
- **A calmer feed.** Filter replies and Neynar-detected mini apps, keep a separate scroll position for each feed, and tap an image to expand it without leaving the timeline.
- **A Sent feed.** Review casts and replies carrying Jackcaster's source attribution, then filter the loaded history by post type and date range. Posts made through other clients are not attributed to Jackcaster.
- **Feed tabs that fit.** Reorder built-in feeds and hide the ones you rarely use in Settings. Following stays visible; hidden feeds remain available from **More** in the feed header. These choices are saved on this device.
- **Drafts and threads.** Composer drafts stay in this browser. The thread composer posts a reply chain of up to five casts and keeps unsent text if a later post fails.
- **Mobile navigation and conversations.** Touch-friendly Home, Search, Saved, Alerts, Map, and You navigation stays reachable at the bottom of small screens. Deep replies include a direct jump back to their parent cast.
- **Optional AI catch-up and audio.** Open the AI icon to ask Gemini for a storyline, cited topic sections, insights, and activity analytics based on up to 40 loaded posts in Following. The latest successful digest and compact source-post snapshot are saved in this browser per connected FID. Reopening or refreshing restores the saved digest without another Google request; choose **Redo digest** to analyze again or **Clear digest** to remove the local copy. Add `GOOGLE_AI_API_KEY` for the digest; add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for audio. Google receives selected post text, author names, dates, and public engagement counts; ElevenLabs receives only the generated digest. Audio is created on demand and held in the browser for that visit.
- **A small soundtrack player.** Eight Jackcaster tracks are available from the top bar, with play/pause, previous/next, shuffle, repeat, and volume. Playback never starts automatically. Add up to three direct HTTPS tracks of your own under Settings → Listening; links are saved in this browser's settings.
- **Support development.** Settings and Dev include optional Base donations to the original Selfcaster developer or Jackcaster. Choose $1, $10, or $100 in USDC or approximate ETH; your connected Farcaster wallet is preferred in Farcaster, with a browser wallet fallback. The wallet must confirm each transaction. ETH uses a spot quote and can change before approval; verify the recipient and amount in your wallet.
- **Themes.** Jackcaster, the original Selfcaster palette, Orange, Stone, Farcaster, Higher, Twitter and X, each in light and dark. Reorder built-in feed tabs and choose which appear directly in the header; hidden feeds are in **More**. Every color is contrast-checked.
- **The rest.** Search casts, people, and channels with suggested starting points; notifications; profile analytics for 7, 30, and 90 days; profile editing; installable app support; and a Dev section linking to this fork, upstream Selfcaster, and the original creator's Farcaster profile.
- **A hidden arcade.** Tap the Jackcaster wordmark five times to reveal Jumping Jacks, a quick touch-friendly score chase. Personal bests stay on the device; an optional shared weekly board uses an isolated Firestore path and anonymous Firebase Auth. Scores are community-reported, not cheat-proof. See the [shared Firebase rules and index guide](./docs/FIREBASE-SHARED-RULES.md).
- **Privacy-minded usage analytics.** Optional Vercel Web Analytics records normalized page views and aggregate feature counts (feed opens, successful casts, Mini App launches, digest runs, and GIF searches). Profile names, cast hashes, channel names, query strings, cast text, FIDs, usernames, GIF search terms, map coordinates, and wallet addresses are not sent as analytics data. Enable Analytics in the project dashboard when you choose. See [Vercel's current limits](https://vercel.com/docs/analytics/limits-and-pricing).
- **Share either project.** Settings offers ready-to-edit Farcaster cast intros for Jackcaster and original Selfcaster, with optional discovery tags. The app footer also has a one-tap Jackcaster share action. Sharing opens Farcaster's native composer when available or Jackcaster's composer in a regular browser.
- **Mini Apps.** Explore Neynar's 7-day trending catalog, apps relevant to your network, and search. Open apps in Farcaster's native Mini App surface when Jackcaster is hosted there, or use the full-viewport in-app web preview in a regular browser. Minimize to a persistent tray, navigate elsewhere in Jackcaster, then restore the app without losing its session. Filter by available categories, keep up to six favorites, and revisit recently opened apps. See apps Neynar attributes to your FID in the Dev section, with recent-cast discovery as a fallback. Catalog data is cached for a week; your own app discovery refreshes every six hours to limit repeat API pulls. Native wallet and Farcaster actions require the official host; the browser preview does not grant those capabilities. Launch behavior follows the official [Mini App detection](https://miniapps.farcaster.xyz/docs/sdk/is-in-mini-app) and [`openMiniApp`](https://miniapps.farcaster.xyz/docs/sdk/actions/open-miniapp) SDK guidance.
- **One settings home.** Use the gear icon for themes, feed order and visibility, channel tabs, feed names, Friends, Custom, filters, and connection details. The profile icon opens your profile and analytics.
- **Keep reading.** Following and Top Friends append more posts as you scroll, with a manual Load more button if automatic loading is unavailable. The AI digest opens in its own panel from the AI icon and stays out of the post list.
- **Service status.** Settings reports whether optional integrations are configured; it does not probe provider uptime or quota. When a feature request fails, its page shows available error and retry guidance. AI remains optional; the core app works without Google or ElevenLabs keys.

What it doesn't do: DMs (on purpose), ads, or engagement-ranked timelines. Operators may enable privacy-minded aggregate Vercel Analytics as described above.

**AI is completely optional.** Jackcast works without Google or ElevenLabs keys; AI controls appear only when you configure the related server-side environment variables.

## What you need

- A **GitHub** account (free) and a **Vercel** account (the free Hobby plan is enough).
- A **Neynar API key** from [dev.neynar.com](https://dev.neynar.com). Neynar is the API Selfcaster reads and writes through. Their free plan is enough to try it; reading, posting and the connected account all use credits, so a daily user will likely want a paid plan. See [neynar.com/pricing](https://neynar.com/pricing).
- Your **Farcaster account**. Connecting it for posting uses the recovery phrase once in your browser to approve the app. Read-only browsing is available when the instance owner sets `MY_FID`.

### Environment variables: required and optional

Keep secrets in Vercel Environment Variables or an ignored local `.env.local`; never commit real values. Add only the optional integrations you plan to use.

| Variable | Required? | Purpose and notes |
| --- | --- | --- |
| `NEYNAR_API_KEY` | Yes | Server-only Neynar access for Farcaster profiles, feeds, and actions. Get it from [Neynar](https://dev.neynar.com). Never use a `NEXT_PUBLIC_` prefix. |
| `APP_PASSWORD` | Yes in production | Locks your deployment. Use a long, unique password and do not share it. Each person connects their own Farcaster account before posting. Local development can run without it. |
| `MY_FID` | Optional | Numeric Farcaster ID for the deployment's shared read-only feed. Users can connect their own accounts separately for posting. |
| `BLOB_READ_WRITE_TOKEN` | Optional | Enables direct Vercel Blob photo uploads for an existing token-based store. For newer stores use `BLOB_STORE_ID` plus `BLOB_WEBHOOK_PUBLIC_KEY` instead. |
| `BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY` | Optional pair | Enables Vercel's presigned Blob upload flow. Do not set only one. |
| `GOOGLE_AI_API_KEY` | Optional | Enables Gemini catch-up and paid profile artwork. It is a server key; selected public casts go to Google when a user requests a digest, and an artwork prompt goes to Google only when a user requests profile generation. Review Google's data retention, terms, model access, quotas, and billing. Profile video animation is currently paused in the app regardless of environment settings. |
| `PROFILE_REQUEST_BLOB_ACCESS` | Optional | Defaults to `public` for the connected Vercel Blob store. Set to `private` only if that Blob store is private; the server uses a unique, create-only record to prevent replaying a generation credit. Vercel Blob must be configured for profile uploads and one-use request locks. The studio stays hidden until Google AI and Blob are ready. |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Optional pair | Enables digest read-aloud. The key and voice ID stay server-side. Audio is generated only when requested. |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Optional | Public Firebase Web App config JSON for the shared arcade leaderboard and community globe. Alternatively set the four `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` variables. Enable Anonymous Auth and merge the isolated collection rules in [the shared Firebase guide](./docs/FIREBASE-SHARED-RULES.md). GIF search does not use Firebase. These are public web-app values, never Firebase Admin credentials. |
| `GIPHY_APP` | Optional | Server-only GIPHY app key for the free shared GIF search. Jackcaster never sends this key to browsers. Pair it with the Upstash Redis variables below for an atomic global limit of one search every 45 seconds (at most 80/hour) and one search per signed browser session every five minutes. No Firebase sign-in or rules are used. Users can instead save their own GIPHY key in the picker; it stays in that browser and goes directly to GIPHY. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional pair | Server-only Upstash Redis REST credentials. The atomic Redis scripts enforce the shared GIF cooldown and coordinate login attempt limits across Vercel instances using an HMAC address fingerprint. Create a Redis database in Upstash and add both values to Vercel. Existing Vercel KV projects can use `KV_REST_API_URL` + `KV_REST_API_TOKEN` instead. Shared GIF search fails closed if its limiter is unavailable; login falls back to a process-local limiter if Redis is unavailable and has a Vercel Firewall challenge on `/login`. |
| `GIPHY_RATE_LIMIT_SECRET` | Optional | Dedicated server-only HMAC secret for signing the GIF session cookie. If omitted, Jackcaster uses `APP_PASSWORD`. In local development without `APP_PASSWORD`, set this to enable the shared search route. |
| `PINNED_CHANNELS` | Optional | Comma-separated default channel IDs, without leading slashes. Users can change their tabs in Settings. |
| `MIN_USER_SCORE` | Optional | Default Neynar user-quality filter, from `0` to `1`; defaults to `0`. Users may adjust their own setting. |
| `NEYNAR_API_BASE` | Advanced | Optional Neynar API endpoint override; leave unset for the standard API. |

`APP_PASSWORD` and `NEYNAR_API_KEY` must remain server-side. An old `SIGNER_UUID` environment variable is ignored; remove it to avoid confusion. Jackcast only posts through the account approved on the current device. Firebase Web config and GIPHY web keys are intentionally public; they are not admin credentials and should be restricted with provider settings where available. Do not paste recovery phrases, private keys, Firebase service-account JSON, or wallet secrets into Vercel variables for this app.

## Setup

About 10 minutes, no Terminal.

### 1. Get a Neynar API key

Sign up at [dev.neynar.com](https://dev.neynar.com) and create an API key.

### 2. Click Deploy

Hit the **Deploy with Vercel** button above and sign in to GitHub and Vercel when prompted. Vercel will:

1. copy this repository into your GitHub account,
2. create a Vercel project linked to your copy,
3. ask for two values:

| Var | Value |
| --- | --- |
| `NEYNAR_API_KEY` | your key from step 1 |
| `APP_PASSWORD` | something long. Anyone with it can post as you. |

Then it builds and gives you a URL for your own Jackcaster. Each deploy is separate: it has its own password, settings, and Farcaster connection. Photo uploads are optional; connect a Vercel Blob store later from **Storage** if you want them.

### 3. Connect your account at `/setup`

Open your URL, enter your password, and you'll land on `/setup`.

1. Choose **Connect my account**, then paste your Farcaster recovery phrase (Farcaster app settings, usually under Advanced). The page signs one key request **in your browser** and clears it. The phrase is never sent to the server or saved. See [SECURITY.md](./SECURITY.md).
2. Approve in the Farcaster app: scan the QR on desktop, or tap **Open in Farcaster** on your phone.
3. Done. That device is connected.

The confirmation screen shows the Farcaster account that will publish. Sign in separately on each device; Jackcast does not share a deployment-wide signer, so a cast cannot silently publish as the site owner's account.

Rather not use your main recovery phrase? Make a separate Farcaster account just for this and use its phrase. You still approve and post as *you*. The other account only shows up as the app that asked.

If you only want read access, the instance owner can set `MY_FID` in Vercel. Then open the app and browse without connecting a signer or entering a recovery phrase.

To revoke access later: Farcaster app settings, connected apps.

### 4. Put it on your phone

Open your URL in Safari or Chrome and **Add to Home Screen**.

<details>
<summary>Prefer to set it up by hand?</summary>

1. On GitHub, **Use this template**, **Create a new repository**.
2. In Vercel, **Add New, Project**, import it, and add `NEYNAR_API_KEY` and `APP_PASSWORD` before deploying.
3. For photos: **Storage, Create, Blob**, choose **Public**, connect it to the project, redeploy. (A private store works too. Selfcaster serves those photos itself at `/i/...` so other clients can see them.)
4. Continue with step 3 above.

</details>

## Make it yours

- **Name and wordmark:** `lib/brand.ts`.
- **Icons:** replace the PNGs in `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png`).
- **Colors:** add or edit a theme in `lib/themes.ts`, then run `npm run check:themes` to check contrast.
- **Default tabs:** `PINNED_CHANNELS` (comma separated, no slashes) until you pick favorites in the app.

All optional settings are in [`.env.example`](./.env.example).

### GIFs and memes in the composer

The composer has a GIF search and a photo meme maker. A selected GIF is attached to a cast as its direct GIPHY media URL; Jackcaster displays it inline. The meme maker draws captions on a photo in your browser and attaches the finished image. It does not need a GIPHY key or Firebase.

#### Choose how GIF search gets its key

| Option | What to configure | How it works |
| --- | --- | --- |
| **Shared free search** | Operator adds `GIPHY_APP`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` to Vercel. | The GIPHY key stays on the server. Upstash atomically allows one search globally every 45 seconds and one per signed browser session every five minutes. No Firebase sign-in, Firebase rules, or user-entered key is required. |
| **Your personal GIPHY key** | In the picker, open **Use your own GIPHY key**, paste a key from the [GIPHY developer dashboard](https://developers.giphy.com/dashboard/), and choose **Save key on this device**. | The key is saved in this browser's local storage and calls GIPHY directly, so it does not use the shared cooldown. Its usage counts against that key's own GIPHY quota. Remove it before using a shared device. |
| **No search key** | Nothing. | The local photo meme maker still works. Shared search stays unavailable until the operator configures it; it does not silently use a personal key. |

Shared search needs `GIPHY_APP`, an Upstash Redis database configured with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, and a session-signing secret. In production, the required `APP_PASSWORD` supplies that secret by default; local development without it needs `GIPHY_RATE_LIMIT_SECRET`. Add the provider values as server-side Vercel variables; never use `NEXT_PUBLIC_GIPHY_APP` or expose the Redis token. Redis atomically enforces the global cooldown across Vercel instances. Jackcaster signs an HttpOnly first-party browser cookie to limit each browser session to one shared search every five minutes. Firebase is not involved in GIF search or the Nostr community map; it is used only for the optional arcade leaderboard.

If the shared search says it is cooling down, the timer applies to everyone; a personal key uses its own provider quota instead. The 45-second global slot caps the shared pool at 80 searches per hour. The five-minute signed-cookie window discourages one browser from repeatedly taking turns; clearing browser data can reset the session, but cannot bypass the global limit. This is a quota guard and fairness measure, not identity verification. Search results are G-rated and include GIPHY attribution.

### Optional Gemini catch-up

This feature is off unless you choose to enable it. You do not need an AI key to use Jackcast's feeds, profiles, or posting features. To enable the digest, add `GOOGLE_AI_API_KEY` to your server environment. The key stays on the server. The digest uses `gemini-3.8-flash`, is user-triggered, accepts up to 40 loaded casts with each text excerpt capped at 420 characters, asks for up to 1,200 output tokens, and does not use Google Search grounding. Google applies its own project quotas and billing; review [Gemini API pricing and usage](https://ai.google.dev/gemini-api/docs/pricing) and set a project spend cap in AI Studio if billing is enabled. The free tier may use submitted content to improve Google products; review Google's current terms before enabling it.

To add spoken playback, also set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. Choose a voice available to that key. Jackcast sends ElevenLabs only the generated digest, caps it at 2,400 characters, and allows one audio generation attempt per page visit. The MP3 is not saved by Jackcast; it is held in the browser until you leave the page, with an option to download it. ElevenLabs usage is billed separately; review [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) and set limits in your ElevenLabs account. The integration follows ElevenLabs' [text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert). See [FORK-NOTES.md](./FORK-NOTES.md) for how this personal fork differs from upstream and how to maintain it.

To disable the digest and audio, remove `GOOGLE_AI_API_KEY` and redeploy. To keep the text digest but disable audio, remove either ElevenLabs variable and redeploy.

### Paid profile art and credits

The profile artwork studio is optional and appears only when the operator configures `GOOGLE_AI_API_KEY` and Vercel Blob. It also requires a Base-compatible wallet and credits on the Base contract already wired into this repository; cloning Jackcaster does not require deploying another contract. Video animation and upgrades are paused in the app, and setting `GOOGLE_AI_VIDEO_ENABLED` will not re-enable them. Existing saved animation jobs can still be checked in the same browser. The deployed contract address, current treasury, defaults, owner controls, and limits are in [contracts/README.md](./contracts/README.md). Purchases go to that contract's current treasury; Google AI generation is billed separately to the Google project configured on each deployment.

1. Go to **Edit profile** and open **Profile artwork**.
2. Choose **Connect wallet**. Jackcaster reads the live USDC price and credit balance from the Base contract. This step does not buy anything.
3. Choose **Buy credits** after the amount is displayed. The wallet may ask for an exact USDC approval and then a separate purchase confirmation. Check both transactions before approving.
4. Describe the still image you want, then choose **Create artwork**. The wallet signs a request message (no funds move), then asks you to confirm spending one credit. Canceling the message signature does not spend a credit. A confirmed credit-use transaction counts as an attempt, even if the provider or upload later fails.
5. Preview the result, choose **Use on my profile**, then choose **Save profile changes** to update Farcaster. The generated result is not applied to your profile before you save.

Credits belong to the connected wallet and are read directly from Base; Firebase is not used for credit balances. Reconnect the same wallet to see its balance on another device. Saving a new profile image requires the user's approved Farcaster signer on that device. The connected wallet separately approves Base transactions. You can use Jackcaster's social features without connecting a wallet.

The contract's default personal purchase is 1 USDC for 3 paid plus 2 bonus credits (5 total), but the contract owner can change future price and pack settings within its bounds or pause sales. The studio reads the current values; rely on what the wallet shows before confirming. Google AI generation is billed to the deployment operator separately from the onchain USDC purchase. Review current image pricing, usage, and billing before enabling paid generation for others. Google can reject a generation after the credit is spent; each confirmed attempt consumes a credit, including provider or upload failures. Video generation remains paused. Review [SECURITY.md](./SECURITY.md) and the [contract guide](./contracts/README.md).

### Everyday how-tos

- **Choose a feed:** use the feed tabs below the Jackcaster wordmark. Following, Friends, Leaders, Recasts, Sent, Media, and Custom are separate. Reorder or hide built-in tabs in Settings; open hidden feeds from **More**. Add Friends and edit Custom in **Settings → Friends and custom**. Your selected accounts and feed names are saved in this browser.
- **Keep reading:** scroll down to append more posts, or use **Load more** if automatic loading pauses. Each feed keeps its own reading position. The AI catch-up panel is opened from its icon and does not replace the normal feed.
- **Post:** choose the composer, write a cast, then attach a photo, GIF, link, quote, or thread. You can remove attachments before posting. Jackcaster adds its source attribution to casts it publishes. Review the cast text and attachments before selecting **Cast**.
- **Use the AI digest:** open the AI icon, create a digest from the loaded Following posts, open its source posts, then **Redo digest** or **Clear digest** when needed. The most recent successful digest is saved in this browser per FID. Google receives the selected public cast text and metadata only when you request or redo a digest.
- **Open a Mini App:** select an app to open it in Farcaster's native surface when Jackcaster is running there; otherwise it opens in Jackcaster's browser preview. In the browser, minimize it to the tray to keep its session while you navigate. Host-only wallet and compose actions are not available in an ordinary browser preview.
- **Share an area on the community globe:** use **Share my approximate area** and allow browser location. The browser rounds coordinates locally to a broad 2° grid and publishes only that area and public profile details to Nostr relays. Pins are public, removable, and can’t prove physical presence. No Firebase configuration or Anonymous Auth is needed.
- **Review your profile:** open the profile icon for your profile and stats, editing, and (when configured) the profile artwork studio. The 7/30/90-day profile ranges filter the displayed analytics; they do not change Farcaster data.
- **Change app settings:** open the gear icon. Theme, feed names, Friends, Custom, filters, music, account connection, sharing, donations, and developer tools are collected there.

## FAQ

### Can I sign in to the maintainer's live Jackcaster with my own account?

No. The live site is a private, single-owner deployment. Use the **Deploy with Vercel** button at the top of this README or on the login page to create your own GitHub repository and Vercel app. Add your Neynar API key, choose your own `APP_PASSWORD`, then connect your Farcaster account in `/setup`. The Deploy Button starts Vercel's project flow and clones the source repository into the Git provider account you choose; you still need your own GitHub and Vercel accounts and provider key. See [Vercel's Deploy Button guide](https://vercel.com/docs/deploy-button) for details.

### Why doesn't this login ask me for a Neynar key?

`NEYNAR_API_KEY` belongs to the deployment operator and is configured as a server-side Vercel secret before the app is deployed. It is not a per-user sign-in credential. For your own account, deploy your own repository copy and enter your key in Vercel; then connect Farcaster on your deployment. The recovery phrase is used later in `/setup` to sign one request in your browser. Never enter the Neynar key into the recovery-phrase form.

### Can an NFT pass unlock the live shared node?

Not in this version. The current password gate is for the private owner deployment. A public shared node would need wallet-based access checks and separate per-user Farcaster signers; sharing the owner's password or signer would let others act as the owner.

### Is Jackcaster the original Selfcaster app?

No. Jackcaster is this repository's open-source fork of [GenuineJack/Selfcaster](https://github.com/GenuineJack/selfcaster), maintained separately by its operator. The original app is [selfcaster.xyz](https://selfcaster.xyz/), and the original creator's profile is [@genuinejack](https://farcaster.xyz/genuinejack). Jackcaster keeps the upstream MIT license and attribution. See [FORK-NOTES.md](./FORK-NOTES.md) before merging upstream changes.

### Does this repository push code or deploy my Vercel app?

No. Changes here stay in your local checkout until you choose to commit, push, or deploy them. Jackcaster does not push to GitHub or deploy to Vercel automatically. Review the diff, then use your own Git and Vercel workflow.

### Which keys are required, and which are optional?

For a basic production instance, set `NEYNAR_API_KEY` and a strong `APP_PASSWORD`. `MY_FID` is optional and only provides read-only account context; each device must connect its own signer at `/setup` before it can post. All provider features are optional. The [environment table](#environment-variables-required-and-optional) describes each variable and where it belongs.

### Which values are secrets?

Keep `NEYNAR_API_KEY`, `APP_PASSWORD`, `GIPHY_APP`, `GOOGLE_AI_API_KEY`, and `ELEVENLABS_API_KEY` in Vercel's server environment or an ignored local `.env.local`. Do not add `NEXT_PUBLIC_` to them. Firebase Web App config is intentionally public and is limited by Firebase Authentication and Firestore rules; it is not an admin credential. Never add a Firebase service account, wallet private key, recovery phrase, or Neynar signer UUID to this project.

### How do Jackcast private messages work, and how do I set them up?

Jackcast uses Nostr as the delivery network. Nostr relays are independent servers that pass along and store message events. Jackcast encrypts the message on your device before sending it; relays receive ciphertext and delivery metadata, not the message text under the normal app code. You do not need a separate Nostr account, Matrix account, or API key.

To start, open **Messages** (`/messages`) on a deployment running the DM feature:

1. Select **Create DM identity**. Jackcast makes a separate 24-word recovery phrase for your DM key. Save it somewhere private and offline, then confirm the requested word. This is not your Farcaster recovery phrase.
2. Choose a local unlock passphrase of at least 16 characters. It encrypts the key stored in this browser; it is not a recovery method and is not sent to a server.
3. Review the exact public Farcaster cast linking your FID to the new DM public key, then confirm publication. Jackcast uses your already-approved signer from `/setup`; there is no additional wallet connection. The cast is public and contains only your FID and DM public key, never your private key or messages.
4. Find another person by Farcaster username or FID. They also need to create a Jackcast DM identity. New conversations arrive as requests; accept a request before replying. Use **Reply** on a message to thread a response.

Jackcast publishes the Farcaster proof cast and a DM-key-signed locator plus inbox relay list to Nostr. Deployments verify the proof cast's Farcaster author and exact key before trusting the identity. The private key and recovery phrase stay on your device. To use the same DM identity on another device, restore with the 24 words and choose a new local unlock passphrase; your existing public proof remains valid for that same key. A rotated key requires a new reviewed public cast. If both the original device key and recovery phrase are lost, the old identity and messages cannot be recovered.

The DM format, NIP-17, is still a draft and does not provide Signal-style forward secrecy. Relays may retain encrypted messages and see delivery metadata; recipients can copy or save plaintext. The feature has not had an independent security audit, and a web deployment can serve code that accesses the key while it is unlocked. Treat this as an early feature and do not use it for high-risk secrets. See [DM design and security limits](./docs/DM-ARCHITECTURE.md) and the [short user announcement draft](./docs/DM-USER-POST.md).

### How do GIF search and the meme maker work?

The shared GIPHY search uses the server-side `GIPHY_APP` key and an atomic Upstash Redis cooldown: one shared search every 45 seconds globally, plus a five-minute signed-browser-session fairness delay. It does not use Firebase. A user can save a personal GIPHY key in the picker; it stays in that browser and calls GIPHY directly, using that key's quota instead of the shared pool. GIFs are attached as image media in the cast. The photo meme maker runs locally and needs neither GIPHY nor Firebase.

### What if Firebase says Anonymous sign-in is disabled?

For the optional arcade leaderboard, open Firebase Console → **Authentication → Sign-in method**, enable **Anonymous**, and save. Check that the app's public Firebase Web config belongs to that project and that the Jackcaster arcade collection rule was merged into the shared rules file. The community map uses Nostr and does not need Firebase. GIF search also does not need Firebase. Jackcaster does not require Firebase Admin or service-account credentials; keep any other apps' rules when merging.

### How does the globe use location?

The Map tab optionally reads browser location and rounds it locally to a 2° grid (roughly 220 km north-to-south). Exact coordinates and reported accuracy are never written to Firebase; after confirmation, the shared record contains only the coarse area ID, a GPS-path marker, and public profile fields. Anyone allowed to read that Firebase collection can see the approximate area. Browser location can be spoofed, and the pin does not prove physical presence or that the submitted Farcaster FID matches the anonymous Firebase session. Remove a pin in the Map tab whenever you want. Existing city pins are hidden until their owners replace or remove them. The globe does not make external geocoding or tile requests. See the data attributions in [`public/data/ATTRIBUTION.md`](./public/data/ATTRIBUTION.md).

Area sharing publishes coarse location events through the public Nostr relay set already used by Jackcaster DMs. It needs no Firebase setup. Make sure the browser allows location access and is on an HTTPS page. Pins are public and approximate.

### Do I need Firebase for USDC credits or paid profile artwork?

No. Credit balances and purchases are read from the deployed Base contract and belong to the connected wallet. Firebase is not the credit ledger. Paid still-image generation needs the operator's server-side Google AI key and Vercel Blob for uploads and replay protection. Check the contract address and current price in the wallet before buying; Google usage is a separate operator cost. Each image generation attempt spends one credit, even if the provider fails. Video animation is paused. Artwork is only applied after the user previews it and confirms **Save profile changes**. See [contracts/README.md](./contracts/README.md) and the [profile art guide above](#paid-profile-art-and-credits).

### Why is the AI digest missing, or why does it use old posts?

The digest appears only when `GOOGLE_AI_API_KEY` is configured. It analyzes posts already loaded in Following and saves the latest successful digest in the browser per FID. Reopening it does not call Google again; select **Redo digest** to send a fresh sample. Google receives the selected public cast text and metadata only after you run or redo the digest. Audio additionally requires both ElevenLabs variables. See [Neynar request budgets](./docs/NEYNAR-USAGE.md) for feed pulls and the optional provider notes above for AI costs.

### Why can't a Mini App use my wallet or Farcaster actions in a browser?

The normal browser preview does not provide Farcaster host privileges. Wallet prompts, native cast composition, and other host actions are available only when Jackcaster is opened in a supporting Farcaster Mini App host. The browser preview can display and navigate the app, but it cannot impersonate those host capabilities.

### What should I do if feeds, notifications, or media stop loading?

Refresh once and check the visible service status. A 503 or quota error can come from Neynar or a provider; do not keep retrying rapidly. Check the server logs and the relevant provider dashboard, then review the bounded request budgets in [NEYNAR-USAGE.md](./docs/NEYNAR-USAGE.md). A broken thumbnail from another domain can be blocked by that media host even while the cast itself is available.

## Getting updates

The Deploy button makes a fresh copy of Jackcast, so your repo won't update on its own. Jackcaster changes are not pushed or deployed automatically by this project; review and push source changes yourself, then deploy when you decide. For upstream Selfcaster changes, review [GenuineJack/Selfcaster commits](https://github.com/GenuineJack/selfcaster/commits/main) and copy or merge the changes you want. This repository has its own customizations, so review changes and resolve conflicts before deploying an update:

```bash
git remote add upstream https://github.com/GenuineJack/selfcaster.git
git pull upstream main --allow-unrelated-histories
```

Want one-click updates to Jackcast? [Fork this repository](https://github.com/wlplease/jackcast/fork) instead of using the Deploy button, then import your fork into Vercel by hand. GitHub's **Sync fork** button can pull in later Jackcast changes. Forks of a public repo are public, so keep secrets in Vercel environment variables rather than in the code.

## How it works

```
your browser ── password + account cookie ──> Next.js on Vercel ──> Neynar API ──> Farcaster
                         │                         │
                         └─ device-specific signer ─┘
```

The API key stays on the server. The approved device-specific signer is stored in a signed, HttpOnly cookie; Jackcast does not use one deployment-wide signer for posts. Settings like mutes, favorites and theme are stored per device in a cookie.

For endpoint-by-endpoint request counts, caching windows, account batch limits, and bounded scan budgets, see [Neynar usage and pull budgets](./docs/NEYNAR-USAGE.md).

### Private messages

For setup steps, recovery, and security limits, see [How do Jackcast private messages work?](#how-do-jackcast-private-messages-work-and-how-do-i-set-them-up) and the [DM architecture notes](./docs/DM-ARCHITECTURE.md). DMs use Nostr relays and do not require Firebase rules.

## Running locally

```bash
npm install
cp .env.example .env.local   # add NEYNAR_API_KEY
npm run dev
```

Open http://localhost:3000/setup. Without `APP_PASSWORD`, local dev skips the lock screen.

Add only the optional provider keys you intend to use to `.env.local`; never commit that file. `GIPHY_APP` is server-only. Firebase web config uses `NEXT_PUBLIC_` values by design; it is public app configuration, not a credential that grants administrative access.

Checks: `npm run typecheck`, `npm run check:themes`, `NEYNAR_API_KEY=x npm run build`.

## Contributing

Issues and pull requests are welcome. This project builds on [the open-source Selfcaster project](https://github.com/GenuineJack/selfcaster); Jackcast-specific changes and maintenance notes are in [FORK-NOTES.md](./FORK-NOTES.md). [CLAUDE.md](./CLAUDE.md) has the architecture, decisions and conventions, and [ROADMAP.md](./ROADMAP.md) has ideas.

## License

[MIT](./LICENSE). Jackcast is a community customization of [GenuineJack/Selfcaster](https://github.com/GenuineJack/selfcaster), originally made by [@genuinejack](https://farcaster.xyz/genuinejack).
