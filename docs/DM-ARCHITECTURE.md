# Jackcast direct messages: design and security boundary

## Decision

Use Farcaster FID as the human identity, a separate Nostr key as the messaging key, and Nostr relays as the transport. Do not use Firebase for messages, require a Matrix account, or reuse a Farcaster recovery phrase as an encryption key. The already-approved Farcaster posting signer is reused only to publish the explicit public proof cast. All Jackcast deployments use the same published relay defaults and message format, so users can message across deployments without sharing a Jackcast database.

The first DM setup generates a random Nostr key locally. After an explicit review, the user's already-approved Jackcast Farcaster signer publishes a public cast binding that FID to the DM public key. No new wallet connection or sign-in is requested. The private key is never uploaded. A Nostr identity event signed by the DM key carries the Farcaster proof cast hash as a discovery pointer; deployments verify the cast author FID and exact public-key text through Farcaster before trusting the mapping. The pointer is not itself identity proof. A key change requires a new explicit public Farcaster proof and must be shown to contacts.

## Recovery

There is no API key for a user to save. The item to back up is the separate DM recovery phrase. The first-use screen shows it, requires the user to confirm one randomly selected word, and asks them to choose a matching local unlock passphrase of at least 16 characters. The phrase restores the same Nostr key on another device. The browser stores an AES-GCM ciphertext protected with a PBKDF2-derived key; it never stores the unlock passphrase. Locking clears the active in-memory key. The app also locks after 15 minutes without pointer or keyboard activity and clears decrypted messages and key material when the page is hidden or closed. The phrase is not sent to a server, analytics, logs, or crash reports.

If the user loses both the device key and its DM recovery phrase, Jackcast cannot restore that identity or decrypt the old messages. A new Farcaster proof can authorize a new identity, but cannot recover the old one. The Farcaster recovery seed is used only in the existing `/setup` flow to approve the Farcaster signer; DMs reuse that signer and never request or retain the seed. Explain DM-key recovery limits before enabling DMs. Do not offer a server-held recovery key or silently escrow a decrypting secret.

## Message protocol and privacy

Use the NIP-17 private direct message draft (NIP-44 encryption wrapped with NIP-59 gift wraps), never the deprecated NIP-04 format. The client publishes a signed kind-10050 inbox-relay list and sends each recipient's encrypted event only to that recipient's advertised inbox relays; it sends the sender's encrypted copy to the sender's inbox relays. The first implementation uses three public relay defaults; a user-facing relay editor is not included yet. Relays carry encrypted events and may retain them for offline delivery. Relay operators do not receive plaintext.

NIP-17 is not Signal's Double Ratchet and does not give the same forward-secrecy guarantee. A later compromise of a long-lived DM key may expose stored ciphertext. Do not label this “Signal-level,” “perfect forward secrecy,” or “unbreakable.” If forward secrecy and post-compromise recovery are release requirements, wait for a production-ready, independently reviewed browser MLS implementation and interoperable Nostr MLS profile (NIP-EE); do not write an MLS implementation or bridge ourselves.

Gift wrapping reduces direct sender attribution on relay events, but relays can still observe traffic patterns and recipient routing information. Messages are persistent on independent relays and may be copied; a user's delete request cannot guarantee erasure from every relay or recipient device. The recipient can always copy plaintext. DMs do not interoperate with Farcaster Direct Casts.

## Trust model

- A Farcaster-authored public proof cast establishes the FID-to-key mapping; it does not prove the key is safe or that the account owner is benevolent. The cast is public and may be deleted or hidden by the account.
- Verify the proof cast's author FID and exact key through Farcaster before starting a conversation. Show the verified FID, key fingerprint, and any key change. Fail closed if Farcaster identity data is unavailable or the proof does not match. Existing wallet-signed identities remain verifiable during migration.
- Relays are untrusted delivery/storage. Encrypt before publishing and validate event signatures, recipient tags, size, and time bounds on receipt.
- A Jackcast web deployment can serve modified JavaScript. E2EE protects against relay/database operators and honest server-side code; it cannot protect a user who enters/unlocks their key in malicious code served by a deployment. Keep `/setup` protections, avoid third-party scripts on DM/key screens, publish source/release identity, and recommend trusted deployments. A browser extension signer can be a later option so the site never handles the private key.
- FID proof in the current Jackcast HttpOnly cookie is deployment-local. It is not sufficient as a cross-deployment identity credential. The public Farcaster proof cast is required for new identities.

## Implementation status

The repository now contains an initial text-DM client with NIP-17 reply references, local encrypted key storage/recovery, explicit Farcaster-cast FID binding (and legacy custody-wallet-signed binding support), DM-key-signed Nostr discovery records, advertised inbox relays, recipient verification/key-change checks, and local message-request blocking. Replies use the NIP-17 parent-event `e` tag inside the encrypted message rumor. It uses `nostr-tools` and does not store messages in Firebase. No new Firebase rules or server secrets are required.

This is not yet independently audited or ready to describe as fully secure. NIP-17 is currently a draft, and this app's protocol adapter and onboarding need a full review before production use. The implementation does not yet offer editable relays, encrypted attachments, multi-device key management beyond restoring the same identity, device-specific revocation, complete spam reporting, guaranteed message deletion, or forward secrecy. A new public Farcaster proof is required to bind a rotated key to the FID.

Before production use, review NIP-17/NIP-44/NIP-59 conformance, dependency provenance, browser behavior, and published audit findings; have an independent reviewer inspect the complete client, identity binding, storage, and relay protocol. Do not claim Signal-like forward secrecy. Add Firestore rules only if a future feature needs Firebase; DM ciphertext is not stored there.

