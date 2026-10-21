import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrefs } from "@/lib/prefs";

export const runtime = "nodejs";

const COOLDOWN_MS = 45_000;
const SESSION_COOLDOWN_MS = 5 * 60_000;
const LIMIT = 18;
const COOKIE_NAME = "jackcaster_giphy_session";
const GLOBAL_KEY = "jackcaster:giphy:global:v1";
const SESSION_KEY_PREFIX = "jackcaster:giphy:session:v1:";

type Scope = "global" | "session" | null;
type Session = { id: string; value: string; fresh: boolean };
type GiphyItem = { id?: string; title?: string; url?: string; images?: { original?: { url?: string }; downsized_large?: { url?: string }; fixed_width?: { url?: string }; fixed_width_small?: { url?: string } } };

const CLAIM_SCRIPT = `
local globalTtl = redis.call('PTTL', KEYS[1])
local sessionTtl = redis.call('PTTL', KEYS[2])
if globalTtl > 0 then return {0, globalTtl, 1} end
if sessionTtl > 0 then return {0, sessionTtl, 2} end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[3])
return {1, 0, 0}
`;

const STATUS_SCRIPT = `return {redis.call('PTTL', KEYS[1]), redis.call('PTTL', KEYS[2])}`;

function redisConfig(): { url: string; token: string } | null {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!rawUrl || !token) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".upstash.io")) return null;
    return { url: url.toString().replace(/\/$/, ""), token };
  } catch { return null; }
}

function signingSecret(): string | null {
  return process.env.GIPHY_RATE_LIMIT_SECRET || process.env.APP_PASSWORD || null;
}

function signSession(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`jackcaster:giphy:v1:${id}`).digest("base64url");
}

function cookieValue(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const pair = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return pair?.slice(COOKIE_NAME.length + 1) || null;
}

function getSession(request: Request): Session | null {
  const secret = signingSecret();
  if (!secret) return null;
  const value = cookieValue(request);
  if (value) {
    const separator = value.lastIndexOf(".");
    if (separator > 0) {
      const id = value.slice(0, separator);
      const supplied = Buffer.from(value.slice(separator + 1));
      const expected = Buffer.from(signSession(id, secret));
      if (/^[0-9a-f-]{36}$/i.test(id) && supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
        return { id, value, fresh: false };
      }
    }
  }
  const id = randomUUID();
  return { id, value: `${id}.${signSession(id, secret)}`, fresh: true };
}

