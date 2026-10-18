# Jackcast fork notes

This repository is a personal, single-owner Selfcaster deployment based on the open-source [GenuineJack/Selfcaster](https://github.com/GenuineJack/selfcaster). The upstream README remains the setup guide; this page summarizes the custom direction in this fork.

## What this fork adds

- Private Friends and named custom feeds, feed filters, and repeated-link grouping.
- Profile Posts/Media views, a locally pinned cast, and optional profile cover editing.
- Feed media sizing tuned for desktop and phone screens.
- An optional, user-triggered Gemini catch-up digest. It only receives a small batch of loaded post text and cannot post or take account actions.
- Security and design decisions tracked in [SECURITY-PLAN.md](./SECURITY-PLAN.md); future ideas in [ROADMAP.md](./ROADMAP.md).

## Keeping it current

Review upstream releases and changes before syncing. Prefer small, focused merges and inspect conflicts in files this fork customizes, especially `app/globals.css`, `components/Feed.tsx`, `lib/data.ts`, and this README. Run the checks listed in [CLAUDE.md](./CLAUDE.md) after resolving changes. Keep API keys and deployment values in local/Vercel environment settings; never commit them.

This fork is for one owner's deployment. Personal feed lists and preferences are not a public group feature. AI summaries are optional; see the AI privacy and cost note in [README.md](./README.md).
