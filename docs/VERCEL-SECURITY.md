# Protecting a Jackcaster Vercel deployment

Jackcaster already gates app pages and API routes behind `APP_PASSWORD`, uses secure HTTP-only session cookies, applies baseline security headers, and keeps Neynar and the shared GIPHY key on the server. The app is also marked `noindex`. Search-engine instructions and legal notices are not security controls; actual access checks, rate limits, and edge challenges are.

## Challenge login traffic

The repository's [`vercel.json`](../vercel.json) applies Vercel's browser challenge to `/login` requests. This adds an edge check before the password form and login action reach the app. It does not affect other paths, and it does not replace the password or login attempt limit. After deploying, test sign-in from your normal browser and from the Farcaster in-app browser; a browser challenge may add a one-time checkpoint.

Vercel also offers Bot Protection as a managed ruleset. If you enable it for the whole project, start in **Log** mode, inspect normal browser and Farcaster traffic, then switch to **Challenge** if legitimate traffic is handled cleanly. The path-specific `vercel.json` challenge remains focused on `/login`.

## Turn on Vercel's bot challenge

The Vercel Bot Protection managed rule is off by default and is available on all plans. It challenges traffic that does not behave like a normal browser. Configure it in the Vercel dashboard for the Jackcaster project:

1. Open **Firewall → Rules → Bot Management → Bot Protection**.
2. Start in **Log** mode and review live traffic while using Jackcaster normally, including inside Farcaster.
3. If legitimate visits work as expected, change the rule to **Challenge**, then **Review Changes → Publish**.
4. Recheck regular browser sign-in, Farcaster Mini App launch, posting, and GIPHY after enabling it.

Challenge behavior is controlled in the Vercel dashboard, not by this repository. Keep Vercel's platform DDoS mitigation enabled. Vercel WAF custom rule quotas and rate-limit availability depend on the current plan; if the dashboard offers rate limiting, start by applying a modest per-IP limit to `/login` and expensive API routes, observe it, then enforce it. Don't put a challenge on every request before checking Mini App compatibility.

## Keep the shared client safe

- Use a long, unique `APP_PASSWORD` and share it only with people trusted to use the connected Farcaster signer. Every person admitted by this single-owner password gate can access the same account and posting capabilities.
- Keep `NEYNAR_API_KEY`, `SIGNER_UUID`, `GIPHY_APP`, Upstash Redis credentials, and AI provider keys in Vercel's server-side Environment Variables. Never expose them with a `NEXT_PUBLIC_` prefix or in a cast.
- Keep the Firebase Web config public by design, but merge only the narrow rules in [FIREBASE-SHARED-RULES.md](./FIREBASE-SHARED-RULES.md). Anonymous Auth is used only for the optional map and arcade features, not GIF search.
- The shared GIF route validates same-origin requests, a signed HttpOnly browser-session cookie, input size, query length, result offsets, and GIPHY media hosts. Upstash Redis atomically enforces the global 45-second limit across Vercel instances plus a five-minute per-session cooldown. The route fails closed if Redis is unavailable; Firebase sign-in is not used for GIFs.
- Optional personal GIPHY keys are saved in browser local storage and sent directly to GIPHY. Jackcaster's server does not receive them. Do not save a personal key on a device other people use.
- Do not rely on notices or hidden text to confuse bots. They do not stop automated requests and can make the interface harder for people and assistive technology.

## Know the limits

Login uses an atomic Upstash counter across serverless instances when the Upstash REST URL and token are configured. If Redis is absent or unavailable, it falls back to a process-local counter, so keep the Vercel edge challenge and consider a dashboard WAF rate-limit rule for `/login` as an additional control. Rotate the app password and provider keys if you suspect they were exposed.
