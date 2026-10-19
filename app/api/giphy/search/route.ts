import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOLDOWN_MS = 45_000;
const LIMIT = 18;
const DOCUMENT_PATH = "jackcaster_shared_limits/giphy/slots/global";

type Config = { apiKey: string; projectId: string };
type FirestoreDocument = { updateTime?: string; fields?: { lastUsedAt?: { timestampValue?: string } } };

function config(): Config | null {
  const packed = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (packed) {
    try {
      const parsed = JSON.parse(packed) as Partial<Config>;
      if (parsed.apiKey && parsed.projectId) return { apiKey: parsed.apiKey, projectId: parsed.projectId };
    } catch { /* Use individual public Firebase web config fields. */ }
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  return apiKey && projectId ? { apiKey, projectId } : null;
}

function authToken(request: Request): string | null {
  const value = request.headers.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._-]{100,5000})$/.exec(value);
  return match?.[1] ?? null;
}

function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function verifyFirebaseToken(token: string, firebase: Config): Promise<boolean> {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebase.apiKey)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    const result = await response.json() as { users?: { localId?: string }[] };
    return response.ok && Boolean(result.users?.[0]?.localId);
  } catch { return false; }
}

function firestoreUrl(firebase: Config, suffix: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebase.projectId)}/databases/(default)/documents${suffix}?key=${encodeURIComponent(firebase.apiKey)}`;
}

async function readCooldown(firebase: Config, token: string): Promise<{ retryAfterMs: number; updateTime?: string } | null> {
  const response = await fetch(firestoreUrl(firebase, `/${DOCUMENT_PATH}`), {
    headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), cache: "no-store",
  });
  if (response.status === 404) return { retryAfterMs: 0 };
  if (!response.ok) return null;
  const doc = await response.json() as FirestoreDocument;
  const lastUsed = Date.parse(doc.fields?.lastUsedAt?.timestampValue || "");
  if (!Number.isFinite(lastUsed)) return null;
  return { retryAfterMs: Math.max(0, lastUsed + COOLDOWN_MS - Date.now()), updateTime: doc.updateTime };
}

async function release(transaction: string, firebase: Config, token: string) {
  await fetch(firestoreUrl(firebase, ":rollback"), { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ transaction }), signal: AbortSignal.timeout(3000), cache: "no-store" }).catch(() => {});
}

async function claimGlobalSlot(firebase: Config, token: string): Promise<{ ok: true } | { ok: false; retryAfterMs: number } | { ok: false; unavailable: true }> {
  const base = firestoreUrl(firebase, "");
  try {
    const begin = await fetch(base.replace(/\?key=/, ":beginTransaction?key="), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ options: { readWrite: {} } }), signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!begin.ok) return { ok: false, unavailable: true };
    const { transaction } = await begin.json() as { transaction?: string };
    if (!transaction) return { ok: false, unavailable: true };

    const read = await fetch(`${base}/${DOCUMENT_PATH}?transaction=${encodeURIComponent(transaction)}&key=${encodeURIComponent(firebase.apiKey)}`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    let exists = read.ok;
    let updateTime: string | undefined;
    let lastUsed = 0;
    if (read.ok) {
      const document = await read.json() as FirestoreDocument;
      updateTime = document.updateTime;
      lastUsed = Date.parse(document.fields?.lastUsedAt?.timestampValue || "");
      if (!Number.isFinite(lastUsed) || !updateTime) { await release(transaction, firebase, token); return { ok: false, unavailable: true }; }
    } else if (read.status !== 404) {
      await release(transaction, firebase, token);
      return { ok: false, unavailable: true };
    }
    const retryAfterMs = Math.max(0, lastUsed + COOLDOWN_MS - Date.now());
    if (retryAfterMs > 0) { await release(transaction, firebase, token); return { ok: false, retryAfterMs }; }

    const documentName = `projects/${firebase.projectId}/databases/(default)/documents/${DOCUMENT_PATH}`;
    const write = {
      update: { name: documentName, fields: {} },
      updateTransforms: [{ fieldPath: "lastUsedAt", setToServerValue: "REQUEST_TIME" }],
      ...(exists ? {} : { currentDocument: { exists: false } }),
    };
    const commit = await fetch(base.replace(/\?key=/, ":commit?key="), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ transaction, writes: [write] }), signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!commit.ok) {
      await release(transaction, firebase, token);
      if (commit.status === 409 || commit.status === 412 || commit.status === 400) {
        const latest = await readCooldown(firebase, token);
        if (latest && latest.retryAfterMs > 0) return { ok: false, retryAfterMs: latest.retryAfterMs };
      }
      return { ok: false, unavailable: true };
    }
    return { ok: true };
  } catch { return { ok: false, unavailable: true }; }
}

export async function GET(request: Request) {
  if (!hasAllowedOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const firebase = config();
  const token = authToken(request);
  if (!firebase || !token || !await verifyFirebaseToken(token, firebase)) return NextResponse.json({ error: "Shared GIF search is not configured or signed in." }, { status: 503 });
  const status = await readCooldown(firebase, token);
  if (!status) return NextResponse.json({ error: "Shared GIF search could not check its cooldown." }, { status: 503 });
  return NextResponse.json({ retryAfterMs: status.retryAfterMs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "GIF search must use JSON." }, { status: 415 });
  const rawLength = Number(request.headers.get("content-length") || 0);
  if (rawLength > 2000) return NextResponse.json({ error: "GIF search request is too large." }, { status: 413 });
  const firebase = config();
  const token = authToken(request);
  const giphyKey = process.env.GIPHY_APP || process.env.GIPHY_API_KEY;
  if (!firebase || !token || !await verifyFirebaseToken(token, firebase)) return NextResponse.json({ error: "Shared GIF search is not configured or signed in." }, { status: 503 });
  if (!giphyKey) return NextResponse.json({ error: "GIF search is not enabled on this Jackcaster instance yet." }, { status: 503 });

  let body: { query?: unknown; offset?: unknown };
  try { body = await request.json() as { query?: unknown; offset?: unknown }; } catch { return NextResponse.json({ error: "GIF search request was not valid." }, { status: 400 }); }
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 50) : "";
  const offset = Number.isInteger(body.offset) ? Number(body.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 90) return NextResponse.json({ error: "GIF page is outside the search limit." }, { status: 400 });

  const slot = await claimGlobalSlot(firebase, token);
  if (!slot.ok) {
    if ("retryAfterMs" in slot) return NextResponse.json({ error: "GIF search is cooling down for everyone. The countdown below shows when the next search opens.", retryAfterMs: slot.retryAfterMs }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(slot.retryAfterMs / 1000))) } });
    return NextResponse.json({ error: "Shared GIF cooldown is unavailable, so search is paused to protect the community quota." }, { status: 503 });
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
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "GIPHY is rate limiting the shared library. Try again after the countdown." : "GIF search is temporarily unavailable." }, { status: 502 });
    const payload = await response.json() as { data?: Array<{ id?: string; title?: string; url?: string; images?: { original?: { url?: string }; downsized_large?: { url?: string }; fixed_width?: { url?: string }; fixed_width_small?: { url?: string } } }>; pagination?: { total_count?: number } };
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
    return NextResponse.json({ items, hasMore: offset + LIMIT < (payload.pagination?.total_count ?? 0), retryAfterMs: COOLDOWN_MS }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "GIPHY could not be reached. The shared cooldown still applies; try again when it ends." }, { status: 502 });
  }
}
