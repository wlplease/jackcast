"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createHmac } from "node:crypto";
import { neynar } from "@/lib/neynar";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import type { PostCastReqBodyEmbeds } from "@neynar/nodejs-sdk/build/api";
import { getViewer, SIGNER_COOKIE } from "@/lib/viewer";
import { withCastAttribution, MAX_CAST_BYTES } from "@/lib/cast-attribution";
import { buildReplyTree, THREAD_DEPTH } from "@/lib/thread-replies";

async function signer(): Promise<string> {
  const v = await getViewer();
  if (!v?.signerUuid) throw new Error("Not connected for writing. Visit /setup.");
  return v.signerUuid;
}

export type ActionResult = { ok: true; hash?: string } | { ok: false; error: string };

export type ThreadRepliesResult =
  | { ok: true; nodes: Awaited<ReturnType<typeof buildReplyTree>>["nodes"]; hidden: number; truncated: boolean; cursor: string | null }
  | { ok: false; error: string };

/** Read another page or a deeper branch of a thread for an authenticated viewer. */
export async function loadThreadReplies(input: { parentHash: string; cursor?: string }): Promise<ThreadRepliesResult> {
  if (!input || typeof input.parentHash !== "string" || !/^0x[0-9a-f]{40}$/i.test(input.parentHash) ||
      (input.cursor !== undefined && (typeof input.cursor !== "string" || input.cursor.length > 4096))) {
    return { ok: false, error: "That conversation request is not valid." };
  }
  const viewer = await getViewer();
  if (!viewer?.fid) return { ok: false, error: "Reconnect your Farcaster account to load more replies." };
  try {
    const response = await neynar().lookupCastConversation({
      identifier: input.parentHash,
      type: "hash",
      replyDepth: THREAD_DEPTH,
      includeChronologicalParentCasts: false,
      viewerFid: viewer.fid,
      sortType: "chron",
      limit: 50,
      cursor: input.cursor,
    });
    const tree = await buildReplyTree(
      response.conversation.cast.direct_replies ?? [],
      viewer.fid,
    );
    return { ok: true, ...tree, cursor: response.next?.cursor ?? null };
  } catch {
    return { ok: false, error: "Couldn't load those replies just now. Try again." };
  }
}

type LoginWindow = { failures: number; resetAt: number; blockedUntil: number };
const loginWindows = new Map<string, LoginWindow>();

