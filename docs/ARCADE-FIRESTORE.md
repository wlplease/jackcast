# Arcade leaderboard: Firebase setup

The Jumping Jacks game currently saves personal bests and a local leaderboard in the player's browser. It does **not** write scores to Firestore. The app signs users in with its own shared app-password cookie and Farcaster signer; that is not Firebase Authentication. Firestore Security Rules cannot verify that Jackcaster session or prove that a submitted FID belongs to the browser user.

Do not deploy a rule such as `allow write: if true`, and do not put Firebase Admin credentials or service-account JSON in the repo or browser. Both would let anyone forge scores or overwrite another player's row.

## Requirements before enabling shared scores

Choose one identity bridge:

1. Add Firebase Authentication (for example, anonymous Firebase Auth) and bind one score document to `request.auth.uid`. This prevents users from changing another user's row but does not prove the Firebase user owns a Farcaster FID. Display a Firebase-generated player name, or add a server-verified link between Firebase UID and Farcaster FID.
2. Implement a trusted server endpoint that verifies a signed Firebase ID token, derives the FID from a server-verified account link, rate limits submissions, and writes a bounded best score with server credentials held only in server environment variables. If using this option, Firebase rules can deny all client writes.

Only after choosing the identity model should the shared weekly board UI and rules be activated. Rules/indexes depend on the final document schema; avoid pasting a permissive example into production.

## Firebase web config

Firebase web config is public and is not an admin credential. If using Firebase Auth later, provide the web app config through `NEXT_PUBLIC_FIREBASE_CONFIG` as a JSON object. Never include a service-account key, private key, or Admin SDK credential in this variable.

No composite index is needed for the current local-only game. For a future shared board, sort at most 100 records by score descending for a selected week; a collection-group/schema change may require a Firestore composite index. Create the index Firestore requests after the final schema is implemented and verified.
