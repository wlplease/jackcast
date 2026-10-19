# Jackcaster Animation Credits

`JackcasterAnimationCredits.sol` is a Base mainnet contract for charging USDC for AI avatar-animation drafts. It grants wallet-bound credits, supports recipient-locked gifts, and exposes lifetime counters for account analytics. It does not call an AI provider or store profile images.

## Base mainnet deployment

The deployed contract address supplied for Jackcaster is `0xf3f1eF40Bf3B3416c7D9Ae896e166634AB433bb1` on Base Mainnet (chain ID `8453`). The complete ABI and address are saved in [`deployments/base-mainnet.json`](deployments/base-mainnet.json). Verify the deployed bytecode and constructor owner on BaseScan before connecting a wallet or accepting payments.
## Remix deployment

1. Open [Remix](https://remix.ethereum.org/) and create `JackcasterAnimationCredits.sol`.
2. Paste in the Solidity source. Remix resolves the pinned OpenZeppelin npm imports (`@openzeppelin/contracts@5.7.0`).
3. In Solidity Compiler, select **0.8.30** and compile `JackcasterAnimationCredits`.
4. In Deploy & Run, choose **Injected Provider**, connect the wallet you want to own the settings, and confirm the wallet is on **Base Mainnet (chain ID 8453)**.
5. Deploy with the constructor argument `initialOwner` set to that owner wallet address. Consider a multisig for owner control. Never paste a private key or recovery phrase into Remix.
6. After deployment, copy the contract address and the compiled ABI. Keep the address, ABI, and source together for the app integration.

## Defaults and owner controls

- Base Circle USDC is fixed in the source: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (six decimals).
- The initial treasury is `0x76bC75Ef2F1f0F25e078641910D8E23A430204F5`. The owner can change the treasury for future purchases; prior payments are sent immediately and are not held by the contract.
- Initial price is **1 USDC**. A personal purchase gives **3 paid credits + 2 bonus credits** (5 total).
- A gift purchase gives **3 credits** to the selected recipient, directly at purchase time. Gift credits do not include the personal-purchase bonus and cannot be redirected or reclaimed by the payer.
- Owner can set price from **0.10 to 10 USDC**, personal paid pack size from **1 to 10**, personal bonus from **0 to 2**, and gift pack size from **1 to 10**. Changes affect future purchases only; earned credits remain unchanged.
- Owner can pause and resume purchases. Pausing does not prevent users from spending existing credits.
- Ownership transfers use OpenZeppelin `Ownable2Step`; the new owner must accept the transfer.
- There is no owner withdrawal, arbitrary credit adjustment, upgrade path, or credit expiration.
- Per-wallet `accountStats(address)` and global public counters report paid USDC, personal purchases, paid and bonus credits, gifts sent/received, and animation attempts. Events include each purchase, gift, and credit use.

## User transaction flow

1. User approves this contract to spend the exact current USDC price.
2. User calls `buyCredits()` to receive the current personal pack, or `giftCredits(recipient)` to assign the configured gift pack to another wallet. The recipient address is fixed in the gift transaction.
3. Before each animation attempt, the credit owner calls `useCredit(bytes32 requestId)` with a fresh nonzero request ID. Credits cannot be transferred between wallets.

The contract consumes a credit before offchain generation starts. A failed AI job does not automatically refund a consumed credit. `animationAttempts` counts credit uses, not confirmed successful outputs. The app's saved animation gallery must store generated media offchain; it should only show results that the provider actually returned.

The contract exposes per-wallet and global counters, and emits events suitable for building leaderboards. It does not keep an enumerable list of every wallet or sort wallets onchain; the app should calculate rankings from indexed Base events or an indexer. App integration must handle transaction confirmation, wallet-to-Farcaster account binding, request-ID uniqueness, gift-recipient account linking, and clear failure messaging. Do not trust client-submitted transaction hashes without verifying the Base receipt, contract address, event, sender, and final status.

## Important limits

Owner controls are visible onchain but centralized: the owner can change future prices, personal and gift pack sizes, and payment destination within the stated bounds, and can pause sales. Use a multisig if shared owner control is desired. The contract does not guarantee the AI service completes a generation or that Farcaster accepts an uploaded avatar.

