# Jackcaster roadmap

This roadmap is a list of ideas, not a promise or release schedule. Jackcaster is a personal, single-owner fork of [Selfcaster](https://github.com/GenuineJack/selfcaster); keep that relationship and the upstream MIT attribution clear. Do not push or deploy a change without the owner's decision.

## Shipped in this source

- Chronological Following, Top Friends (up to 50), Top Accounts, Recasts, custom feeds, channel feeds, Saved, and Media views.
- Neynar FID batching at 10 accounts per request; bounded activity discovery and request budgets. See [Neynar usage](./docs/NEYNAR-USAGE.md).
- Per-device filters, channel tabs, saved posts and Mini Apps, custom account lists, themes, and audio URLs.
- Search for casts, people, and channels; notifications with mark-read controls.
- Composer with images, links, quote/reply, text threads, local drafts, GIF search, and a local meme maker.
- Inline feed video and audio, plus a user-initiated soundtrack player with bundled and personal tracks.
- On-demand AI digest with sourced sections and insights; optional text-to-speech.
- Mini Apps catalog, categories, search, saved apps, developer discovery, native Farcaster launching, and a nearly full-screen browser preview with a minimize tray.
- Profile posts/media, profile analytics, pinned cast, theme-aware settings, security headers, and best-effort login throttling.

## Useful next refinements

| Idea | Why it may help | Constraint |
| --- | --- | --- |
| Reorder channel tabs | Keep the channels used most in reach. | Keep settings local and preserve the current selected-channel fallback. |
| Add a real shared-device preference option | Device cookies do not follow the owner across browsers. | Requires an explicit storage and account-security decision; the app is currently single-owner, not multi-tenant. |
| Improve long-session feed memory | Many loaded cards can increase browser memory use. | Must preserve scroll position, duplicate-link expansion, and digest source posts. |
| Durable login throttling | The current five-failure block is process-local and does not span serverless instances. | Needs host-level or shared storage rate limiting; do not claim the local limiter is comprehensive. |
| Better Mini App registry coverage | Neynar creator indexing may omit published apps. | Use official Farcaster attribution or a clear manual-add path; never claim Neynar search is complete. |
| Spaces discovery | Live conversations could complement cast feeds. | First verify reliable Neynar discovery data and native Farcaster join support. If only external links are supported, label and open them as such. |

## Product boundaries

- Keep Following chronological and separate from Friends, Top, Media, and AI catch-up.
- Keep account selection, filters, bookmarks, themes, and personal audio private to this device unless sync is deliberately designed.
- Do not imply that a browser Mini App preview has Farcaster wallet or native-host capabilities.
- DMs, ads, autonomous AI actions, and multi-user hosting are out of scope for this fork.

## Before choosing more features

Review Neynar request patterns and limits in [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md), the current behavior in [`README.md`](./README.md), and the fork boundaries in [`FORK-NOTES.md`](./FORK-NOTES.md). Prefer improving reliability and discoverability of shipped features over adding duplicate surfaces.
