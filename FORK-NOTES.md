# Jackcaster fork notes

Jackcaster is an open-source personal customization of [Selfcaster by GenuineJack](https://github.com/GenuineJack/selfcaster). The app is named **Jackcaster**; the repository is [wlplease/jackcast](https://github.com/wlplease/jackcast). This fork keeps the upstream MIT license and credits the original project. It is maintained separately and is not an official Selfcaster release.

## What this fork adds

- **Separate reading views:** Following, Top Friends, Top Accounts, Recasts, one named custom feed, Saved casts, and a media-focused feed. Recasts do not spill into the normal Following/Friends feeds.
- **Private curation:** Top Friends supports up to 50 accounts. The Top Accounts view combines a curated list with the viewer's most active follows. The custom list supports up to 20. These settings are stored on the device, do not change follows, and do not create Farcaster groups.
- **Bounded Neynar pulls:** feed-by-account requests are split into groups of at most 10 FIDs. Activity scans and directory scans have explicit page/request caps and cache windows. See [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md).
- **Reading and creation tools:** local saved casts, repeated-link grouping, reply/mini-app/mute/quality controls, search for casts/people/channels, GIF search, meme captions, browser-local drafts, and recoverable text threads.
- **Media and listening:** inline image/video/audio embeds, a media feed, a top-bar soundtrack player with eight bundled tracks, and up to three personal HTTPS tracks.
- **Mini Apps:** weekly trending and network-relevant discovery, search, saved apps, creator discovery, native Farcaster launch, and a nearly full-screen browser preview that can minimize to a tray.
- **Profiles and analytics:** profile posts/media views, 7/30/90-day posting metrics, a device-local pinned cast, and optional Neynar Pro profile cover editing.
- **Optional AI:** a manual Gemini digest with a storyline, cited topic sections, and activity insights; optional ElevenLabs read-aloud. Provider keys stay server-side, and the digest is kept separate from the normal feed.
- **Support options:** optional direct USDC or ETH donations to the original Selfcaster developer or Jackcaster on Base, available in Settings and Dev.
- **Navigation and safety:** settings in one place, a sign-out confirmation, upstream and fork attribution in the footer and Dev section, baseline response headers, bounded uploads, and Upstash-coordinated login throttling when configured (with a process-local fallback).

## What remains upstream

Selfcaster remains the original app, repository, product direction, and upstream source. Jackcaster-specific choices do not change Selfcaster or its users. Use upstream commits as an opportunity to review and selectively merge improvements; do not assume the codebases remain identical.

## Maintenance

1. Review upstream changes at [GenuineJack/Selfcaster](https://github.com/GenuineJack/selfcaster) before merging.
2. Read this fork's source changes in `app/`, `components/`, and `lib/`, especially `lib/data.ts`, `app/globals.css`, `components/Feed.tsx`, and account setup.
3. Keep feature and API limit descriptions aligned across `README.md`, [`CLAUDE.md`](./CLAUDE.md), [`docs/NEYNAR-USAGE.md`](./docs/NEYNAR-USAGE.md), and [`ROADMAP.md`](./ROADMAP.md).
4. Run the appropriate local checks, review the diff, and let the owner decide when to push to GitHub or deploy. This project does not require automatic deployments.
5. Keep API keys, signer identifiers, recovery phrases, personal data, and `.env.local` out of commits.

The exact copied source snapshot and upstream reference are recorded in
[`PROVENANCE.md`](./PROVENANCE.md). Review the local Mini App SDK and Core
patches in [`vendor/miniapp-sdk/JACKCASTER-PATCH.md`](./vendor/miniapp-sdk/JACKCASTER-PATCH.md)
and [`vendor/miniapp-core/JACKCASTER-PATCH.md`](./vendor/miniapp-core/JACKCASTER-PATCH.md).

For deployment and provider costs, see [`README.md`](./README.md). For recovery-phrase and session details, see [`SECURITY.md`](./SECURITY.md). The current feature summary is in [`RELEASE-NOTES.md`](./RELEASE-NOTES.md).
