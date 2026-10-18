# Security and design improvement plan

This document tracks review findings and implementation decisions for this repository. It is a working plan, not a claim that listed risks have already been fixed. Update the status and change log as work lands.

## Scope and product constraints

- One deployment is for one person. Keep the product single-user unless that goal changes.
- The browser signs the Farcaster key request. The recovery phrase must never be sent to, stored by, or logged on the server.
- Neynar credentials and signer identifiers stay server-side.
- `/i/...` intentionally serves images that have already been posted so other Farcaster clients can display them.
- Record security and product changes here with what changed, why, and verification performed.

## Prioritized security work

| Priority | Finding | Planned change | Status |
| --- | --- | --- | --- |
| High | The lockfile resolves Next.js 15.5.28 with PostCSS 8.4.31. `npm audit` reports high severity PostCSS advisories through Next.js. | Keep Next 15 and override PostCSS to a patched 8.5 release; re-audit after install. Revisit when a patched Next 15 release becomes available. | Done (PostCSS override) |
| High | `selfcaster_session` is a deterministic, unkeyed SHA-256 digest of `APP_PASSWORD`; possession permits replay. It lasts 90 days. | Replace it with a versioned, keyed session token and invalidate old tokens. Replay remains possible if a current cookie is stolen; rotation still uses `APP_PASSWORD`. | Done (token); replay and lifetime remain open |
| Medium | Login has no throttling, so password guessing can consume app resources. | Apply five-attempt/15-minute process-local throttling and generic errors. Add edge-level limiting for durable enforcement across serverless instances. | Done (best-effort; edge-level still recommended) |
| Medium | Signer setup can create signer requests and poll Neynar without app-level throttling. | Validate signer IDs and request data at the server boundary; rate-limit signer creation and polling; cap polling duration and request frequency. | Open |
| Medium | The public image route trusts the Blob object's `image/*` content type and serves it at the app origin. | Verify the stored type and extension agree; restrict served formats; set `X-Content-Type-Options` and a restrictive content security policy for image responses. | Done (response checks) |
| Medium | Upload route parses arbitrary JSON before its error handler and returns exception messages. | Bound request body size, handle malformed JSON consistently, return generic client errors, and keep diagnostic details in server logs. Confirm Blob SDK callback validation remains enabled. | Done (body cap and generic errors) |
| Medium | Signer setup accepts signer request data from the browser. | Validate UUID, FID, deadline, and signature shapes before forwarding them to Neynar. | Done (input validation) |
| Medium | Server actions can return raw Neynar messages to the browser. | Map expected upstream errors to safe, actionable messages without credentials or user secrets. | Done (cast, reaction, profile, signer setup) |
| Low | Security headers are not explicitly configured in `next.config.ts`. | Add baseline headers. Keep CSP as a separate change after testing inline styles, embeds, media, and setup flow against a restrictive policy. | Done (baseline headers); CSP open |

## Product and design improvements

The current feed has a recognizable theme, strong cast hierarchy, and consistent light/dark modes. Keep those strengths while improving small-screen navigation and daily workflows.

| Priority | Opportunity | Proposed direction | Status |
| --- | --- | --- | --- |
| High | Mobile masthead occupies substantial vertical space. | Prototype a denser phone header while keeping search, notifications, profile, and channel navigation easy to reach. Check at 390px in light and dark mode. | Open |
| High | Feed controls are limited. | Add optional filters for replies and mini app casts alongside the existing recast control. Make active filters visible and easy to reset. | Partial (filters shipped; active summary/reset still open) |
| Medium | Channel tabs are alphabetical and channel selection is limited. | Add channel discovery and manual tab ordering; preserve a useful fallback when no favorites are selected. | Open |
| Medium | Posting a multi-cast thread takes repeated composer work. | Add a thread composer with per-cast byte counts and clear partial-failure recovery. | Done (text-only, up to five casts) |
| Medium | Drafts are not available. | Save drafts locally in the browser first, with explicit controls for restore and delete. Avoid syncing sensitive content without a separate storage decision. | Done (local browser drafts) |
| Later | Settings are spread across several forms. | Group settings by common tasks such as reading, posting, and appearance; retain clear labels and previews. | Open |
| High | Some long posts and embedded content can widen the page on small screens. | Contain the shared app layout and allow long text, URLs, embeds, notifications, and profile metadata to shrink and wrap without removing intentional horizontal tab scrolling. | Done |
| Medium | High-volume accounts and repeated topics can dominate a personal timeline. | Keep keyword/phrase muting and repeated-link grouping optional; expose a per-cast account mute that can be reviewed and undone in settings. | Done |
| Medium | Curated feed lists are harder to scan or edit when people are added over time. | Search followed accounts in both pickers, show a selected count, sort selections for review, and keep remove controls next to each person. | Done |
| Medium | Provider failures are not always distinguishable from empty feeds or broken actions. | Show safe, actionable Neynar/Gemini/ElevenLabs status messages for configuration, authorization, rate-limit, timeout, and temporary availability failures. Preserve already-loaded posts when background polling fails. | Done |

