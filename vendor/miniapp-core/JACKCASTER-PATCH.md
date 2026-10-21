# Jackcaster patch

This is the MIT-licensed `@farcaster/miniapp-core` 0.6.0 package from the
Farcaster Mini Apps SDK. Its original license and copyright are in `LICENSE`.
Before vendoring, Jackcaster's lockfile pinned the upstream tarball with
integrity
`sha512-sgDQdU6fQDXYbNbjuvvwhww1rwf/S0JCnKsp/o2K+ubtboA3SOiy3Wrc+taBnAh56CCxVbZN9Hck3OpYh9wINw==`.

Jackcaster uses the official `@farcaster/miniapp-sdk` for its Mini App host,
sharing, compose, and wallet integrations, but this app does not use Solana.
This local package removes the unused Solana wallet adapter and its
`@solana/web3.js` dependency, which pulled in vulnerable transitive packages.
Ethereum and other Mini App Core APIs remain from the upstream package.

Review the upstream package before upgrading the SDK. Reapply this small patch
only if upstream still requires the Solana dependency and Jackcaster still does
not use it.
