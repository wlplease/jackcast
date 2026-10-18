# Draft issue for Selfcaster

**Target:** [GenuineJack/Selfcaster issues](https://github.com/GenuineJack/selfcaster/issues)

**Status:** Draft only. This has not been submitted.

**Tracker check:** Checked the public issue tracker on 2026-10-18; it showed no open issues, and the public issues API returned no issue records. Search again before posting in case the tracker has changed.

## Title

Would you be open to reviewing selected Jackcast improvements upstream?

## Body

Hi GenuineJack — I’ve been using Selfcaster as the foundation for **Jackcast**, an open-source personal fork for my own Farcaster workflow. Thanks for making Selfcaster available. Jackcast keeps the upstream MIT license and credits Selfcaster in its README and app footer.

I’ve added several independent features and documented the changes in [the Jackcast repository](https://github.com/wlplease/jackcast):

- Separate Friends and named custom feeds, with followed-account search and cached activity-based friend suggestions.
- Feed controls for replies and mini apps, repeated-link grouping, per-feed scroll restoration, and responsive media sizing.
- Profile Posts and Media views, a pinned cast, optional cover editing, browser-local drafts, and a thread composer with partial-send recovery.
- Optional, user-triggered Gemini catch-up with ElevenLabs read-aloud. Both are disabled unless configured; provider keys stay server-side, and the README describes data handling and cost considerations.
- Security and reliability improvements such as bounded uploads and AI requests, signer input validation, safer server errors, baseline response headers, and best-effort login throttling.

These changes reflect one user's needs, so I don’t assume they fit Selfcaster’s direction. Would any of these be useful upstream, and if so, would you prefer focused pull requests for individual features or another contribution path? I’m happy to split out only the parts that fit.

For this Jackcast snapshot, typecheck, theme contrast checks, and the production build pass. The fork’s [change summary](https://github.com/wlplease/jackcast/blob/main/RELEASE-NOTES.md) and [maintenance notes](https://github.com/wlplease/jackcast/blob/main/FORK-NOTES.md) describe the implementation and trade-offs in more detail.
