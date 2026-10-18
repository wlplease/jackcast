"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { neynar } from "@/lib/neynar";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import type { PostCastReqBodyEmbeds } from "@neynar/nodejs-sdk/build/api";
import { getViewer } from "@/lib/viewer";

async function signer(): Promise<string> {
  const v = await getViewer();
  if (!v?.signerUuid) throw new Error("Not connected for writing. Visit /setup.");
  return v.signerUuid;
}

export type ActionResult = { ok: true; hash?: string } | { ok: false; error: string };

type LoginWindow = { failures: number; resetAt: number; blockedUntil: number };
const loginWindows = new Map<string, LoginWindow>();

function errMessage(e: unknown, action: "cast" | "reaction" = "cast"): string {
  const value = e && typeof e === "object" ? e as { status?: unknown; response?: { status?: unknown }; message?: unknown } : {};
  const status = Number(value.status ?? value.response?.status ?? 0);
  const message = typeof value.message === "string" ? value.message : "";
  if (status === 401 || status === 403) return "Neynar rejected the request. Check your Farcaster connection at /setup.";
  if (status === 429) return "Neynar rate limit reached. Wait a little and try again.";
  if (status >= 500) return "Neynar is temporarily unavailable. Try again shortly.";
  if (/fetch failed|network|timed? ?out/i.test(message)) return "Couldn't reach Neynar. Your account data is unchanged; try again shortly.";
  return action === "reaction" ? "Couldn't update that reaction. Check your connection and try again." : "Couldn't publish the cast. Check your connection and try again.";
}

export async function publish(input: {
  text: string;
  parentHash?: string;
  parentAuthorFid?: number;
  channelId?: string;
  /** Links and uploaded photo URLs */
  embedUrls?: string[];
  /** Quote another cast */
  quote?: { hash: string; fid: number };
}): Promise<ActionResult> {
  const text = input.text.trim();
  const urls = (input.embedUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (urls.some((u) => !/^https?:\/\//i.test(u) || u.length > 256)) {
    return { ok: false, error: "Links need to start with https:// and be under 256 characters." };
  }
  if (urls.some((u) => /\.private\.blob\.vercel-storage\.com/i.test(u))) {
    return { ok: false, error: "That photo is in a private Blob store, so nobody could see it. Switch to a public store first." };
  }
  if (!text && !urls.length && !input.quote) return { ok: false, error: "Nothing to cast" };
  if (new TextEncoder().encode(text).length > 1024) {
    return { ok: false, error: "Too long (1024 bytes max)" };
  }
  // The SDK's generated embed type merges the url and cast variants; the API wants one or the other.
  const embeds = [
    ...urls.map((url) => ({ url })),
    ...(input.quote ? [{ cast_id: { hash: input.quote.hash, fid: input.quote.fid } }] : []),
  ];
  if (embeds.length > 2) return { ok: false, error: "Farcaster allows 2 attachments per cast." };
  try {
    const res = await neynar().publishCast({
      signerUuid: await signer(),
      text,
      ...(input.parentHash ? { parent: input.parentHash, parentAuthorFid: input.parentAuthorFid } : {}),
      ...(!input.parentHash && input.channelId ? { channelId: input.channelId } : {}),
      ...(embeds.length ? { embeds: embeds as unknown as PostCastReqBodyEmbeds[] } : {}),
    });
    revalidatePath("/", "layout");
    return { ok: true, hash: res.cast?.hash };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export type ThreadActionResult =
  | { ok: true; hashes: string[] }
  | { ok: false; posted: number; lastHash: string | null; error: string };

/** Publish a short text-only reply chain, returning enough state to resume after partial success. */
export async function publishThread(input: { casts: string[]; parentHash?: string }): Promise<ThreadActionResult> {
  const minimum = input?.parentHash ? 1 : 2;
  if (!Array.isArray(input?.casts) || input.casts.length < minimum || input.casts.length > 5) {
    return { ok: false, posted: 0, lastHash: input?.parentHash ?? null, error: input?.parentHash ? "Add at least one cast to continue this thread." : "A thread needs 2 to 5 casts." };
  }
  const texts = input.casts.map((text) => typeof text === "string" ? text.trim() : "");
  if (texts.some((text) => !text)) return { ok: false, posted: 0, lastHash: null, error: "Every cast needs text." };
  if (texts.some((text) => new TextEncoder().encode(text).length > 1024)) {
    return { ok: false, posted: 0, lastHash: null, error: "Each cast must be 1024 bytes or less." };
  }
  if (input.parentHash && !/^0x[0-9a-f]{40}$/i.test(input.parentHash)) {
    return { ok: false, posted: 0, lastHash: null, error: "The thread continuation point is invalid." };
  }
  const viewer = await getViewer();
  if (!viewer?.signerUuid) return { ok: false, posted: 0, lastHash: input.parentHash ?? null, error: "Connect your account at /setup first." };

  let parent = input.parentHash;
  const hashes: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      const result = await neynar().publishCast({
        signerUuid: viewer.signerUuid,
        text: texts[i],
        ...(parent ? { parent, parentAuthorFid: viewer.fid } : {}),
      });
      const hash = result.cast?.hash;
      if (!hash || !/^0x[0-9a-f]{40}$/i.test(hash)) {
        return { ok: false, posted: hashes.length, lastHash: parent ?? null, error: `Could not confirm cast ${i + 1}. Check your profile before retrying.` };
      }
      hashes.push(hash);
      parent = hash;
    } catch (e) {
      return { ok: false, posted: hashes.length, lastHash: parent ?? null, error: `Cast ${i + 1} could not be confirmed. ${errMessage(e)}` };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, hashes };
}

export async function react(input: {
  hash: string;
  authorFid: number;
  kind: "like" | "recast";
  on: boolean;
}): Promise<ActionResult> {
  try {
    const args = {
      signerUuid: await signer(),
      reactionType: input.kind,
      target: input.hash,
      targetAuthorFid: input.authorFid,
    };
    if (input.on) await neynar().publishReaction(args);
    else await neynar().deleteReaction(args);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e, "reaction") };
  }
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const expected = await sessionToken();
  if (!expected) redirect("/");
  const now = Date.now();
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip") ?? "unknown";
  const source = new TextEncoder().encode(`${process.env.APP_PASSWORD}:${address}`);
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", source.buffer as ArrayBuffer));
  const key = Array.from(keyBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let window = loginWindows.get(key);
  if (window && now >= window.resetAt) {
    loginWindows.delete(key);
    window = undefined;
  }
  if (window && now < window.blockedUntil) return "Too many attempts. Wait 15 minutes and try again.";
  if (form.get("password") !== process.env.APP_PASSWORD) {
    const next = window ?? { failures: 0, resetAt: now + 15 * 60_000, blockedUntil: 0 };
    next.failures += 1;
    if (next.failures >= 5) {
      next.blockedUntil = now + 15 * 60_000;
      next.resetAt = next.blockedUntil;
    }
    loginWindows.set(key, next);
    if (loginWindows.size > 1000) {
      for (const [savedKey, value] of loginWindows) if (now >= value.resetAt || now >= value.blockedUntil && value.failures >= 5) loginWindows.delete(savedKey);
      while (loginWindows.size > 1000) loginWindows.delete(loginWindows.keys().next().value!);
    }
    return next.blockedUntil > now ? "Too many attempts. Wait 15 minutes and try again." : "Wrong password";
  }
  loginWindows.delete(key);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
