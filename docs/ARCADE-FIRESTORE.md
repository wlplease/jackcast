# Jumping Jacks leaderboard

The weekly leaderboard uses the isolated Firestore path `jackcaster_arcade/weeks/{week}/scores/{firebaseUid}`. Personal bests also stay on the device. The optional shared board uses Firebase Web SDK anonymous sign-in and Firestore rules; Jackcaster does not use Firebase Admin SDK or service-account credentials.

For setup, the exact mergeable rules covering the leaderboard, GIPHY cooldown, and opt-in city globe are in [FIREBASE-SHARED-RULES.md](./FIREBASE-SHARED-RULES.md). The leaderboard query needs no composite index. Scores are community-reported and are not proof of Farcaster identity or verified gameplay.