## Change log

### 2026-10-18 — Added account mutes, clearer feed management, and service status

- **Changed:** Cast menus can mute or unmute an author using the existing `@handle` mute setting. Feed filtering now checks the cast author’s handle as well as post text, so the action hides that account across feeds and remains editable under You → Filters.
- **Changed:** Friends and custom-feed pickers both search followed accounts. Selected counts are visible, lists sort alphabetically, and save failures restore the previous list instead of leaving unsaved entries on screen.
- **Changed:** Neynar errors are sanitized and classified in feed pages, profile actions, account lookup, cast actions, and background new-cast checks. Gemini and ElevenLabs report API-key/access, quota, timeout, and temporary service failures without exposing provider response bodies.
- **Changed:** Media wrappers and embed grid children are explicitly width-constrained to the cast column, including video and preview cards.
- **Why:** Give the user control over repeated account/topic noise, make private feed setup easier to maintain, and distinguish a provider outage from an empty feed while keeping already-loaded content usable.
- **Verification:** Local source typecheck, theme contrast checks, production build, and `git diff --check` passed. On the current deployed version, a 390px viewport measured 818px document scroll width; image/link embeds reached 725px wide. At 1440px, the document did not horizontally overflow, but embeds reached 748px inside a 638px feed column. The deployed build predates this source fix, so production must be redeployed before the same content can be verified against the corrected CSS.
- **Upstream discussion:** Narrowed `UPSTREAM-ISSUE-DRAFT.md` to one question about curated feeds and feed-noise controls; it no longer asks the maintainer to consider the full Jackcast feature set.

### 2026-10-18 — Contained app width and added project footer

- **Changed:** Added a shared centered app frame and responsive footer across the app, with links to the original Selfcaster site, GenuineJack's source repository, and this Jackcast fork.
- **Changed:** Constrained feed cards and embeds, notifications, search results, profile metadata, setup text, and the image viewer so intrinsic content does not expand the viewport. Intentional feed tab scrolling remains available.
- **Why:** The page could scroll sideways when long URLs or media used their intrinsic width. Shared width containment and shrinkable content prevent the issue across routes and viewport sizes; the footer gives the fork clear upstream credit.
- **Verification:** At local 390px and 1440px viewport overrides, the document scroll width matched its content viewport; the app content and footer measured 375px (phone layout width accounting for the browser scrollbar) and 640px respectively. `npm run typecheck`, `npm run check:themes`, `npm run build`, and `git diff --check` passed. Full authenticated feed content could not be rendered locally because `NEYNAR_API_KEY` is not configured in this checkout.

### 2026-10-18 — Added optional speech for AI catch-up

