"use client";

import { recoverTypedDataAddress, type Hex } from "viem";
import { finalizeEvent, getEventHash, getPublicKey, SimplePool, validateEvent, verifyEvent, type Event, type EventTemplate } from "nostr-tools";
import * as nip59 from "nostr-tools/nip59";
import type { DmIdentity } from "./identity";

// All Jackcast deployments use this public relay set. No relay is trusted with
// plaintext or private keys; the initial client does not yet expose relay editing.
export const DEFAULT_DM_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
] as const;

export const DM_BINDING_DOMAIN = { name: "Jackcast DM Identity", version: "1", chainId: 10 } as const;
export const DM_BINDING_TYPES = {
  JackcastDmKeyBinding: [
    { name: "fid", type: "uint256" },
    { name: "messagingPublicKey", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
const DM_BINDING_KIND = 30_078;
const DM_BINDING_D_TAG = (fid: number) => `jackcast-dm-fid-${fid}`;

export type DmBinding = {
  version: 1 | 2;
  fid: number;
  publicKey: string;
  walletAddress?: string;
  issuedAt?: number;
  nonce?: Hex;
  signature?: Hex;
  castHash?: string;
};

export function createDmBinding(fid: number, publicKey: string, castHash: string): DmBinding {
  if (!Number.isSafeInteger(fid) || fid < 1 || !/^[0-9a-f]{64}$/.test(publicKey) || !/^0x[0-9a-f]{40,}$/i.test(castHash)) {
    throw new Error("Invalid Farcaster DM key proof.");
  }
  return { version: 2, fid, publicKey, castHash };
}

export async function signDmBinding(identity: DmIdentity, fid: number, custodyAddress: string, signTypedData: (data: object) => Promise<string>): Promise<DmBinding> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
  const message = { fid: BigInt(fid), messagingPublicKey: `0x${identity.publicKey}` as Hex, issuedAt: BigInt(issuedAt), nonce };
  const signature = await signTypedData({ domain: DM_BINDING_DOMAIN, types: DM_BINDING_TYPES, primaryType: "JackcastDmKeyBinding", message });
  const signer = await recoverTypedDataAddress({ domain: DM_BINDING_DOMAIN, types: DM_BINDING_TYPES, primaryType: "JackcastDmKeyBinding", message, signature: signature as Hex });
  if (signer.toLowerCase() !== custodyAddress.toLowerCase()) throw new Error("The connected wallet does not match this Farcaster account's custody wallet.");
  return { version: 1, fid, publicKey: identity.publicKey, walletAddress: signer, issuedAt, nonce, signature: signature as Hex };
}

function bindingTemplate(binding: DmBinding): EventTemplate {
  if (binding.version !== 1 || !binding.issuedAt) throw new Error("Farcaster key proof bindings are resolved from the public proof, not republished as unsigned Nostr records.");
  return {
    kind: DM_BINDING_KIND,
    created_at: binding.issuedAt,
    tags: [["d", DM_BINDING_D_TAG(binding.fid)], ["t", "jackcast-dm-identity"]],
    content: JSON.stringify(binding),
  };
}

export async function publishDmBinding(binding: DmBinding, identity: DmIdentity): Promise<void> {
  const pool = new SimplePool();
  try {
    const event = finalizeEvent({
      kind: DM_BINDING_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", DM_BINDING_D_TAG(binding.fid)], ["t", "jackcast-dm-identity"]],
      content: JSON.stringify(binding),
    }, identity.secretKey);
    const relayList = finalizeEvent({ kind: 10_050, created_at: Math.floor(Date.now() / 1000), tags: DEFAULT_DM_RELAYS.map((relay) => ["relay", relay]), content: "" }, identity.secretKey);
    const [bindingResults, relayResults] = await Promise.all([
      Promise.allSettled(pool.publish([...DEFAULT_DM_RELAYS], event)),
      Promise.allSettled(pool.publish([...DEFAULT_DM_RELAYS], relayList)),
    ]);
    if (!bindingResults.some((result) => result.status === "fulfilled")) throw new Error("Your Farcaster proof is published, but no DM relay accepted its locator. Retry linking before messaging.");
    if (!relayResults.some((result) => result.status === "fulfilled")) throw new Error("Your proof locator is published, but no relay accepted your inbox settings. Retry linking before messaging.");
  } finally { pool.destroy(); }
}

function parseBinding(event: Event): DmBinding | null {
  if (event.kind !== DM_BINDING_KIND || !verifyEvent(event)) return null;
  try {
    const value = JSON.parse(event.content) as DmBinding;
    if (!Number.isSafeInteger(value.fid) || value.fid < 1 || !/^[0-9a-f]{64}$/.test(value.publicKey) || value.publicKey !== event.pubkey) return null;
    if (value.version === 1 && (!/^0x[0-9a-f]{40}$/i.test(value.walletAddress ?? "") || !Number.isSafeInteger(value.issuedAt) || Math.abs(event.created_at - value.issuedAt!) > 60 || !/^0x[0-9a-f]{64}$/i.test(value.nonce ?? "") || !/^0x[0-9a-f]{130}$/i.test(value.signature ?? ""))) return null;
    if (value.version === 2 && !/^0x[0-9a-f]{40,}$/i.test(value.castHash ?? "")) return null;
    if (value.version !== 1 && value.version !== 2) return null;
    if (!event.tags.some((tag) => tag[0] === "d" && tag[1] === DM_BINDING_D_TAG(value.fid))) return null;
    if (!event.tags.some((tag) => tag[0] === "t" && tag[1] === "jackcast-dm-identity")) return null;
    return value;
  } catch { return null; }
}

export async function verifyDmBinding(binding: DmBinding, expectedCustodyAddress: string): Promise<boolean> {
  if (binding.version !== 1 || !binding.walletAddress || !binding.issuedAt || !binding.nonce || !binding.signature) return false;
  if (binding.walletAddress.toLowerCase() !== expectedCustodyAddress.toLowerCase()) return false;
  try {
    const message = { fid: BigInt(binding.fid), messagingPublicKey: `0x${binding.publicKey}` as Hex, issuedAt: BigInt(binding.issuedAt), nonce: binding.nonce };
    const signer = await recoverTypedDataAddress({ domain: DM_BINDING_DOMAIN, types: DM_BINDING_TYPES, primaryType: "JackcastDmKeyBinding", message, signature: binding.signature });
    return signer.toLowerCase() === expectedCustodyAddress.toLowerCase();
  } catch { return false; }
}

export async function resolveDmBinding(fid: number, expectedCustodyAddress: string): Promise<DmBinding | null> {
  if (!Number.isSafeInteger(fid) || fid < 1) return null;
  const pool = new SimplePool();
  try {
    const events = await pool.querySync([...DEFAULT_DM_RELAYS], { kinds: [DM_BINDING_KIND], "#d": [DM_BINDING_D_TAG(fid)], limit: 10 }, { maxWait: 8_000 });
    for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
      const binding = parseBinding(event);
      if (binding?.fid === fid && (binding.version === 2 || await verifyDmBinding(binding, expectedCustodyAddress))) return binding;
    }
    return null;
  } finally { pool.destroy(); }
}

function cleanRelayUrls(event: Event | null): string[] {
  if (!event || event.kind !== 10_050 || !verifyEvent(event)) return [];
  const relays: string[] = [];
  const allowed = new Set<string>(DEFAULT_DM_RELAYS);
  for (const tag of event.tags) {
    if (tag[0] !== "relay" || !tag[1] || relays.includes(tag[1])) continue;
    try {
      const normalized = new URL(tag[1]).toString().replace(/\/$/, "");
      if (allowed.has(normalized)) relays.push(normalized);
    } catch { /* Ignore invalid relay URLs. */ }
    if (relays.length >= 3) break;
  }
  return relays;
}

export async function resolveDmRelays(publicKey: string): Promise<string[]> {
  if (!/^[0-9a-f]{64}$/.test(publicKey)) return [];
  const pool = new SimplePool();
  try {
    const events = await pool.querySync([...DEFAULT_DM_RELAYS], { kinds: [10_050], authors: [publicKey], limit: 5 }, { maxWait: 8_000 });
    for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
      const relays = cleanRelayUrls(event);
      if (relays.length) return relays;
    }
    return [];
  } finally { pool.destroy(); }
}

