import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Who is using the app, and whether they can write.
 *
 * Resolved in this order:
 * 1. The signed cookie /setup drops after you approve your own Farcaster signer (write access on this device)
 * 2. MY_FID alone (read-only mode)
 * A deployment-wide signer is intentionally never used for writes, so one user's
 * Neynar configuration cannot make another user's casts appear under its account.
 * Nothing found means the app sends you to /setup.
 */
export type Viewer = {
  fid: number;
  signerUuid: string | null;
  canWrite: boolean;
  source: "setup" | "read-only";
};

export const SIGNER_COOKIE = "selfcaster_signer";

function bufferSource(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer as ArrayBuffer;
}

function secret(): string {
  return `selfcaster:signer:${process.env.APP_PASSWORD ?? ""}:${process.env.NEYNAR_API_KEY ?? ""}`;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    bufferSource(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, bufferSource(value));
  return Buffer.from(sig).toString("base64url");
}

/** Cookie value format: `<fid>.<signerUuid>.<hmac>` */
export async function encodeSignerCookie(fid: number, signerUuid: string): Promise<string> {
  const body = `${fid}.${signerUuid}`;
  return `${body}.${await hmac(body)}`;
}

async function decodeSignerCookie(raw: string | undefined): Promise<{ fid: number; signerUuid: string } | null> {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [fid, signerUuid, sig] = parts;
  if ((await hmac(`${fid}.${signerUuid}`)) !== sig) return null;
  const n = Number(fid);
  return Number.isInteger(n) && n > 0 ? { fid: n, signerUuid } : null;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Prefer an account explicitly connected on this device. Paid profile media
  // must bind to this approved Farcaster signer, not a deployment-wide fallback.
  const jar = await cookies();
  const fromCookie = await decodeSignerCookie(jar.get(SIGNER_COOKIE)?.value);
  if (fromCookie) return { ...fromCookie, canWrite: true, source: "setup" };

  const envFid = Number(process.env.MY_FID || 0);
  if (envFid) return { fid: envFid, signerUuid: null, canWrite: false, source: "read-only" };
  return null;
});

/** Use at the top of a page, outside any try/catch, so the redirect isn't swallowed. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/setup");
  return v;
}

/** For data helpers that run after a page already called requireViewer(). */
export async function viewerOrThrow(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("Not connected. Visit /setup.");
  return v;
}
