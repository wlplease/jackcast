# Security

Jackcaster runs on your own Vercel account, for one person: you. It is a personal fork of Selfcaster. Here's what it does with the sensitive stuff, and where to check.

For production bot protection and Vercel Firewall setup, see the [Vercel deployment security guide](./docs/VERCEL-SECURITY.md). App notices and `noindex` metadata do not replace edge controls.

## Your recovery phrase

Farcaster requires every new app key to be approved with a signature from your account's custody wallet. `/setup` makes that signature in your browser:

- The phrase is read straight from a password field, used once by [viem](https://viem.sh)'s `mnemonicToAccount` to sign a single key request, and the field is wiped.
- It is never put in app state, never sent to the server, never written to storage, and never logged. Only the resulting signature leaves the page.
- The code is in [`app/setup/SetupFlow.tsx`](./app/setup/SetupFlow.tsx), around `phraseRef`. Read it before you paste anything.

If you'd rather not use your main phrase at all, create a separate Farcaster account just to request the key, and approve it from your main account.

### What this code review can confirm

In this repository's setup flow, the phrase is read from the password input in `app/setup/SetupFlow.tsx`, used by `viem` in the browser to derive the custody address and sign typed data, and the input is cleared before the network calls. The server actions in `app/setup/actions.ts` accept the derived address, signer request details, and signature; they do not accept a mnemonic. The pending request saved to `sessionStorage` contains the signer UUID, approval URL, and sponsorship flag, not the phrase.

This is evidence about the checked-in source code only. It cannot prove which code was served by a live deployment, what browser extensions or injected scripts were present, or what happened on a particular device. For a deployment you control, compare its deployed source/revision to this code and use a clean, updated browser with extensions disabled for sensitive setup. If the phrase was entered into an untrusted clone, an unexpected page, or a device/browser you do not control, treat it as exposed and move funds to a new wallet; revoking the Farcaster signer alone does not rotate the wallet phrase.

## Your password

The middleware protects app pages and API routes; login, static assets, and the public posted-image route are exceptions. `APP_PASSWORD` gates access. The session cookie contains a versioned HMAC derived from the password; it does not contain the password itself. Anyone who obtains the cookie can replay it to access the app until the password changes or the cookie expires. Use a long, unique password and protect access to your browser and deployment. The HMAC prevents offline guessing against a stolen cookie as easily as an unkeyed hash, but it does not prevent replay.

Login applies a best-effort, process-local limit of five failed attempts per client address followed by a 15-minute block. Serverless instances do not share this counter, so it is not a durable edge-level rate limit. Sessions last 90 days. Treat the cookie as a bearer credential and rotate `APP_PASSWORD` if you suspect it was exposed. Remaining limitations are tracked in [`SECURITY-PLAN.md`](./SECURITY-PLAN.md).

One route is public on purpose: `/i/...`, which serves photos you've already posted (from a private Blob store) so other Farcaster clients can show them. It only serves `casts/` and `pfp/` image files.

## Your keys

`NEYNAR_API_KEY` and `SIGNER_UUID` live in your Vercel environment variables and are only used on the server. Neither ever reaches the browser. A `SIGNER_UUID` only works with the API key that created it.

To cut off access: revoke the app in Farcaster settings (connected apps), and rotate your Neynar key at dev.neynar.com.

Keep `.env*` files and provider secrets out of Git. Configure `APP_PASSWORD`, `NEYNAR_API_KEY`, and optional Google, ElevenLabs, Blob, and GIPHY keys only in the appropriate server environment or browser setting. Jackcaster has baseline response headers; a full Content Security Policy remains open because the app depends on inline theme styles, embeds, media, and Mini App integrations. Rerun `npm audit` before each release.

## Location sharing

The community globe is opt-in and separate from casting. The browser reads location only after you tap **Use GPS** and grant permission. Coordinates are matched to the nearest city in the bundled offline gazetteer, then discarded in the browser. Custom city choices come from the same gazetteer. Nothing is saved until you confirm. Firebase stores the GeoNames city ID, city, country, and public Farcaster profile fields; exact GPS coordinates are not sent to Jackcaster's server or Firebase. Confirmed pins are readable by any Firebase-authenticated client with access to this project, including anonymous sessions, so treat them as public. Remove your pin any time. The local gazetteer match confirms that a city record exists, not that the user is physically there. Browser GPS can be spoofed, Firebase Anonymous Auth does not verify a Farcaster FID, and the Firestore rules cannot verify that a city ID/name pair came from the bundled file. The normal app flow only offers gazetteer choices, but direct clients can write forged claims under the current anonymous-client model.

## Reporting a problem

Found a vulnerability? Please don't open a public issue. Open a [private security advisory](https://github.com/GenuineJack/selfcaster/security/advisories/new) on GitHub, or DM [@genuinejack](https://farcaster.xyz/genuinejack) on Farcaster.

## Security change record

Security and design work is tracked in [`SECURITY-PLAN.md`](./SECURITY-PLAN.md). Each implementation entry should record the date, files or behavior changed, reason, and checks run. Keep this document aligned with the actual code; a planned item is not a completed fix.