export async function resolveDmBindingByKey(publicKey: string): Promise<DmBinding | null> {
  if (!/^[0-9a-f]{64}$/.test(publicKey)) return null;
  const pool = new SimplePool();
  try {
    const events = await pool.querySync([...DEFAULT_DM_RELAYS], { kinds: [DM_BINDING_KIND], authors: [publicKey], "#t": ["jackcast-dm-identity"], limit: 10 }, { maxWait: 8_000 });
    for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
      const binding = parseBinding(event);
      if (binding && binding.publicKey === publicKey) return binding;
    }
    return null;
  } finally { pool.destroy(); }
}

export async function sendDm(identity: DmIdentity, recipientPublicKey: string, recipientRelays: string[], text: string, replyTo?: string): Promise<void> {
  const body = text.trim();
  if (!/^[0-9a-f]{64}$/.test(recipientPublicKey)) throw new Error("This recipient's DM key is invalid.");
  if (!recipientRelays.length) throw new Error("This recipient has not published DM inbox relays yet.");
  if (!body || new TextEncoder().encode(body).length > 8_000) throw new Error("Messages must be between 1 and 8,000 UTF-8 bytes.");
  if (replyTo !== undefined && !/^[0-9a-f]{64}$/.test(replyTo)) throw new Error("The message being replied to has an invalid ID.");
  const tags = [["p", recipientPublicKey]];
  if (replyTo) tags.push(["e", replyTo, recipientRelays[0] ?? ""]);
  const rumor: EventTemplate = { kind: 14, created_at: Math.floor(Date.now() / 1000), tags, content: body };
  const events = [
    nip59.wrapEvent(rumor, identity.secretKey, recipientPublicKey),
    nip59.wrapEvent(rumor, identity.secretKey, identity.publicKey),
  ];
  const pool = new SimplePool();
  try {
    for (let index = 0; index < events.length; index++) {
      const relayTargets = index === 0 ? recipientRelays : [...DEFAULT_DM_RELAYS];
      const acknowledgements = await Promise.allSettled(pool.publish(relayTargets, events[index]));
      if (!acknowledgements.some((result) => result.status === "fulfilled")) throw new Error("A relay did not accept every message copy. Refresh the conversation before retrying to avoid duplicates.");
    }
  } finally { pool.destroy(); }
}

