# Jackcast fork notes

Jackcast is an open-source, personal customization of [Selfcaster by GenuineJack](https://github.com/GenuineJack/selfcaster). This repository is [wlplease/jackcast](https://github.com/wlplease/jackcast); it keeps the upstream project's MIT license and credits the original author. The [README](./README.md) documents how to deploy this Jackcast repository, while this page records the custom direction and maintenance notes for the fork.

## What this fork adds

- Private Friends and named custom feeds (up to 20 accounts each), a 90-day activity scan capped at 1,000 posts, and a weekly batch check for saved Friends. Suggestions are cached for 24 hours; the saved-Friends batch is cached for seven days.
- A Recasts tab before the custom feed. It separates casts introduced by Neynar's `withRecasts` Following feed from ordinary posts; standard feeds keep recasts off. Neynar does not identify the exact account that recasted a cast in this response, so the UI does not guess at the actor.
- Feed filters for replies, mini apps, recurring words/topics, and account handles. A cast menu can mute a prolific account; the handle appears in the normal mute list so it is easy to review and undo. Repeated links can also be grouped.
- Profile Posts/Media views, a locally pinned cast, and optional profile cover editing.
- Feed media sizing tuned for desktop and phone screens.
- A Mini Apps hub with Neynar's weekly trending and user-relevant catalogs, search, category filters, up to six saved apps per device, and a Dev page for creator-attributed apps found in recent casts.
- A dedicated settings page at `/me`, a separate profile and analytics page at `/profile`, and append-on-scroll Following and Friends feeds with manual fallback.
- An optional, user-triggered Gemini catch-up digest from the header AI icon with optional ElevenLabs read-aloud. It returns a concise storyline followed by 2–4 topic sections, with redo/clear controls. Gemini receives a bounded batch of loaded public posts; ElevenLabs receives only the generated digest. Both features are server-keyed, opt-in, and unable to post or take account actions.
- Clearer Neynar, Gemini, and ElevenLabs errors distinguish missing configuration, rejected credentials, rate limits, timeouts, and temporary provider outages. Failed feed polling leaves loaded posts in place and reports that refresh failed.
- Security and design decisions tracked in [SECURITY-PLAN.md](./SECURITY-PLAN.md); future ideas in [ROADMAP.md](./ROADMAP.md).

## Keeping it current

Review upstream releases and changes before syncing. Prefer small, focused merges and inspect conflicts in files this fork customizes, especially `app/globals.css`, `components/Feed.tsx`, `lib/data.ts`, and this README. Run the checks listed in [CLAUDE.md](./CLAUDE.md) after resolving changes. Keep API keys and deployment values in local/Vercel environment settings; never commit them.

This fork is for one owner's deployment. Personal feed lists and preferences are not a public group feature. AI summaries and speech are optional; see the privacy and cost notes in [README.md](./README.md). A concise, shareable feature and security summary is in [RELEASE-NOTES.md](./RELEASE-NOTES.md).
