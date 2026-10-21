# Jackcaster source summary

This document summarizes the current repository source. It is not a versioned release announcement and does not indicate that these changes have been pushed or deployed.

## Current feature set

- Chronological Following with caught-up and new-cast indicators, incremental loading, and per-device reading position.
- Private Top Friends (up to 50), Top Accounts, Recasts, a named custom feed, channel feeds, Saved casts, and Media filters for images, video, and audio.
- A Sent feed for casts and replies carrying Jackcaster source attribution, with post-type and date filters across loaded history.
- Per-device controls to reorder built-in feed tabs and hide feeds from the header; Following remains visible and hidden feeds stay available in **More**.
- Neynar feed-by-accounts batching at 10 FIDs per request, with bounded scans and cached discovery; details are in [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md).
- Composer support for photos, links, replies, quotes, threads with per-cast photos, GIFs, and links, browser-local drafts, GIPHY search, and a local meme maker. Cast sharing opens a cast composer with the source post embedded.
- Inline feed media and a top-bar soundtrack player with eight bundled tracks and up to three personal HTTPS tracks. Playback is user initiated.
- Mini Apps discovery, search, categories, bookmarks, creator discovery, Farcaster-native launching, and a large browser preview with minimize-to-tray behavior.
- Profile Posts/Media views, analytics for 7/30/90 days and loaded casts, app-local pinned cast, and optional Farcaster profile cover editing.
- Optional, user-triggered Gemini digest with storyline, source-linked topics, and activity insights; optional ElevenLabs read-aloud.
- Seven-day AI catch-up fetches recent Following pages as needed, offers retry/load-more controls, and reports analyzed sample coverage; digests use at most 40 posts.
- Optional Base donations to the original Selfcaster developer or Jackcaster using USDC or an approximate ETH amount, with wallet approval.
- Centralized settings, search suggestions, notification controls, sign-out confirmation, and explicit links to Selfcaster, Jackcaster, and the original creator.
- Baseline security headers, bounded request bodies and uploads, sanitized provider errors, and login throttling coordinated through Upstash when configured (with a process-local fallback).

## Fork identity

Jackcaster is the personal open-source fork in [wlplease/jackcast](https://github.com/wlplease/jackcast). It builds on [Selfcaster by GenuineJack](https://github.com/GenuineJack/selfcaster), keeps the upstream MIT license and attribution, and is not an official Selfcaster release. See [`FORK-NOTES.md`](./FORK-NOTES.md).

## Limits to keep visible

- Preferences and saved lists are stored per device, not synced between browsers.
- Sent includes only casts with Jackcaster's explicit source attribution; it does not identify posts sent through other clients.
- Settings reports optional integration configuration, not provider uptime or quota.
- Neynar creator indexing can miss published Mini Apps; Dev discovery is best-effort, not a complete registry.
- The 90-day account activity rankings use bounded scans; a ranking may be incomplete when the scan cap is reached.
- Neynar feed filters accept at most 10 FIDs per request. Larger lists are supported through multiple bounded requests.
- Mini App browser previews do not have Farcaster-host wallet or native action access.
- Login throttling uses a shared Upstash counter when configured, then falls back to a process-local counter. Vercel Firewall protection remains a deployment-level hardening step.
- Gemini and ElevenLabs have separate provider terms, quotas, and possible costs. Review [`SECURITY.md`](./SECURITY.md) and `README.md` before enabling them.

## Local verification

For the commands and UI review expected before an owner-approved release, see [`CLAUDE.md`](./CLAUDE.md). A successful local build does not confirm a live Neynar, Gemini, ElevenLabs, Blob, wallet, or Farcaster-host integration.