function attachSessionCookie(response: NextResponse, session: Session) {
  if (!session.fresh) return response;
  response.cookies.set(COOKIE_NAME, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}

function hasAllowedOrigin(request: Request, allowMissing = false): boolean {
  const origin = request.headers.get("origin");
  return origin ? origin === new URL(request.url).origin : allowMissing;
}

async function redisCommand<T>(command: unknown[]): Promise<T> {
  const config = redisConfig();
  if (!config) throw new Error("Shared GIF search needs the Upstash Redis URL and token.");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The shared GIF rate limit is unavailable.");
  const result = await response.json() as { result?: T; error?: string };
  if (result.error || result.result === undefined) throw new Error("The shared GIF rate limit is unavailable.");
  return result.result;
}

function sessionRedisKey(sessionId: string) {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

async function readCooldown(sessionId: string): Promise<{ retryAfterMs: number; scope: Scope }> {
  const ttls = await redisCommand<unknown>(["EVAL", STATUS_SCRIPT, 2, GLOBAL_KEY, sessionRedisKey(sessionId)]);
  if (!Array.isArray(ttls) || ttls.length !== 2) throw new Error("The shared GIF rate limit returned an invalid status.");
  const globalWait = Math.max(0, Number(ttls[0]) || 0);
  const sessionWait = Math.max(0, Number(ttls[1]) || 0);
  return sessionWait > globalWait
    ? { retryAfterMs: sessionWait, scope: "session" }
    : { retryAfterMs: globalWait, scope: globalWait > 0 ? "global" : null };
}

async function claimCooldown(sessionId: string): Promise<{ ok: true } | { ok: false; retryAfterMs: number; scope: "global" | "session" }> {
  const result = await redisCommand<unknown>([
    "EVAL", CLAIM_SCRIPT, 2, GLOBAL_KEY, sessionRedisKey(sessionId), "1", String(COOLDOWN_MS), String(SESSION_COOLDOWN_MS),
  ]);
  if (!Array.isArray(result) || result.length !== 3) throw new Error("The shared GIF rate limit returned an invalid claim.");
  if (Number(result[0]) === 1) return { ok: true };
  return { ok: false, retryAfterMs: Math.max(1000, Number(result[1]) || COOLDOWN_MS), scope: Number(result[2]) === 2 ? "session" : "global" };
}

function featureError(message: string, status = 503, session?: Session) {
  const response = NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  return session ? attachSessionCookie(response, session) : response;
}

export async function GET(request: Request) {
  if ((await getPrefs()).disabledServices.includes("giphy")) return featureError("GIF search is turned off in this device's privacy choices.", 403);
  if (!hasAllowedOrigin(request, true)) return featureError("Request origin was not accepted.", 403);
  const session = getSession(request);
  if (!session) return featureError("Shared GIF search needs APP_PASSWORD or GIPHY_RATE_LIMIT_SECRET to sign its browser session.");
  if (!process.env.GIPHY_APP && !process.env.GIPHY_API_KEY) return featureError("GIF search is not enabled on this Jackcaster instance yet.", 503, session);
  if (!redisConfig()) return featureError("Free shared GIF search needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in this deployment.", 503, session);
  try {
    const status = await readCooldown(session.id);
    const response = NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
    return attachSessionCookie(response, session);
  } catch {
    return featureError("Shared GIF search is temporarily unavailable. Try again shortly.", 503, session);
  }
}

export async function POST(request: Request) {
  if ((await getPrefs()).disabledServices.includes("giphy")) return featureError("GIF search is turned off in this device's privacy choices.", 403);
  if (!hasAllowedOrigin(request)) return featureError("Request origin was not accepted.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return featureError("GIF search must use JSON.", 415);
  const session = getSession(request);
  if (!session) return featureError("Shared GIF search needs APP_PASSWORD or GIPHY_RATE_LIMIT_SECRET to sign its browser session.");
  const giphyKey = process.env.GIPHY_APP || process.env.GIPHY_API_KEY;
  if (!giphyKey) return featureError("GIF search is not enabled on this Jackcaster instance yet.", 503, session);
  if (!redisConfig()) return featureError("Free shared GIF search needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in this deployment.", 503, session);
  if (Number(request.headers.get("content-length") || 0) > 2000) return featureError("GIF search request is too large.", 413, session);

  let body: { query?: unknown; offset?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 2000) return featureError("GIF search request is too large.", 413, session);
    body = JSON.parse(raw) as { query?: unknown; offset?: unknown };
  } catch { return featureError("GIF search request was not valid.", 400, session); }
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 50) : "";
  const offset = Number.isInteger(body.offset) ? Number(body.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 90) return featureError("GIF page is outside the search limit.", 400, session);

  let claim: Awaited<ReturnType<typeof claimCooldown>>;
  try { claim = await claimCooldown(session.id); }
  catch { return featureError("Shared GIF search is paused because its global rate limit is unavailable.", 503, session); }
  if (!claim.ok) {
    const error = claim.scope === "session"
      ? "This browser session gets one free shared search every five minutes. Use your own GIPHY key for more searches."
      : "GIF search is cooling down for everyone. The countdown shows when the next search opens.";
    const response = NextResponse.json({ error, retryAfterMs: claim.retryAfterMs, scope: claim.scope }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(claim.retryAfterMs / 1000))), "Cache-Control": "no-store" },
    });
    return attachSessionCookie(response, session);
  }

  const endpoint = query ? "search" : "trending";
  const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`);
  url.searchParams.set("api_key", giphyKey);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "g");
  if (query) url.searchParams.set("q", query);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!response.ok) return featureError(response.status === 429 ? "GIPHY is rate limiting the shared library. Try again after the countdown." : "GIF search is temporarily unavailable.", 502, session);
    const payload = await response.json() as { data?: GiphyItem[]; pagination?: { total_count?: number } };
    const items = (payload.data ?? []).flatMap((item) => {
      const full = [item.images?.original?.url, item.images?.downsized_large?.url, item.images?.fixed_width?.url, item.images?.fixed_width_small?.url].find((candidate) => {
        try { const value = new URL(candidate || ""); return value.protocol === "https:" && /^media\d*\.giphy\.com$/i.test(value.hostname) && /\.gif$/i.test(value.pathname) && value.href.length <= 256; } catch { return false; }
      });
      const preview = item.images?.fixed_width_small?.url;
      try {
        const imageUrl = new URL(full || "");
        const previewUrl = new URL(preview || "");
        const pageUrl = item.url ? new URL(item.url) : undefined;
        if (!item.id || previewUrl.protocol !== "https:" || !/^media\d*\.giphy\.com$/i.test(previewUrl.hostname) || !pageUrl || pageUrl.protocol !== "https:" || !/(^|\.)giphy\.com$/i.test(pageUrl.hostname)) return [];
        return [{ id: item.id.slice(0, 96), url: imageUrl.href, preview: previewUrl.href, title: (item.title || "GIF").slice(0, 120), sourceUrl: pageUrl.href }];
      } catch { return []; }
    });
    const result = NextResponse.json({ items, hasMore: offset + LIMIT < (payload.pagination?.total_count ?? 0), retryAfterMs: COOLDOWN_MS, scope: "global" }, { headers: { "Cache-Control": "no-store" } });
    return attachSessionCookie(result, session);
  } catch {
    return featureError("GIPHY could not be reached. The shared cooldown still applies; try again when it ends.", 502, session);
  }
}
