# Jackcaster roadmap

This roadmap is a list of ideas, not a promise or release schedule. Jackcaster is a personal, single-owner fork of [Selfcaster](https://github.com/GenuineJack/selfcaster); keep that relationship and the upstream MIT attribution clear. Do not push or deploy a change without the owner's decision.

## Shipped in this source

- Chronological Following, Friends (up to 50), Leaders, Recasts, custom feeds, channel feeds, Saved, and Media views.
- Neynar FID batching at 10 accounts per request; bounded activity discovery and request budgets. See [Neynar usage](./docs/NEYNAR-USAGE.md).
- Per-device filters, reorderable channel tabs, saved posts and Mini App favorites, custom account lists, editable feed labels, themes, and audio URLs.
- Search for casts, people, and channels; notifications with mark-read controls.
- Composer with images, links, quote/reply, text threads, local drafts, GIF search, and a local meme maker.
- Inline feed video and audio, plus a user-initiated soundtrack player with bundled and personal tracks.
- On-demand AI digest with cited source posts, an expandable full sample list, insights, and optional text-to-speech.
- Mini Apps catalog, categories, search, favorites, recent apps, developer discovery, native Farcaster launching, and a nearly full-screen browser preview with a minimize tray.
- Profile posts/media, profile analytics, pinned cast, theme-aware settings, security headers, and best-effort login throttling.

## Useful next refinements

Prioritize reliability and user control before adding another large feed:

| Idea | Why it may help | Constraint |
| --- | --- | --- |
| Improve notification state and refresh feedback | A badge is only useful when read state and provider delays are clear. | Keep the UI honest when Neynar cannot provide a definitive unread count; avoid frequent polling. |
| Improve long-session feed memory | Many loaded cards can increase browser memory use, especially on phones. | Must preserve scroll position, duplicate-link expansion, and digest source posts. |
| Better Mini App registry coverage | Neynar creator indexing may omit published apps. | Improve creator attribution when official data is available and make clear that Neynar search is not complete. |
| Optional cross-device preference sync | Device cookies do not follow the owner across browsers. | Requires durable storage, clear account ownership, and a deliberate security model; the app is currently single-owner, not multi-tenant. |
| Durable login throttling | The current five-failure block is process-local and does not span serverless instances. | Needs host-level or shared storage rate limiting; do not claim the local limiter is comprehensive. |
| Spaces discovery | Live conversations could complement cast feeds. | First verify reliable discovery data and native Farcaster join support. If only external links are supported, label and open them as such. |
| Saved post collections | Saved casts are useful, but one flat reading list can become hard to browse. | Keep collections private and device-local unless sync is deliberately designed. |

## Product boundaries

- Keep Following chronological and separate from Friends, Top, Media, and AI catch-up.
- Keep account selection, filters, bookmarks, themes, and personal audio private to this device unless sync is deliberately designed.
- Do not imply that a browser Mini App preview has Farcaster wallet or native-host capabilities.
- DMs, ads, autonomous AI actions, and multi-user hosting are out of scope for this fork.

## Before choosing more features

Review Neynar request patterns and limits in [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md), the current behavior in [`README.md`](./README.md), and the fork boundaries in [`FORK-NOTES.md`](./FORK-NOTES.md). Prefer improving reliability and discoverability of shipped features over adding duplicate surfaces.
