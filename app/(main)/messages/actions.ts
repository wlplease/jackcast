"use server";

import { neynar } from "@/lib/neynar";
import { viewerOrThrow } from "@/lib/viewer";

export type DmUser = { fid: number; username: string; displayName: string; pfpUrl: string; custodyAddress: string };
export type DmKeyProof = { fid: number; publicKey: string; castHash: string };

function dmUser(user: { fid: number; username: string; display_name?: string | null; pfp_url?: string | null; custody_address: string }): DmUser {
  return { fid: user.fid, username: user.username, displayName: user.display_name || user.username, pfpUrl: user.pfp_url || "", custodyAddress: user.custody_address };
}

export async function getDmSelf(): Promise<{ ok: true; user: DmUser } | { ok: false; error: string }> {
  const viewer = await viewerOrThrow();
  try {
    const { users } = await neynar().fetchBulkUsers({ fids: [viewer.fid], viewerFid: viewer.fid });
    if (!users[0]?.custody_address) return { ok: false, error: "Could not confirm this Farcaster account's Farcaster identity record." };
    return { ok: true, user: dmUser(users[0]) };
  } catch { return { ok: false, error: "Could not load the Farcaster identity. Try again." }; }
}

export async function lookupDmUser(raw: string): Promise<{ ok: true; user: DmUser } | { ok: false; error: string }> {
  const viewer = await viewerOrThrow();
  const value = raw.trim().replace(/^@/, "");
  if (!value || value.length > 64) return { ok: false, error: "Enter a Farcaster username or FID." };
  try {
    const user = /^\d+$/.test(value)
      ? (await neynar().fetchBulkUsers({ fids: [Number(value)], viewerFid: viewer.fid })).users[0]
      : (await neynar().lookupUserByUsername({ username: value.toLowerCase(), viewerFid: viewer.fid })).user;
    if (!user?.custody_address) return { ok: false, error: "That Farcaster account could not be found." };
    return { ok: true, user: dmUser(user) };
  } catch { return { ok: false, error: "That Farcaster account could not be found. Check the username or FID." }; }
}

export async function getDmUser(fid: number): Promise<{ ok: true; user: DmUser } | { ok: false; error: string }> {
  const viewer = await viewerOrThrow();
  if (!Number.isSafeInteger(fid) || fid < 1) return { ok: false, error: "Invalid Farcaster ID." };
  try {
    const { users } = await neynar().fetchBulkUsers({ fids: [fid], viewerFid: viewer.fid });
    if (!users[0]?.custody_address) return { ok: false, error: "That Farcaster account could not be found." };
    return { ok: true, user: dmUser(users[0]) };
  } catch { return { ok: false, error: "Could not load the Farcaster identity. Try again." }; }
}

/** Find and validate the public Farcaster cast that binds a FID to a DM key. */
export async function getDmKeyProof(fid: number, publicKey: string): Promise<{ ok: true; proof: DmKeyProof | null } | { ok: false; error: string }> {
  const viewer = await viewerOrThrow();
  if (!Number.isSafeInteger(fid) || fid < 1 || !/^[0-9a-f]{64}$/.test(publicKey)) return { ok: false, error: "Invalid Farcaster DM identity." };
  try {
    const page = await neynar().fetchCastsForUser({ fid, viewerFid: viewer.fid, includeReplies: false, limit: 100 });
    const prefix = `Jackcast DM key proof\nFID: ${fid}\nNostr public key: ${publicKey}\n`;
    const cast = page.casts.find((item) => item.author.fid === fid && item.text.startsWith(prefix));
    return { ok: true, proof: cast ? { fid, publicKey, castHash: cast.hash } : null };
  } catch { return { ok: false, error: "Could not verify the Farcaster DM key proof. Try again." }; }
}

export async function verifyDmKeyProof(castHash: string, fid: number, publicKey: string): Promise<boolean> {
  const viewer = await viewerOrThrow();
  if (!/^0x[0-9a-f]{40,}$/i.test(castHash) || !Number.isSafeInteger(fid) || fid < 1 || !/^[0-9a-f]{64}$/.test(publicKey)) return false;
  try {
    const result = await neynar().lookupCastByHashOrUrl({ identifier: castHash, type: "hash", viewerFid: viewer.fid });
    return result.cast.hash.toLowerCase() === castHash.toLowerCase() && result.cast.author.fid === fid &&
      result.cast.text.startsWith(`Jackcast DM key proof\nFID: ${fid}\nNostr public key: ${publicKey}\n`);
  } catch { return false; }
}

/** Publish an explicit, user-confirmed public proof using the Farcaster signer already approved at /setup. */
export async function publishDmKeyProof(publicKey: string): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  const viewer = await viewerOrThrow();
  if (!viewer.signerUuid || !viewer.canWrite || viewer.source !== "setup") return { ok: false, error: "Finish the existing Farcaster setup before publishing a public DM key proof. Read-only mode cannot publish." };
  if (!/^[0-9a-f]{64}$/.test(publicKey)) return { ok: false, error: "Invalid DM public key." };
  const text = `Jackcast DM key proof\nFID: ${viewer.fid}\nNostr public key: ${publicKey}\n\nThis public cast links my Farcaster identity to my Jackcast encrypted messaging key. It contains no private key or message content.`;
  try {
    const result = await neynar().publishCast({ signerUuid: viewer.signerUuid, text });
    const hash = result.cast?.hash;
    if (!hash) return { ok: false, error: "Farcaster did not return the proof cast hash." };
    const confirmed = await neynar().lookupCastByHashOrUrl({ identifier: hash, type: "hash", viewerFid: viewer.fid });
    if (confirmed.cast.author.fid !== viewer.fid || !confirmed.cast.text.startsWith(`Jackcast DM key proof\nFID: ${viewer.fid}\nNostr public key: ${publicKey}\n`)) {
      return { ok: false, error: "The published Farcaster proof could not be independently confirmed." };
    }
    return { ok: true, hash };
  } catch { return { ok: false, error: "Could not publish the Farcaster DM key proof. Try again." }; }
}
