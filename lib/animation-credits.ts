import type { Address } from "viem";

// Keep this lowercase so viem never rejects a mixed-case address copied from a stale client bundle.
export const ANIMATION_CREDITS_ADDRESS = "0xf3f1ef40bf3b3416c7d9ae896e166634ab433bb1" as Address;
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

export const animationCreditsAbi = [
  { type: "function", name: "USDC", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "priceUSDC", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paidCreditsPerPurchase", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "bonusCreditsPerPurchase", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "creditsOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "buyCredits", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "useCredit", stateMutability: "nonpayable", inputs: [{ name: "requestId", type: "bytes32" }], outputs: [] },
  { type: "event", name: "CreditUsed", anonymous: false, inputs: [
    { indexed: true, name: "account", type: "address" },
    { indexed: true, name: "requestId", type: "bytes32" },
    { indexed: false, name: "creditsRemaining", type: "uint256" },
  ] },
] as const;

export const usdcAbi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