- **Changed:** Added an optional ElevenLabs read-aloud action for a completed Gemini digest. Audio generation requires `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`; both remain server-side.
- **Changed:** The same-origin route accepts at most 2,400 characters, has a 20-second provider timeout, returns non-cacheable MP3, and rejects oversized output. The interface permits one audio request per page visit. Audio stays in a temporary browser object URL and is released when the component changes or unmounts.
- **Why:** Make the existing digest easier to consume while keeping speech generation explicit and limiting the text sent to the provider.
- **Privacy and cost:** Gemini receives selected post text and author names. ElevenLabs receives only the digest text. Each provider can bill separately; the UI limit does not replace provider-side usage limits.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit --omit=dev`, `npm run build`, and `git diff --check` passed. The build generated `/api/ai/speech` without the previous workspace-root warning. A tracked-file scan found no populated credentials, private key material, or local machine paths. Live ElevenLabs synthesis still requires a configured voice and was not called during this source build.

### 2026-10-18 — Prepared repository for sharing

- **Changed:** Set Next.js output tracing to the repository root, removed local Windows paths from tracked security notes, and added a concise upstream review summary.
- **Why:** Keep build behavior independent of the owner's surrounding workspace and avoid including local machine details in shareable project documentation.
- **Verification:** Typecheck, theme contrast check, production build, production dependency audit, and diff whitespace check passed. Build output no longer includes an external workspace path. Tracked docs contain no local Windows paths or local username. Git commit author metadata uses a GitHub noreply address.

### 2026-10-18 — Improved feeds, drafts, thread posting, and app security

- **Changed:** Added optional reply and mini app filters, per-route scroll restoration, and a modal full-size image viewer.
- **Changed:** Composer and thread drafts save locally in this browser. Added a text-only thread composer (up to five casts) with partial-send recovery and explicit duplicate-check guidance.
- **Changed:** Added per-process login throttling (five failures, then a 15-minute block), safer provider error messages, and baseline security response headers.
- **Why:** Reduce timeline repetition, preserve reading context, prevent losing unsent writing, and improve practical protections on a single-owner deployment.
- **Changed:** Tightened feed and embed grid minimum sizing after live DOM inspection found image frames wider than their cast columns. The intrinsic image width could still cause horizontal overflow despite the height cap.
- **Verification:** `npm run typecheck`, `npm run check:themes`, full `npm audit`, `npm run build`, and `git diff --check` passed. Build includes `/compose/thread`. Live Gemini catch-up returned a summary from the deployed app. The live 390px feed still shows media overflow; source now constrains cast/embed grid widths, but that fix needs deployment for live confirmation.
- **Limits:** The login limiter is per server process and is not a durable cross-instance rate limit. Add Vercel edge-level limiting for stronger protection. Content Security Policy remains open because inline styles and third-party media need a carefully tested policy.

### 2026-10-18 — Added private Gemini catch-up and fork notes

- **Changed:** Added an optional Following-feed digest, shown only when `GOOGLE_AI_API_KEY` is configured. It runs only on a button press and summarizes at most 20 loaded casts, with author/text limits and a 300-token output cap.
- **Changed:** The server sends only selected public post text and author names to Gemini Flash-Lite. The feature cannot post, react, use search grounding, or access the recovery phrase. API key remains server-side; the route requires same-origin JSON, validates input size and shape, and times out. One successful digest is allowed per page visit to reduce accidental repeat calls.
- **Changed:** Added `.env.example` and `FORK-NOTES.md` to explain setup and the custom fork without replacing upstream attribution.
- **Why:** Offer a useful AI assistant feature while keeping it opt-in, narrow, and cheaper than an open-ended agent. For stronger cost limits, configure spend caps/usage monitoring in AI Studio; provider caps may have processing delay.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit --omit=dev`, `npm run build`, and `git diff --check` passed. Build output includes `/api/ai/catch-up`; it still reports the existing workspace-root warning from the external `pnpm-lock.yaml`.
- **Privacy:** Google receives the selected cast text and author names. Free-tier data-use terms differ from paid-tier terms; review current provider policy before enabling.

### 2026-10-18 — Keep feed media within a balanced size

- **Changed:** Feed image embeds now preserve the full image in a centered, fixed-height frame capped at 420px on desktop and 320px on phones. Video previews and players use matching viewport-aware frames.
- **Changed:** Two-image posts keep their existing square gallery layout, and clicking any image still opens the original media.
- **Why:** Large portrait and vote graphics were dominating the timeline and cropping their content. A smaller responsive cap gives posts a consistent rhythm while retaining the complete image.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit --omit=dev`, and `npm run build` passed. `git diff --check` passed. Build output includes the feed routes and reports the existing workspace-root warning from the external `pnpm-lock.yaml`.
- **Limit:** Live DOM inspection at 390px found some embeds wider than their cards because grid minimum sizing let intrinsic image width overflow. The source now fixes those minimums and adds a full-screen image viewer. The current Vercel deployment still has the old layout until this source change is deployed.

### 2026-10-18 — Group repeated links across feeds

- **Changed:** Added default-on repeated-link grouping to the shared feed renderer, so Following, Friends, custom, channel, and profile feeds show the newest cast for a repeated destination with the other casts in an expandable section.
- **Changed:** Normalize URL host case, `www`, trailing slash, fragments, query ordering, and common tracking parameters before grouping. Only casts with the same complete set of destination URLs are grouped; shared domains and similar wording do not qualify.
- **Changed:** Added a `Group repeated links` switch under You → Filters, and documented how grouping behaves.
- **Why:** A burst of copied announcements or vote links should not consume the whole timeline, while each author’s text, timestamp, and reactions remain available when the group is opened.
- **Product reference:** Uses the familiar collapsed conversation pattern from email clients: keep the newest item visible and let the reader expand the related items.
- **Verification:** `npm run typecheck`, `npm audit`, and `npm run build` passed. Theme checks passed. Build output includes all feed routes and there are no dependency advisories.
- **Limit:** Grouping applies to items on the current fetched page; posts that fall on a later cursor page are not pulled forward to join the current group.

### 2026-10-18 — Added a named custom group feed

- **Changed:** The main feed navigation now has three primary choices: Following, Friends, and a custom feed whose tab name can be edited (for example, Builders or Local).
- **Changed:** Added per-device settings for a second list of up to 10 Farcaster accounts and `/circle`, which loads their chronological feed with existing filters, pagination, caught-up marker, and new-cast polling.
- **Changed:** Added a 3,500-byte guard before saving preferences so two curated lists cannot silently exceed typical browser cookie limits; the UI receives a recovery hint if settings are too large.
- **Changed:** Added an empty state that routes to `/me#custom-feed`, and documented the new feed in `README.md`, `CLAUDE.md`, and `ROADMAP.md`.
- **Why:** One Friends list is useful for close contacts; a second custom list supports another focus without turning the product into a multi-user group platform. The three primary feed choices are visible before channel tabs.
- **Verification:** After the cookie-size guard, `npm run typecheck`, `npm run check:themes`, `npm audit`, and `npm run build` all passed. Build output includes `/circle`. The build continues to report the workspace-root warning due to an external `pnpm-lock.yaml`.
- **Limit:** The group and its name live in the `selfcaster_prefs` cookie on this device. This does not create a Farcaster group or sync across devices.

