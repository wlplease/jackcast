# Jackcast — change summary for Selfcaster

Jackcast is a personal fork of [Selfcaster by GenuineJack](https://github.com/GenuineJack/selfcaster). This note summarizes the additions for upstream review. The upstream project and its author remain credited in the [README](./README.md), and the existing MIT license is retained.

## What changed

- **Separate feeds:** Added private Friends and named custom feeds, each with up to 20 selected accounts. Friends recommendations rank followed accounts by activity in a 180-day window, with a 1,000-post scan cap and a 24-hour cache. Followed-account search and channel directories are cached for an hour.
- **Feed controls:** Added reply and mini-app filters, repeated-link grouping, per-feed scroll restoration, new-cast and caught-up markers, and an expandable image viewer. Cast menus can mute prolific accounts through the reversible `@handle` filter. Feed images, video, and link cards are constrained to the cast column.
- **Friend and custom feeds:** Followed accounts can be searched in either feed picker; selected counts, alphabetical lists, and direct removal make device-local lists easier to review.
- **Service status:** Feed errors and failed new-cast checks explain whether Neynar needs configuration, is rate-limiting, or is temporarily unavailable. Gemini and ElevenLabs errors identify key/access, quota, timeout, and provider availability issues.
- **Profiles:** Added Posts and Media tabs, an app-local pinned cast, profile header improvements, and optional cover editing through Neynar.
- **Composer:** Added browser-local drafts, quote and media improvements, and a text thread composer for up to five casts with recovery guidance after a partial send.
- **Optional AI:** Added an on-demand Gemini digest for up to 20 loaded Following posts. A separate optional ElevenLabs action can read the digest aloud. Both API keys stay server-side; speech receives only the digest and is not stored by Jackcast.
- **Security and maintenance:** Added baseline response headers, safer server error handling, bounded upload and AI requests, signer input validation, and best-effort login throttling. `SECURITY-PLAN.md` records decisions, verification, and remaining limits.

## Scope and privacy

This deployment is configured as a single-owner client. Personal feeds and preferences are saved on that device. The recovery phrase is not part of Jackcast's server configuration. AI features are disabled unless their corresponding server environment variables are configured, and provider costs and data terms remain the operator's responsibility. See [README.md](./README.md) for deployment and provider details.

## Review notes

These changes reflect one user's workflow and are offered for consideration; they are not assumed to fit Selfcaster's product direction. Individual feed, profile, composer, or security changes can be reviewed or adapted independently. The source repository is [wlplease/jackcast](https://github.com/wlplease/jackcast).

## Suggested upstream post

Hi GenuineJack — I built Jackcast as an open-source personal fork of Selfcaster and have documented the changes and security decisions. It explores separate Friends and custom feeds, feed filters and repeated-link grouping, profile Posts/Media and pinned casts, drafts and recoverable threads, and an optional Gemini summary of Following posts with ElevenLabs read-aloud. The fork keeps Selfcaster attribution and the MIT license. I’ve included deployment notes and verification results here: [Jackcast](https://github.com/wlplease/jackcast). These are personal-client changes for review; feel free to use or adapt any parts that fit Selfcaster.

## Checks for this snapshot

The checks below are filled in after validating the release candidate:

- Typecheck: passed (`npm run typecheck`)
- Theme contrast check: passed (`npm run check:themes`, all theme/mode combinations)
- Dependency audit: passed (`npm audit`, zero vulnerabilities)
- Production build: passed (`npm run build`); `/api/ai/speech` is included and the external workspace-root warning is gone
- Secret and personal-data scan: no populated credential values, private-key material, local Windows paths, or local username in tracked files; `.env.example` contains blank placeholders
- Git author metadata: one GitHub noreply address; no personal email in commit metadata
- Diff review: passed (`git diff --check`); changes remain uncommitted in the working tree
- Live provider check: not performed; ElevenLabs needs `ELEVENLABS_API_KEY` (or the existing deployment's accepted alias), `ELEVENLABS_VOICE_ID`, and a valid provider quota
