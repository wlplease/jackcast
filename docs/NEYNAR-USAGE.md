# Neynar usage and pull budgets

Jackcaster makes Farcaster API calls on the server through the Neynar Node.js SDK. This page describes the current code paths and their bounded request behavior; it does not estimate credit charges because Neynar plan pricing and endpoint weights can change.

## Account-filtered feeds

Neynar's feed filter accepts at most **10 FIDs per request**. That is a per-request limit, not a limit on the number of accounts the app can follow.

| View | Accounts | Current request pattern |
| --- | ---: | --- |
| Following | Your follows | One feed request per page; recasts are disabled here. |
| Top Friends | Up to 50 selected accounts | Split into groups of 10, so at most 5 feed requests per page. Groups are fetched in parallel and merged newest-first. |
| Custom | Up to 20 selected accounts | Split into groups of 10, so at most 2 feed requests per page. |
| Top Accounts | Up to 20 curated leaders plus 20 active follows | Deduplicated, then split into groups of 10; at most 4 feed requests per page. |
| Recasts | People you follow | Up to 2 requests per page: with and without recasts, to identify casts introduced by recasting. Neynar's response does not identify which followed person recasted each cast. |
| Media | People you follow | One Following-feed request per cursor page, then local media filtering. When a page has no matching media, the client can advance through a small bounded number of cursors. |

The current request limits and grouping code live in [`lib/data.ts`](../lib/data.ts). Keep all FID-filtered feed calls behind the shared `groupFeedFids` helper. Do not send more than 10 FIDs in a single feed request.

## Discovery and activity scans

- **Top Friends suggestions:** scans up to 10 Following-feed pages of 100 casts (1,000 casts maximum), stopping when the 90-day cutoff is reached. Results are cached per viewer for 24 hours.
- **Saved Friends activity check:** splits up to 50 accounts into 10-FID groups and uses a hard budget of 10 feed requests (up to 1,000 casts total) per check. Results are cached for a week. A manual refresh bypasses only that viewer's cached result; it does not invalidate other viewers' entries.
- **Top Accounts leaders:** the curated usernames are resolved individually and cached for 24 hours. The viewer's active-follow scan reuses the Top Friends suggestions cache.
- **Mini Apps discovery:** the weekly catalog and viewer-relevant results are cached for a week. Search is on demand. Creator discovery is cached for six hours and combines Neynar search, cached catalogs, and up to 100 recent casts.
- **Followed account and channel directories:** loaded only when needed and cached per viewer for one hour. The account directory is bounded to 20 pages of 100 follows; the channel directory is bounded to 10 pages of 100 channels.
- **Profile analytics:** one user lookup and one request for up to 100 recent casts; cached for five minutes per FID.
- **Saved posts:** up to 30 cast hashes are fetched in one bulk-casts request.
- **New-cast checks and notification badge:** the Following header check polls at most once per minute while visible; the notification count refreshes at most every five minutes while visible. Opening Notifications separately loads its page of results.

## Operational guidance

1. Load another feed page only when the reader asks or approaches the end of the list. Keep cursor tokens scoped to the account groups that created them.
2. Preserve bounded scans and cache slow discovery data. User-triggered refreshes should bypass only the requesting viewer's cache.
3. Keep API keys server-side. Never log API keys, signer values, recovery phrases, or full private preferences.
4. If a provider change allows fewer requests, compare the returned cast coverage, order, viewer context, and filtering semantics before replacing the current batching.
5. For current endpoint details, consult the [Neynar feed reference](https://docs.neynar.com/reference/fetch-feed), [Node.js SDK](https://github.com/neynarxyz/nodejs-sdk), and [Neynar pricing](https://neynar.com/pricing).

## When changing a feed

- Confirm the FID maximum and result limit in the installed SDK/API reference.
- Add a defensive batch-size constant rather than relying on callers to pass a valid group.
- Keep requests paginated and bound any loops by both request count and result count.
- Check that per-viewer caches include the viewer in their key and that a manual refresh cannot flush unrelated viewers' cached work.
- Update this document and the corresponding feature note in `README.md` when a request pattern or cache lifetime changes.
