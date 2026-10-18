# Roadmap

Ideas for Selfcaster, grouped by what they do for you. PRs welcome; open an issue first for anything big. Nothing here is committed until it moves to **Next up**.

Effort: **S** an evening, **M** a weekend, **L** a few sessions.
Storage: **none** (just Farcaster/Neynar), **browser** (this device only), **blob** (Vercel Blob for files), **db** (a small database so it syncs across devices).

Out of scope on purpose: DMs.

## Shipped

Chronological Following and Friends feeds with caught-up line and new casts pill, favorite channels (tabs + composer), Friends curation from profiles, refreshed profile headers, photos (public or private Blob store), videos and inline players, quote casts, search, muted words, quality dial, show or hide recasts, cast stats, edit profile, color themes with light and dark, one-click Deploy button.

## Next up

_Pick from below._

## Make feeds more personal

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Small circles | Named private groups such as Friends, Local, or Builders, each with its own feed. The groups are private app settings and do not create or publish a Farcaster group. | L | browser initially; db for sync |
| Replies toggle | Hide replies in Following while keeping replies visible on cast detail pages. | S | browser |
| Mini app toggle | Hide casts dominated by mini app embeds when you want a quieter feed. | S | browser |

Design constraints for group feeds: chronological ordering, obvious group identity, empty-state guidance, no surprise posting to a group, and a visible indicator when a cast is also in another feed. Preserve the existing Following and channel feeds as separate choices.

Recommended sequence: start with the single Friends feed from selected accounts, learn whether that is enough, then expand to named circles only if you need more than one curated group.

## Post better

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Thread composer | Write a multi-cast thread in one go, posted as a reply chain. | M | none |
| Drafts | Start a cast, come back later. | S | browser, or db to sync |

## Channels

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Channel browser | Search and browse channels, follow and unfollow right in the app. | M | none |
| Arrange tabs | Reorder tabs by hand (picking which ones show is shipped; they sort A to Z). | S | browser, or db |
| Channels mix | One feed of everything happening in your channels. | S | none |

## Read better

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Lists | Hand-picked feeds of specific people: builders, friends, your city. | M | db |

## Keep it calm

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Feed toggles | Hide mini app casts, replies on or off (the recasts toggle is shipped). | S | browser |

## Your stuff

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Bookmarks | Save casts to come back to. | S | db |
| Synced settings | Mutes, favorites and theme follow you across devices. | M | db |

## Power moves

| Idea | What it does | Effort | Storage |
| --- | --- | --- | --- |
| Keyboard shortcuts | `j`/`k` to move, `l` like, `r` reply, `c` compose. | S | none |
| While you were out | An optional summary of what happened since your last visit. Needs an AI API key. | M | db |
| Scheduled casts | Write now, post later. | M | db |