### 2026-10-18 — Added profile pinning, media view, and banner editing

- **Changed:** Added Posts and Media tabs on Farcaster profile pages. Media pages include image and video casts and walk at most five pages of 30 casts to fill a sparse media view.
- **Changed:** Added a profile setting to pin one of the account's 30 newest casts at the top of its profile in this Selfcaster. It is explicitly app-local and does not claim to pin the cast on Farcaster.
- **Changed:** Added optional banner URL editing through Neynar's profile update API; rendered existing Farcaster profile banners on self and public profiles. The edit field states that Neynar Pro is required.
- **Why:** Profiles now make posts and media easier to browse, let the owner highlight a cast in this private client, and make the existing Farcaster banner field editable.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit`, and `npm run build` passed. Build output includes the updated `/me`, `/me/edit`, and `/u/[username]` routes. Build still reports the external workspace lockfile warning.
- **Limit:** Banner editing depends on Neynar Pro and was not exercised against a live Neynar account. Media classification uses Neynar embed metadata and known image/video URL patterns.

### 2026-10-18 — Improved profile hierarchy and Friends curation

- **Changed:** Added a theme-based cover band and a larger avatar treatment to self and public profile headers, and gave follower/following counts stronger visual emphasis.
- **Changed:** Added an `Add to Friends` / `In Friends` action to public profiles. It saves to the same private device preferences and enforces the existing 10-person limit.
- **Why:** Profiles needed a clearer focal point, and curation is easier while browsing a person's profile than returning to settings to enter their username.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit`, and `npm run build` passed. `/u/[username]` builds with the profile action. Build still reports the external workspace lockfile warning.
- **Design follow-ups:** An editable cover image/color, pinned profile cast, and profile tabs for casts/replies/media are potential next additions; keep them optional and lightweight.

### 2026-10-18 — Added the personal Friends feed

- **Changed:** Added `/friends`, a separate chronological feed for up to 10 selected Farcaster accounts, plus a settings form on `/me` to resolve usernames and add or remove people.
- **Why:** This adds a personal feed choice without changing Following, creating a public Farcaster group, or requiring a database. The feed uses the existing device preferences cookie and remains private app configuration.
- **Changed:** Added the Friends link to feed navigation, Neynar FID-filtered feed fetching, shared mute/quality filtering, pagination, its own caught-up marker, and `/api/head` polling for new casts.
- **Changed:** Documented the feature in `README.md` and `CLAUDE.md`; moved it to shipped in `ROADMAP.md`.
- **Verification:** `npm run typecheck`, `npm run check:themes`, `npm audit`, and `npm run build` passed. Build output includes `/friends`. Build still prints a workspace-root warning because an external lockfile exists above this repository.
- **Limit:** Friends selections are saved on this device. Cross-device sync and named circles remain future work.

### 2026-10-18 — Restored repository hygiene and planned personal feeds

- **Changed:** Added `.gitignore` rules for `node_modules`, Next build output, TypeScript build cache, and generated `next-env.d.ts`; removed those generated artifacts from this checkout.
- **Why:** The repository had no `.gitignore`, so installing dependencies and running a build made more than 25,000 generated files visible as untracked workspace content. Only 78 files are tracked by Git.
- **Changed:** Added a feed roadmap for a Friends feed and private, owner-managed circles, with replies and mini app feed filters.
- **Why:** The app is intended for one person, so private curation of followed accounts fits better than public group features or multi-user infrastructure. Start with one Friends feed and expand only if needed.
- **Verification:** `git status` now lists only intentional source/documentation changes; generated build/dependency files are ignored and removed. `git diff --check` passes. No feature implementation has been made in this step.

