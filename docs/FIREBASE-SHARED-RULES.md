# Jackcaster Firebase rules (Web SDK only)

Jackcaster uses the Firebase **Web SDK** and Firebase Security Rules. It does not use Firebase Admin SDK, a service account, or privileged server access. Enable **Authentication → Sign-in method → Anonymous** in the Firebase project. If this is off, the browser reports `auth/admin-restricted-operation` / `auth/operation-not-allowed` even though the app does not use Firebase Admin.

## Merge into a shared rules file

In Firebase Console → **Firestore Database → Rules**, keep your existing `rules_version`, `service cloud.firestore`, database match, and all rules for your other apps. Paste only the four Jackcaster `match` blocks below inside the existing `match /databases/{database}/documents { ... }`, alongside the other collections. Do not paste a second outer `service` or database block. The paths are isolated so each app keeps its own collection rules.

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

match /jackcaster_shared_limits/giphy/slots/global {
  function signedIn() { return request.auth != null; }

  function validLock() {
    return request.resource.data.keys().hasAll(['lastUsedAt'])
      && request.resource.data.keys().hasOnly(['lastUsedAt'])
      && request.resource.data.lastUsedAt == request.time;
  }

  allow get: if signedIn();
  allow create: if signedIn() && validLock();
  allow update: if signedIn()
    && validLock()
    && request.time > resource.data.lastUsedAt + duration.value(45, 's');
  allow delete: if false;
}

match /jackcaster_shared_limits/giphy/users/{uid} {
  function signedIn() { return request.auth != null; }

  function validLock() {
    return request.resource.data.keys().hasAll(['lastUsedAt'])
      && request.resource.data.keys().hasOnly(['lastUsedAt'])
      && request.resource.data.lastUsedAt == request.time;
  }

  allow get: if signedIn() && uid == request.auth.uid;
  allow list: if false;
  allow create: if signedIn() && uid == request.auth.uid && validLock();
  allow update: if signedIn()
    && uid == request.auth.uid
    && validLock()
    && request.time > resource.data.lastUsedAt + duration.value(5, 'm');
  allow delete: if false;
}

match /jackcaster_map/pins/pins/{uid} {
  function signedIn() { return request.auth != null; }

  function validPin() {
    return request.resource.data.keys().hasAll([
        'fid', 'username', 'displayName', 'pfpUrl', 'place', 'updatedAt'
      ])
      && request.resource.data.keys().hasOnly([
        'fid', 'username', 'displayName', 'pfpUrl', 'place', 'updatedAt', 'lat', 'lon'
      ])
      && request.resource.data.fid is int
      && request.resource.data.fid > 0
      && request.resource.data.username is string
      && request.resource.data.username.size() > 0
      && request.resource.data.username.size() <= 32
      && request.resource.data.displayName is string
      && request.resource.data.displayName.size() <= 48
      && request.resource.data.pfpUrl is string
      && request.resource.data.pfpUrl.size() <= 256
      && request.resource.data.place is string
      && request.resource.data.place.size() > 0
      && request.resource.data.place.size() <= 80
      && request.resource.data.updatedAt == request.time
      && (
        (!request.resource.data.keys().hasAny(['lat', 'lon']))
        || (request.resource.data.keys().hasAll(['lat', 'lon'])
          && request.resource.data.lat is number
          && request.resource.data.lat >= -90
          && request.resource.data.lat <= 90
          && request.resource.data.lon is number
          && request.resource.data.lon >= -180
          && request.resource.data.lon <= 180)
      );
  }

  allow get, list: if signedIn();
  allow create: if signedIn() && uid == request.auth.uid && validPin();
  allow update: if signedIn()
    && uid == request.auth.uid
    && validPin()
    && request.resource.data.fid == resource.data.fid;
  allow delete: if signedIn() && uid == request.auth.uid;
}
```

### What each path stores

- `jackcaster_arcade/...`: one anonymous-user score per weekly board. Scores remain community-reported; rules cannot prove gameplay or link the Firebase UID to the submitted Farcaster FID.
- `jackcaster_shared_limits/...`: the shared GIPHY timestamp plus one cooldown document per Firebase anonymous UID. The atomic app transaction allows one free shared search globally every 45 seconds (up to 80 requests/hour), and limits each persistent browser session to one shared search every five minutes so one session cannot repeatedly win consecutive slots. Each user record contains only `lastUsedAt`; Firebase rules prevent a user from changing their own cooldown early.
- `jackcaster_map/...`: public, opt-in map pins. Each anonymous UID may create, update, or delete only its own pin, but Anonymous Auth is open to anyone with the public Firebase Web config, so these rules do not make pins private to Jackcaster accounts. Users review and confirm locally before the browser writes a pin. GPS coordinates are rounded in the browser first; exact GPS is not sent to Jackcaster's app server or stored. Typed places are shared as entered after confirmation and omit coordinates. Farcaster FID/profile fields are self-reported by the browser and are not identity-verified by Firebase rules.

Firestore combines matching `allow` rules with OR. Audit existing wildcard rules: a broad `allow write: if true` on a parent path can make any narrower rule ineffective. Do not add service-account credentials or Firebase Admin SDK to Jackcaster.

## Indexes

The included [`firestore.indexes.json`](../firestore.indexes.json) has no composite indexes because these queries use only a single field (`score` or `updatedAt`), which Firestore indexes automatically. If you manage indexes through Firebase CLI, deploy the file with `firebase deploy --only firestore:indexes`; do not replace any existing production index configuration without merging it first.

## Setup checklist

1. Enable Anonymous sign-in.
2. Merge the four match blocks into the existing shared rules and publish them.
3. Configure the Firebase **Web App** values as `NEXT_PUBLIC_FIREBASE_CONFIG` or the four `NEXT_PUBLIC_FIREBASE_*` variables in `.env.example`. These are public client config values, not secrets.
4. Set `GIPHY_APP` as a server-only Vercel variable to turn on the free shared GIPHY search. No user key is required; the shared pool is first-come-first-served, one search per 45 seconds globally. Each browser session is limited to one shared search per five minutes. Users can optionally save their own GIPHY key in the picker; it stays in that browser and is sent directly to GIPHY, bypassing the shared pool.
5. No Firebase Admin SDK, Admin key, or index creation is required.