const LOGIN_LIMIT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then return {0, redis.call('PTTL', KEYS[1]), current} end
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('PTTL', KEYS[1]), next}
`;

function loginRedisConfig(): { url: string; token: string } | null {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!rawUrl || !token) return null;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.hostname.endsWith(".upstash.io")
      ? { url: url.toString().replace(/\/$/, ""), token }
      : null;
  } catch { return null; }
}

async function reserveSharedLoginAttempt(fingerprint: string): Promise<boolean | null> {
  const config = loginRedisConfig();
  if (!config) return null;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(["EVAL", LOGIN_LIMIT_SCRIPT, 1, `jackcaster:login:v1:${fingerprint}`, "5", String(15 * 60_000)]),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = await response.json() as { result?: unknown; error?: string };
    if (result.error || !Array.isArray(result.result)) return null;
    return Number(result.result[0]) === 1;
  } catch { return null; }
}

async function clearSharedLoginAttempts(fingerprint: string) {
  const config = loginRedisConfig();
  if (!config) return;
  try {
    await fetch(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(["DEL", `jackcaster:login:v1:${fingerprint}`]),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
  } catch { /* A successful login should not fail because counter cleanup did. */ }
}

function errMessage(e: unknown, action: "cast" | "reaction" = "cast"): string {
  const value = e && typeof e === "object" ? e as { status?: unknown; response?: { status?: unknown }; message?: unknown } : {};
  const status = Number(value.status ?? value.response?.status ?? 0);
  const message = typeof value.message === "string" ? value.message : "";
  if (status === 401 || status === 403) return "Neynar rejected the request. Check your Farcaster connection at /setup.";
  if (status === 429) return "Neynar rate limit reached. Wait a little and try again.";
  if (status >= 500) return "The cast result is unclear because Neynar is temporarily unavailable. Your draft is still here. Check Sent before retrying to avoid a duplicate.";
  if (/fetch failed|network|timed? ?out/i.test(message)) return "The cast result is unclear because the connection ended before confirmation. Your draft is still here. Check Sent before retrying to avoid a duplicate.";
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
  if (!input || typeof input.text !== "string" ||
      (input.parentHash !== undefined && !/^0x[0-9a-f]{40}$/i.test(input.parentHash)) ||
      (input.parentAuthorFid !== undefined && (!Number.isSafeInteger(input.parentAuthorFid) || input.parentAuthorFid <= 0)) ||
      (input.channelId !== undefined && !/^[a-z0-9-]{1,32}$/i.test(input.channelId)) ||
      (input.quote !== undefined && (!input.quote || !/^0x[0-9a-f]{40}$/i.test(input.quote.hash) || !Number.isSafeInteger(input.quote.fid) || input.quote.fid <= 0)) ||
      (input.embedUrls !== undefined && (!Array.isArray(input.embedUrls) || input.embedUrls.length > 2 || input.embedUrls.some((url) => typeof url !== "string")))) {
    return { ok: false, error: "That cast request is not valid." };
  }
  const text = withCastAttribution(input.text);
  const urls = (input.embedUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (urls.some((u) => !/^https?:\/\//i.test(u) || u.length > 256)) {
    return { ok: false, error: "Links need to start with https:// and be under 256 characters." };
  }
  if (urls.some((u) => /\.private\.blob\.vercel-storage\.com/i.test(u))) {
    return { ok: false, error: "That photo is in a private Blob store, so nobody could see it. Switch to a public store first." };
  }
  if (!input.text.trim() && !urls.length && !input.quote) return { ok: false, error: "Nothing to cast" };
  if (new TextEncoder().encode(text).length > MAX_CAST_BYTES) {
    return { ok: false, error: "This cast is too long after adding the Jackcast source link. Shorten the text to fit Farcaster's 1,024-byte limit." };
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
    revalidateTag("own-profile-analytics");
    revalidatePath("/", "layout");
    return { ok: true, hash: res.cast?.hash };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export type ThreadActionResult =
  | { ok: true; hashes: string[] }
  | { ok: false; posted: number; lastHash: string | null; error: string };

/** Publish a short reply chain with per-cast embeds, returning enough state to resume after partial success. */
export async function publishThread(input: { casts: { text: string; embedUrls?: string[] }[]; parentHash?: string }): Promise<ThreadActionResult> {
  const minimum = input?.parentHash ? 1 : 2;
  if (!Array.isArray(input?.casts) || input.casts.length < minimum || input.casts.length > 5) {
    return { ok: false, posted: 0, lastHash: input?.parentHash ?? null, error: input?.parentHash ? "Add at least one cast to continue this thread." : "A thread needs 2 to 5 casts." };
  }
  const rawCasts = input.casts.map((item) => ({
    text: typeof item?.text === "string" ? item.text.trim() : "",
    embedUrls: Array.isArray(item?.embedUrls) && item.embedUrls.length <= 2 && item.embedUrls.every((url) => typeof url === "string") ? item.embedUrls.map((url) => url.trim()).filter(Boolean) : null,
  }));
  if (rawCasts.some((item) => item.embedUrls === null)) return { ok: false, posted: 0, lastHash: null, error: "Each cast can have up to two valid attachments." };
  if (rawCasts.some((item) => !item.text && !item.embedUrls?.length)) return { ok: false, posted: 0, lastHash: null, error: "Every cast needs text or an attachment." };
  const texts = rawCasts.map((item) => withCastAttribution(item.text));
  if (texts.some((text) => new TextEncoder().encode(text).length > 1024)) {
    return { ok: false, posted: 0, lastHash: null, error: "Each cast must fit Farcaster's 1,024-byte limit after adding the Jackcast source link." };
  }
  if (rawCasts.some((item) => item.embedUrls !== null && item.embedUrls.some((url) => !/^https?:\/\//i.test(url) || url.length > 256 || /\.private\.blob\.vercel-storage\.com/i.test(url)))) {
    return { ok: false, posted: 0, lastHash: null, error: "Attachments must be public HTTP or HTTPS links under 256 characters." };
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
      const embedUrls = rawCasts[i].embedUrls ?? [];
      const result = await neynar().publishCast({
        signerUuid: viewer.signerUuid,
        text: texts[i],
        ...(parent ? { parent, parentAuthorFid: viewer.fid } : {}),
        ...(embedUrls.length ? { embeds: embedUrls.map((url) => ({ url })) as unknown as PostCastReqBodyEmbeds[] } : {}),
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
  if (hashes.length) revalidateTag("own-profile-analytics");
  revalidatePath("/", "layout");
  return { ok: true, hashes };
}

export async function react(input: {
  hash: string;
  authorFid: number;
  kind: "like" | "recast";
  on: boolean;
}): Promise<ActionResult> {
  if (!input || !/^0x[0-9a-f]{40}$/i.test(input.hash) || !Number.isSafeInteger(input.authorFid) || input.authorFid <= 0 ||
      (input.kind !== "like" && input.kind !== "recast") || typeof input.on !== "boolean") {
    return { ok: false, error: "That reaction request is not valid." };
  }
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

/** Delete only a cast verified to belong to the signer connected on this device. */
export async function deleteOwnCast(input: { hash: string }): Promise<ActionResult> {
  if (!input || typeof input.hash !== "string" || !/^0x[0-9a-f]{40}$/i.test(input.hash)) {
    return { ok: false, error: "That cast link is not valid." };
  }
  const viewer = await getViewer();
  if (!viewer?.canWrite || !viewer.signerUuid) return { ok: false, error: "Connect your Farcaster account before deleting a cast." };
  try {
    const response = await neynar().fetchBulkCasts({ casts: [input.hash] });
    const cast = response.result.casts[0];
    if (!cast) return { ok: false, error: "That cast could not be found." };
    if (cast.author.fid !== viewer.fid) return { ok: false, error: "You can only delete your own casts." };
    const deletion = await neynar().deleteCast({ signerUuid: viewer.signerUuid, targetHash: input.hash });
    if (deletion.success === false) return { ok: false, error: "Farcaster did not confirm the deletion. Refresh the feed and check the cast before trying again." };
    revalidateTag("own-profile-analytics");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/429/.test(message)) return { ok: false, error: "Neynar is rate limiting deletions. Wait a little and try again." };
    return { ok: false, error: "Couldn't delete this cast. Check your Farcaster connection and try again." };
  }
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  if (!process.env.APP_PASSWORD) redirect("/");
  const now = Date.now();
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip") ?? "unknown";
  // Use an HMAC fingerprint so neither the password nor raw IP is stored in Redis.
  const key = createHmac("sha256", process.env.APP_PASSWORD!).update(`jackcaster:login:${address}`).digest("hex");
  const sharedAllowed = await reserveSharedLoginAttempt(key);
  if (sharedAllowed === false) return "Too many attempts. Wait 15 minutes and try again.";

  let window = loginWindows.get(key);
  if (sharedAllowed === null && window && now >= window.resetAt) {
    loginWindows.delete(key);
    window = undefined;
  }
  if (sharedAllowed === null && window && now < window.blockedUntil) return "Too many attempts. Wait 15 minutes and try again.";
  if (form.get("password") !== process.env.APP_PASSWORD) {
    if (sharedAllowed === true) return "Wrong password";
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
  if (sharedAllowed === true) await clearSharedLoginAttempts(key);
  const jar = await cookies();
  const session = await createSessionToken();
  if (!session) redirect("/");
  jar.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNER_COOKIE);
  redirect("/login");
}
