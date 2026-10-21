# Security

Jackcaster runs on your own Vercel account, for one person: you. It is a personal fork of Selfcaster. Here's what it does with the sensitive stuff, and where to check.

For production bot protection and Vercel Firewall setup, see the [Vercel deployment security guide](./docs/VERCEL-SECURITY.md). App notices and `noindex` metadata do not replace edge controls.

## Your recovery phrase

Posting requires a Farcaster signer authorized by the custody wallet for your Farcaster account. Identity sign-in by itself does not grant posting permission. This clone currently requests the custody signature in the browser; it does not have a supported approval flow that avoids entering the Farcaster account recovery phrase. That phrase controls the account's custody wallet and may control onchain assets. This is separate from the app's optional wallet-connect flow for Base transactions. If you are unsure what your phrase controls, do not enter it.

Before continuing, use only a deployment you control on a trusted, updated device and browser. Read-only browsing does not need a phrase. The setup page displays this warning before the input and again beside it.

`/setup` makes the signer authorization signature in your browser:

- The phrase is read straight from a password field, used once by [viem](https://viem.sh)'s `mnemonicToAccount` to sign a single key request, and the field is wiped.
- It is never put in app state, never sent to the server, never written to storage, and never logged. Only the resulting signature leaves the page.
- The input is password-masked and cleared on submit, page hide, page exit, and component unmount. Failed attempts do not retain the phrase for retry.
- `/setup` has a route-specific Content Security Policy with a fresh per-request nonce for app scripts, no frames, no external connections, no objects, and no third-party analytics. The page uses only the app's bundled code and same-origin server actions while the phrase is entered.
- The code is in [`app/setup/SetupFlow.tsx`](./app/setup/SetupFlow.tsx) and [`middleware.ts`](./middleware.ts). Read it before entering anything.

If you'd rather not use your main phrase at all, create a separate Farcaster account just to request the key, and approve it from your main account.

### What this code review can confirm

In this repository's setup flow, the phrase is read from the password input in `app/setup/SetupFlow.tsx`, used by `viem` in the browser to derive the custody address and sign typed data, and the input is cleared before network calls. The server actions in `app/setup/actions.ts` accept the derived address, signer request details, and signature; they do not accept a mnemonic. The pending request saved to `sessionStorage` contains the signer UUID, approval URL, and sponsorship flag, not the phrase. The setup CSP is enforced by `middleware.ts`; the theme style receives the request nonce from `app/layout.tsx`. Analytics does not render on `/setup`.

This is evidence about the checked-in source code only. It cannot prove which code was served by a live deployment, what browser extensions or injected scripts were present, or what happened on a particular device. CSP reduces some script-injection risk but is not proof that a page or device is safe. For a deployment you control, compare its deployed source/revision to this code and use a clean, updated browser with extensions disabled for sensitive setup. If the phrase was entered into an untrusted clone, an unexpected page, or a device/browser you do not control, treat it as exposed and move funds to a new wallet; revoking the Farcaster signer alone does not rotate the wallet phrase.

## Your password

The middleware protects app pages and API routes; login, static assets, and the public posted-image route are exceptions. `APP_PASSWORD` gates access. Each successful login creates a random, versioned session token authenticated with an HMAC derived from the password; the server checks the signature and issuance time on every protected request. Sessions expire after 30 days, and changing `APP_PASSWORD` invalidates them. Use a long, unique password and protect access to your browser and deployment. A stolen current cookie remains a replayable bearer credential until it expires or the password changes.

Login allows five attempts per client address in a 15-minute window. When Upstash Redis is configured, an atomic shared counter coordinates this limit across serverless instances; the Redis key contains an HMAC fingerprint, not the raw IP. If Redis is absent or unavailable, the app falls back to a process-local best-effort counter, so add Vercel Firewall rate limiting for edge-wide protection. Successful login clears the shared counter. Protected responses are marked private and non-cacheable. Signing out clears the app session and this device’s signer cookie; it does not revoke the signer in Farcaster, so revoke it there separately if needed. Treat session cookies as bearer credentials and rotate `APP_PASSWORD` if one may have been exposed. Remaining limitations are tracked in [`SECURITY-PLAN.md`](./SECURITY-PLAN.md).

One route is public on purpose: `/i/...`, which serves photos you've already posted (from a private Blob store) so other Farcaster clients can show them. It only serves `casts/` and `pfp/` image files.

## Your keys

`NEYNAR_API_KEY` lives in your Vercel environment and is only used on the server. The Farcaster signer is approved per device and stored in a signed, HttpOnly cookie. A legacy `SIGNER_UUID` environment variable is ignored for posting, preventing a deployment-wide account from being used accidentally.

To cut off access: revoke the app in Farcaster settings (connected apps), and rotate your Neynar key at dev.neynar.com.

## Private messages

The initial `/messages` feature uses a distinct 24-word Nostr DM recovery phrase. It is not the Farcaster recovery phrase or a provider API key. Jackcast encrypts the key in this browser with a local passphrase, and the message client unlocks it only in the browser. It locks after 15 minutes without pointer or keyboard activity and clears decrypted messages and key material when the page is hidden or closed. The user's custody wallet signs a typed statement binding the DM public key to the FID; the public binding is checked against the current Farcaster custody address before messaging. The private key and recovery phrase are not sent to Jackcast servers or Nostr relays.

Messages use the draft NIP-17 format over Nostr relays. The relay receives ciphertext and delivery metadata, including its routing tag; operators can retain or copy events. NIP-17 does not provide Signal-style forward secrecy. A malicious deployment can serve JavaScript that steals a key while it is unlocked, and a compromised device can read plaintext or the recovery phrase. Do not use DMs for high-risk secrets. The feature has not had an independent security audit. The recovery phrase is the only portable recovery path; if it and the device key are lost, Jackcast cannot restore the identity or old messages. No DM data or rules are stored in Firebase.

The `/messages` route does not load Vercel usage analytics. The design and current limitations are tracked in [`docs/DM-ARCHITECTURE.md`](./docs/DM-ARCHITECTURE.md).

Keep `.env*` files and provider secrets out of Git. Configure `APP_PASSWORD`, `NEYNAR_API_KEY`, and optional Google, ElevenLabs, Blob, and GIPHY keys only in the appropriate server environment or browser setting. Baseline response headers allow geolocation only to Jackcaster itself for the opt-in map; the referrer policy sends origins without page paths, and `/setup` uses `no-referrer`. A strict, nonce-based CSP is enforced on `/setup`; a compatible policy for the full app remains separate because it uses dynamic embeds, media, and Mini App integrations. Rerun `npm audit` before each release.

## Usage analytics

Vercel Web Analytics is included and can be enabled in the deployment dashboard. Page-view URLs are normalized before sending: profile names, cast hashes, channel names, and query strings are removed. Custom events count broad actions such as feed opens, successful casts, Mini App launches, digest generation, and GIF searches. Events contain only coarse categories (for example, feed type or whether a GIF key is personal); they never include cast text, FIDs, usernames, search terms, GIF URLs, map coordinates, or wallet addresses. Analytics reports aggregate usage, not a list of identifiable users.

## Location sharing

The community globe is opt-in and separate from casting. After you tap **Share my approximate area** and allow browser location, the device immediately rounds the coordinates into a 2° grid cell (roughly 220 km north-to-south). Jackcaster stores only that area ID and public Farcaster profile fields in Firebase; exact coordinates and reported accuracy are not sent to a server. The location request starts with the browser's lower-power location mode and retries once with GPS if the device cannot return a fix. Pins are public to users of the Firebase project and removable from the map. Browser location can be spoofed, and Firebase Anonymous Auth does not verify that a submitted FID belongs to the anonymous session. Sharing requires the public Firebase Web App config, Anonymous Auth, and the area-pin rules in [`docs/FIREBASE-SHARED-RULES.md`](./docs/FIREBASE-SHARED-RULES.md). The browser also requires HTTPS and permission for this site; if permission was previously denied, change it in browser and device settings.

## Reporting a problem

Found a vulnerability? Please don't open a public issue. Open a [private security advisory](https://github.com/GenuineJack/selfcaster/security/advisories/new) on GitHub, or DM [@genuinejack](https://farcaster.xyz/genuinejack) on Farcaster.

## Security change record

Security and design work is tracked in [`SECURITY-PLAN.md`](./SECURITY-PLAN.md). Each implementation entry should record the date, files or behavior changed, reason, and checks run. Keep this document aligned with the actual code; a planned item is not a completed fix.
