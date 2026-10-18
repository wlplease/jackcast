# Security

Selfcaster runs on your own Vercel account, for one person: you. Here's what it does with the sensitive stuff, and where to check.

## Your recovery phrase

Farcaster requires every new app key to be approved with a signature from your account's custody wallet. `/setup` makes that signature in your browser:

- The phrase is read straight from a password field, used once by [viem](https://viem.sh)'s `mnemonicToAccount` to sign a single key request, and the field is wiped.
- It is never put in app state, never sent to the server, never written to storage, and never logged. Only the resulting signature leaves the page.
- The code is in [`app/setup/SetupFlow.tsx`](./app/setup/SetupFlow.tsx), around `phraseRef`. Read it before you paste anything.

If you'd rather not use your main phrase at all, create a separate Farcaster account just to request the key, and approve it from your main account.

## Your password

`APP_PASSWORD` gates every page and API route (`middleware.ts`). The cookie holds a hash, not the password. Anyone with the password can post as you, so make it long and don't reuse it.

One route is public on purpose: `/i/...`, which serves photos you've already posted (from a private Blob store) so other Farcaster clients can show them. It only serves `casts/` and `pfp/` image files.

## Your keys

`NEYNAR_API_KEY` and `SIGNER_UUID` live in your Vercel environment variables and are only used on the server. Neither ever reaches the browser. A `SIGNER_UUID` only works with the API key that created it.

To cut off access: revoke the app in Farcaster settings (connected apps), and rotate your Neynar key at dev.neynar.com.

## Reporting a problem

Found a vulnerability? Please don't open a public issue. Open a [private security advisory](https://github.com/GenuineJack/selfcaster/security/advisories/new) on GitHub, or DM [@genuinejack](https://farcaster.xyz/genuinejack) on Farcaster.
