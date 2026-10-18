"use server";

// Server half of /setup. Your recovery phrase never reaches these functions:
// the browser signs locally and only sends the finished signature.

import { cookies } from "next/headers";
import { neynar } from "@/lib/neynar";
import { SIGNER_COOKIE, encodeSignerCookie } from "@/lib/viewer";

type Fail = { ok: false; error: string };

function message(e: unknown): string {
  const err = e as { response?: { data?: { message?: string }; status?: number }; message?: string };
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong";
}

/** Find the Farcaster account whose custody wallet the phrase controls. */
export async function findAccount(address: string): Promise<{ ok: true; fid: number; username: string } | Fail> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { ok: false, error: "Invalid address" };
  try {
    const { user } = await neynar().lookupUserByCustodyAddress({ custodyAddress: address });
    return { ok: true, fid: user.fid, username: user.username };
  } catch {
    return {
      ok: false,
      error: "No Farcaster account uses that phrase. Double check it's the recovery phrase from the Farcaster app.",
    };
  }
}

/** Ask Neynar for a fresh signer key. Returns the public key the browser needs to sign. */
export async function startSigner(): Promise<{ ok: true; signerUuid: string; publicKey: string } | Fail> {
  try {
    const s = await neynar().createSigner();
    return { ok: true, signerUuid: s.signer_uuid, publicKey: s.public_key };
  } catch (e) {
    return { ok: false, error: `Couldn't create a signer: ${message(e)}. Check NEYNAR_API_KEY.` };
  }
}

/** Register the browser's signature. Tries Neynar-sponsored first so approval is free. */
export async function registerSigner(input: {
  signerUuid: string;
  appFid: number;
  deadline: number;
  signature: string;
}): Promise<{ ok: true; approvalUrl: string; sponsored: boolean } | Fail> {
  const base = {
    signerUuid: input.signerUuid,
    appFid: input.appFid,
    deadline: input.deadline,
    signature: input.signature,
  };
  try {
    const s = await neynar().registerSignedKey({ ...base, sponsor: { sponsored_by_neynar: true } });
    if (s.signer_approval_url) return { ok: true, approvalUrl: s.signer_approval_url, sponsored: true };
  } catch {
    // Sponsorship can fail on some plans. Fall through and let the Farcaster app cover the fee.
  }
  try {
    const s = await neynar().registerSignedKey(base);
    if (!s.signer_approval_url) return { ok: false, error: "Neynar didn't return an approval link." };
    return { ok: true, approvalUrl: s.signer_approval_url, sponsored: false };
  } catch (e) {
    return { ok: false, error: `Couldn't register the signer: ${message(e)}` };
  }
}

/** Poll until you approve in the Farcaster app. On approval, connects this device. */
export async function checkSigner(
  signerUuid: string
): Promise<{ ok: true; status: string; fid?: number; username?: string } | Fail> {
  try {
    const s = await neynar().lookupSigner({ signerUuid });
    if (s.status !== "approved" || !s.fid) return { ok: true, status: s.status };

    const jar = await cookies();
    jar.set(SIGNER_COOKIE, await encodeSignerCookie(s.fid, s.signer_uuid), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    const { users } = await neynar().fetchBulkUsers({ fids: [s.fid] });
    return { ok: true, status: "approved", fid: s.fid, username: users[0]?.username };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function disconnectDevice() {
  const jar = await cookies();
  jar.delete(SIGNER_COOKIE);
}