### 2026-10-18 — Hardened dependencies, sessions, uploads, and signer setup

- **Changed:** Added a package override resolving PostCSS 8.5.30 while retaining Next.js 15.5.28. The current Next 15.5.28 package pins PostCSS 8.4.31 and the registry has no later 15.5 release available in this review.
- **Why:** The original lockfile contained vulnerable PostCSS 8.4.31. The override removes the reported advisories without an unreviewed Next.js major upgrade.
- **Changed:** Replaced the unkeyed session digest with a versioned HMAC derived from `APP_PASSWORD`. Existing sessions are invalidated and users must log in again after deploying. Cookies remain replayable bearer credentials until they expire; the 90-day lifetime and login rate limiting remain open work.
- **Changed:** Updated Web Crypto byte conversion in session and signer cookie helpers to use `ArrayBuffer`, fixing type errors surfaced by the installed dependency types.
- **Changed:** Capped upload token request bodies at 64 KiB, moved JSON parsing inside error handling, and replaced raw upload exceptions in responses with a generic error while logging server-side details.
- **Changed:** Public image responses now require the stored Blob content type to match the allowlisted extension, set the type from the extension, and include a restrictive CSP and `nosniff`.
- **Changed:** Signer registration validates signer UUID, positive FID, deadline window, and signature shape; signer polling validates UUID format.
- **Verification:** `npm ci` reported zero vulnerabilities; `npm audit` reported zero vulnerabilities; `npm run typecheck`, `npm run check:themes`, and `npm run build` passed. The build emitted a workspace-root warning because an external lockfile exists above the repository; build output lists all app routes.
- **Remaining:** Dependency override should be revisited when Next.js publishes a compatible patched Next 15 version. Rate limiting, shorter session policy, CSP for the full app, and Neynar error sanitization remain open.

### 2026-10-18 — Reviewed recovery phrase handling

- **Changed:** Expanded `SECURITY.md` to distinguish what source review confirms from what cannot be confirmed about a live deployment or the user's browser.
- **Why:** The user entered a recovery phrase after cloning and redeploying the app and needs to know whether this implementation sends it to the server. The setup component uses the mnemonic locally; its server actions receive only the derived address and signed request data.
- **Evidence:** `app/setup/SetupFlow.tsx` reads the input through a ref, clears the field, derives the account with `mnemonicToAccount`, then calls `findAccount(address)` and signs typed data in the browser. `app/setup/actions.ts` defines server actions receiving an address, signer UUID, app FID, deadline, and signature. The session storage record contains signer UUID, approval URL, and sponsorship status.
- **Limit:** This repository inspection cannot verify the deployed revision, browser extensions, injected scripts, or runtime network activity on the user's device. The user should use a clean, updated browser with extensions disabled when entering secrets into a deployment they control. If the phrase was used on an untrusted page or device, create a new wallet and move funds; signer revocation does not rotate the wallet phrase.
- **Verification:** Read the setup client and server action source. No dynamic network capture or deployment inspection was performed.

### 2026-10-18 — Documented initial security and design review

- **Changed:** Clarified in `SECURITY.md` that the session cookie is a replayable credential, added rotation guidance, and linked this plan.
- **Why:** The old wording said the cookie held a hash but did not explain that a captured digest can be replayed. The cookie implementation in `lib/auth.ts` uses plain SHA-256 and `app/actions.ts` sets a 90-day lifetime.
- **Review findings:** Recorded the dependency audit finding (Next.js 15.5.28 resolves PostCSS 8.4.31), session handling, throttling, image serving, upload errors, and upstream error exposure as open work. No implementation fixes have been made yet.
- **Design notes:** Recorded mobile header density, feed filters, channel discovery/order, thread composition, and drafts as product opportunities.
- **Verification:** Inspected the relevant source and lockfile and ran `npm audit --omit=dev`. It reported two findings through the installed Next.js dependency tree, including high severity PostCSS advisories. No application tests or build were run for this documentation-only change.

## Updating this plan

When implementing an item:

1. Change its status to `In progress` before multi-step work and `Done` only after the fix is in the code.
2. Add a dated change-log entry with files or behavior changed, why the chosen fix addresses the finding, and the checks run with their results.
3. Update `SECURITY.md` whenever the documented security behavior changes.
4. Keep unresolved risks marked `Open`; do not present audit findings or planned controls as fixed.
