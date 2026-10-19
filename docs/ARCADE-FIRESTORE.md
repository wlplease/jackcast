# Jackcaster arcade weekly leaderboard

The game uses an isolated Firestore path: `jackcaster_arcade/weeks/{week}/scores/{firebaseUid}`. It does not read or write any other app's collections. Personal bests remain in local storage. When Firebase is configured, the weekly top 20 is shared and each anonymous Firebase account can write only its own score document.

## Firebase setup

1. In Firebase Console, create/select the project and register a Web app.
2. Under **Authentication → Sign-in method**, enable **Anonymous**.
3. Under **Firestore Database → Rules**, merge the rule block below into the existing rules. Keep existing app rules intact. Check for any broad wildcard rule that grants writes: matching Firestore `allow` rules are combined with OR, so a permissive catch-all would also grant access to this collection.
4. In the Jackcaster Vercel project, add these public Firebase Web App values to the app environment (Production and Preview as desired), then redeploy when you choose. These values are public client config, not service-account credentials:

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

   No deploy is triggered by this code change. The game falls back to the personal/device leaderboard until all four values are available.

## Rules to merge

Paste this `match` block inside your existing `service cloud.firestore { match /databases/{database}/documents { ... } }`. Do not replace the rest of your shared app rules with this block.

```firestore
match /jackcaster_arcade/weeks/{week}/scores/{uid} {
  function signedIn() {
    return request.auth != null;
  }

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
  allow create: if signedIn()
    && uid == request.auth.uid
    && validScore();
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

## Security limits

This protects other users' documents, disallows deletes, limits score/field shapes, preserves a submitted best score, and throttles updates. Anonymous Firebase Auth does **not** prove the row's FID belongs to that person, and client-side game scores cannot be made cheat-proof with Firestore rules. Treat this as a casual, community-reported board, not a verified competition. A verified leaderboard needs a server endpoint that validates Farcaster identity and gameplay/rate limits before writing; never place a Firebase Admin service-account key in client code or `NEXT_PUBLIC_*` variables.

The collection query orders by score descending and limits to 20. It needs no composite index. Keep each app's data under its own named collection path to avoid collisions with the shared project.
