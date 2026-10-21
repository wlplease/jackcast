# Jackcaster Firebase rules (Web SDK only)

Jackcaster uses the Firebase **Web SDK** and Firebase Security Rules only for the optional arcade leaderboard. The community map uses Nostr relays and does not need Firebase. Jackcaster does not use Firebase Admin SDK, a service account, or privileged server access. Enable **Authentication → Sign-in method → Anonymous** only if you use the leaderboard. GIF search does not use Firebase.

## Merge into a shared rules file

In Firebase Console → **Firestore Database → Rules**, keep your existing `rules_version`, `service cloud.firestore`, database match, and all rules for your other apps. Paste the Jackcaster arcade `match` block below inside the existing `match /databases/{database}/documents { ... }`, alongside the other collections. Do not paste a second outer `service` or database block.

```firestore
match /jackcaster_arcade/weeks/{week}/scores/{uid} {
  function signedIn() { return request.auth != null; }

  function validScore() {
    return request.resource.data.keys().hasAll(['fid', 'username', 'score', 'playedAt'])
      && request.resource.data.keys().hasOnly(['fid', 'username', 'score', 'playedAt'])
      && request.resource.data.fid is int
      && request.resource.data.fid > 0
      && request.resource.data.username is string
      && request.resource.data.username.size() > 0
      && request.resource.data.username.size() <= 32
      && request.resource.data.score is int
      && request.resource.data.score >= 0
      && request.resource.data.score <= 1000
      && request.resource.data.playedAt == request.time;
  }

  allow get, list: if signedIn();
  allow create: if signedIn() && uid == request.auth.uid && validScore();
  allow update: if signedIn()
    && uid == request.auth.uid
    && validScore()
    && request.resource.data.fid == resource.data.fid
    && request.resource.data.username == resource.data.username
    && request.resource.data.score >= resource.data.score
    && request.time > resource.data.playedAt + duration.value(10, 's');
  allow delete: if false;
}
```

### What each path stores

- `jackcaster_arcade/...`: one anonymous-user score per weekly board. Scores remain community-reported; rules cannot prove gameplay or link the Firebase UID to the submitted Farcaster FID.
- GIF cooldowns are stored in Upstash Redis, not Firebase. See the GIPHY setup in the [README](../README.md#gifs-and-memes-in-the-composer). No GIF Firestore rules are needed.
- The community area map uses Nostr events and does not store map pins in Firebase.
- Paid profile-animation audit is not stored in Firebase. Anonymous Firebase Auth cannot verify a Farcaster signer or FID, so Jackcaster uses the signed-in server session, contract events, and replay-protected Vercel Blob request records for those actions instead.

Firestore combines matching `allow` rules with OR. Audit existing wildcard rules: a broad `allow write: if true` on a parent path can make any narrower rule ineffective. Do not add service-account credentials or Firebase Admin SDK to Jackcaster.

## Indexes

The included [`firestore.indexes.json`](../firestore.indexes.json) has no composite indexes because these queries use only a single field (`score` or `updatedAt`), which Firestore indexes automatically. If you manage indexes through Firebase CLI, deploy the file with `firebase deploy --only firestore:indexes`; do not replace any existing production index configuration without merging it first.

## Setup checklist

1. Enable Anonymous sign-in only if you use the arcade leaderboard.
2. Merge the arcade match block into your existing shared rules and publish it.
3. Configure the Firebase **Web App** values as `NEXT_PUBLIC_FIREBASE_CONFIG` or the four `NEXT_PUBLIC_FIREBASE_*` variables in `.env.example`. These are public client config values, not secrets.
4. The Nostr based community map and GIF search are separate and need no Firebase Auth, config, rules, or indexes.
5. No Firebase Admin SDK, Admin key, or composite index creation is required.