export type DecryptedDm = { id: string; author: string; recipient: string; createdAt: number; content: string; replyTo?: string };

export async function fetchDms(identity: DmIdentity): Promise<DecryptedDm[]> {
  const pool = new SimplePool();
  try {
    const inboxRelays = await resolveDmRelays(identity.publicKey);
    if (!inboxRelays.length) throw new Error("No inbox relays were found for this DM identity.");
    const events = await pool.querySync(inboxRelays, { kinds: [1_059], "#p": [identity.publicKey], limit: 250 }, { maxWait: 10_000 });
    const seen = new Set<string>();
    const messages: DecryptedDm[] = [];
    for (const event of events) {
      if (!verifyEvent(event) || seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const rumor = nip59.unwrapEvent(event, identity.secretKey);
        if (rumor.kind !== 14 || typeof rumor.content !== "string" || !Number.isSafeInteger(rumor.created_at) ||
          !validateEvent(rumor) || getEventHash(rumor) !== rumor.id || !/^[0-9a-f]{64}$/.test(rumor.pubkey)) continue;
        const recipients = rumor.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]).filter((key): key is string => typeof key === "string");
        const author = rumor.pubkey === identity.publicKey ? identity.publicKey : rumor.pubkey;
        const recipient = recipients.find((key) => key !== identity.publicKey) ?? (author === identity.publicKey ? identity.publicKey : author);
        const parentId = rumor.tags.find((tag) => tag[0] === "e")?.[1];
        messages.push({ id: rumor.id, author, recipient, createdAt: rumor.created_at, content: rumor.content, ...(parentId && /^[0-9a-f]{64}$/.test(parentId) ? { replyTo: parentId } : {}) });
      } catch { /* Ignore malformed or unrelated gift wraps. */ }
    }
    return messages.sort((a, b) => a.createdAt - b.createdAt).slice(-250);
  } finally { pool.destroy(); }
}

export function getDmPublicKey(identity: DmIdentity): string { return getPublicKey(identity.secretKey); }
