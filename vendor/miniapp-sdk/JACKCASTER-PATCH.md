# Jackcaster patch

This is the MIT-licensed Farcaster Mini App SDK 0.3.0. The original license
and copyright are in `LICENSE`. Before vendoring, Jackcaster's lockfile pinned
the SDK tarball with integrity
`sha512-mxze24B5SSLwqpPqUmzthfsGGPeevJvDuOEbLJay1DDgPS/B0LswA0XXfz4d6pViA7Y4TkbeAPMAfuVZ9nIqgQ==`.

The package keeps the official Mini App SDK and its Farcaster host, Ethereum
wallet, sharing, compose, and other features. It removes only the unused
Solana provider from SDK initialization and public types. Its Mini App Core
dependency is the local Jackcaster variant documented in that package's
`JACKCASTER-PATCH.md`.

Review upstream SDK changes before upgrading. Reapply this patch only while
Jackcaster does not use the Solana provider.
