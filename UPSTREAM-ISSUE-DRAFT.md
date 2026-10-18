# Draft issue for Selfcaster

**Target:** [GenuineJack/Selfcaster issues](https://github.com/GenuineJack/selfcaster/issues)

**Status:** Draft only. This has not been submitted.

**Tracker check:** Checked the public issue tracker on 2026-10-18; it showed no open issues, and the public issues API returned no issue records. Search again before posting in case the tracker has changed.

## Title

Would a curated feed and feed-noise controls fit Selfcaster?

## Body

Hi GenuineJack — I’ve been using Selfcaster as the foundation for **Jackcast**, an open-source personal fork for my own Farcaster workflow. Thanks for making Selfcaster available. Jackcast keeps the upstream MIT license and credits Selfcaster in its README and app footer.

One workflow improvement I’d like your input on is keeping a busy Following feed readable without changing its chronological order. Jackcast experiments with:

- A private Friends feed and a second named feed, each built from accounts the owner already follows.
- Search by display name or username when selecting accounts, with a compact selected-account list that can be edited in place.
- Optional reply and mini-app filters, repeated-link grouping, and manual `@handle` mutes for prolific accounts or unwanted conversations.

These are personal-client features, and the lists stay in the owner’s device settings. I’m not proposing that Selfcaster adopt the whole fork. Would a focused curated-feed or noise-control feature fit the project? If so, what boundaries or UX would you want considered before I prepare a small pull request?

The [Jackcast README](https://github.com/wlplease/jackcast#jackcast-and-selfcaster) summarizes the fork; [FORK-NOTES.md](https://github.com/wlplease/jackcast/blob/main/FORK-NOTES.md) and [RELEASE-NOTES.md](https://github.com/wlplease/jackcast/blob/main/RELEASE-NOTES.md) contain the broader maintenance and change notes. The typecheck, theme contrast check, and production build pass for this source snapshot.
