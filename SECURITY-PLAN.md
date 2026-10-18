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
| Medium | Login has no throttling, so password guessing can consume app resources. | Add bounded rate limiting appropriate to the deployment runtime and return generic login errors. Consider edge-level protection as an additional control. | Open |
| Medium | Signer setup can create signer requests and poll Neynar without app-level throttling. | Validate signer IDs and request data at the server boundary; rate-limit signer creation and polling; cap polling duration and request frequency. | Open |
| Medium | The public image route trusts the Blob object's `image/*` content type and serves it at the app origin. | Verify the stored type and extension agree; restrict served formats; set `X-Content-Type-Options` and a restrictive content security policy for image responses. | Done (response checks) |
| Medium | Upload route parses arbitrary JSON before its error handler and returns exception messages. | Bound request body size, handle malformed JSON consistently, return generic client errors, and keep diagnostic details in server logs. Confirm Blob SDK callback validation remains enabled. | Done (body cap and generic errors) |
| Medium | Signer setup accepts signer request data from the browser. | Validate UUID, FID, deadline, and signature shapes before forwarding them to Neynar. | Done (input validation) |
| Medium | Server actions can return raw Neynar messages to the browser. | Map expected upstream errors to safe, actionable messages and log bounded diagnostics server-side without credentials or user secrets. | Open |
| Low | Security headers are not explicitly configured in `next.config.ts`. | Review and add appropriate headers, including a considered Content Security Policy. Test app styles, embeds, media, and setup flow against the selected policy. | Open |

## Product and design improvements

The current feed has a recognizable theme, strong cast hierarchy, and consistent light/dark modes. Keep those strengths while improving small-screen navigation and daily workflows.

| Priority | Opportunity | Proposed direction | Status |
| --- | --- | --- | --- |
| High | Mobile masthead occupies substantial vertical space. | Prototype a denser phone header while keeping search, notifications, profile, and channel navigation easy to reach. Check at 390px in light and dark mode. | Open |
| High | Feed controls are limited. | Add optional filters for replies and mini app casts alongside the existing recast control. Make active filters visible and easy to reset. | Open |
| Medium | Channel tabs are alphabetical and channel selection is limited. | Add channel discovery and manual tab ordering; preserve a useful fallback when no favorites are selected. | Open |
| Medium | Posting a multi-cast thread takes repeated composer work. | Add a thread composer with per-cast byte counts, attachment limits, and clear partial-failure recovery. | Open |
| Medium | Drafts are not available. | Save drafts locally in the browser first, with explicit controls for restore and delete. Avoid syncing sensitive content without a separate storage decision. | Open |
| Later | Settings are spread across several forms. | Group settings by common tasks such as reading, posting, and appearance; retain clear labels and previews. | Open |

## Change log

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
- **Verification:** `npm ci` reported zero vulnerabilities; `npm audit` reported zero vulnerabilities; `npm run typecheck`, `npm run check:themes`, and `npm run build` passed. The build emitted a workspace-root warning because `C:\Users\xoopc\pnpm-lock.yaml` exists outside the repo; build output lists all app routes.
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
