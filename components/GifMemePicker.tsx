"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { trackUsage } from "@/components/UsageAnalytics";

type GifItem = { id: string; url: string; preview: string; title: string; sourceUrl?: string };
type SearchResult = { items?: GifItem[]; hasMore?: boolean; retryAfterMs?: number; scope?: "global" | "session" | null; error?: string };
type GiphyPayload = { data?: Array<{ id?: string; title?: string; url?: string; images?: { original?: { url?: string }; downsized_large?: { url?: string }; fixed_width?: { url?: string }; fixed_width_small?: { url?: string } } }>; pagination?: { total_count?: number } };
const PERSONAL_KEY_STORAGE = "jackcaster:giphy-personal-key:v1";
const GIF_LIMIT = 18;

function normalizeGiphyResults(payload: GiphyPayload): { items: GifItem[]; hasMore: boolean } {
  const items = (payload.data ?? []).flatMap((item) => {
    const full = [item.images?.original?.url, item.images?.downsized_large?.url, item.images?.fixed_width?.url, item.images?.fixed_width_small?.url].find((candidate) => {
      try { const value = new URL(candidate || ""); return value.protocol === "https:" && /^media\d*\.giphy\.com$/i.test(value.hostname) && /\.gif$/i.test(value.pathname) && value.href.length <= 256; } catch { return false; }
    });
    try {
      const imageUrl = new URL(full || "");
      const previewUrl = new URL(item.images?.fixed_width_small?.url || "");
      const pageUrl = item.url ? new URL(item.url) : undefined;
      if (!item.id || previewUrl.protocol !== "https:" || !/^media\d*\.giphy\.com$/i.test(previewUrl.hostname) || !pageUrl || pageUrl.protocol !== "https:" || !/(^|\.)giphy\.com$/i.test(pageUrl.hostname)) return [];
      return [{ id: item.id.slice(0, 96), url: imageUrl.href, preview: previewUrl.href, title: (item.title || "GIF").slice(0, 120), sourceUrl: pageUrl.href }];
    } catch { return []; }
  });
  return { items, hasMore: (payload.pagination?.total_count ?? 0) > 0 };
}

const GIF_CATEGORIES = [
  { label: "Trending", query: "" },
  { label: "Reactions", query: "reaction" },
  { label: "Celebrate", query: "celebration" },
  { label: "Hello", query: "hello wave" },
  { label: "Thinking", query: "thinking" },
  { label: "Crypto & Web3", query: "crypto web3" },
] as const;

export function GifMemePicker({ disabled, onSelect, onMeme }: {
  disabled: boolean;
  onSelect: (gif: { url: string; preview: string; title: string; sourceUrl?: string }) => void;
  onMeme: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"gifs" | "meme">("gifs");
  const [query, setQuery] = useState("");
  const [personalKey, setPersonalKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [category, setCategory] = useState("Trending");
  const [items, setItems] = useState<GifItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingGate, setCheckingGate] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [cooldownScope, setCooldownScope] = useState<"global" | "session" | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const personalKeyDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSONAL_KEY_STORAGE) || "";
      setPersonalKey(saved);
      setKeyDraft(saved);
    } catch { /* Private browsing may disable local storage. */ }
  }, []);

  const coolingDown = cooldownMs > 0;
  const secondsLeft = Math.max(0, Math.ceil(cooldownMs / 1000));

  useEffect(() => {
    if (!open || tab !== "gifs") return;
    if (personalKey) { setCheckingGate(false); setCooldownMs(0); return; }
    let active = true;
    setError("");
    setCheckingGate(true);
    void (async () => {
      try {
        const response = await fetch("/api/giphy/search", { cache: "no-store" });
        const data = await response.json() as SearchResult;
        if (!response.ok) throw new Error(data.error || "Shared GIF search is not available.");
        if (active) { setCooldownMs(data.retryAfterMs || 0); setCooldownScope(data.scope ?? null); }
      } catch (reason) {
        if (active) {
          const message = (reason as Error).message || "Shared GIF search is not available.";
          setError(message);
        }
      } finally { if (active) setCheckingGate(false); }
    })();
    return () => { active = false; };
  }, [open, tab, personalKey]);

  useEffect(() => {
    if (!cooldownMs) return;
    const startedAt = Date.now();
    const initial = cooldownMs;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, initial - (Date.now() - startedAt));
      setCooldownMs(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [cooldownMs > 0]);

  async function search(term = "", append = false) {
    if ((!personalKey && cooldownMs > 0) || checkingGate) return;
    setLoading(true);
    setError("");
    try {
      const queryText = term.trim().slice(0, 50);
      const nextOffset = append ? offset : 0;
      let nextItems: GifItem[];
      let more: boolean;
      if (personalKey) {
        // The user's own key goes directly from this browser to GIPHY and is never sent
        // to Jackcaster's server. GIPHY requires its Trending endpoint to be client-side.
        const endpoint = queryText ? "search" : "trending";
        const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`);
        url.searchParams.set("api_key", personalKey.trim());
        url.searchParams.set("limit", String(GIF_LIMIT));
        url.searchParams.set("offset", String(nextOffset));
        url.searchParams.set("rating", "g");
        if (queryText) url.searchParams.set("q", queryText);
        const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "GIPHY did not accept this key. Check it and save again." : "GIPHY personal-key search is temporarily unavailable.");
        const payload = await response.json() as GiphyPayload;
        const normalized = normalizeGiphyResults(payload);
        nextItems = normalized.items;
        more = nextOffset + nextItems.length < (payload.pagination?.total_count ?? 0) && nextOffset + nextItems.length < 90;
      } else {
        const response = await fetch("/api/giphy/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: queryText, offset: nextOffset }), signal: AbortSignal.timeout(12000) });
        const data = await response.json() as SearchResult;
        if (data.retryAfterMs) { setCooldownMs(data.retryAfterMs); setCooldownScope(data.scope ?? "global"); }
        if (response.status === 429) { setError(""); return; }
        if (!response.ok) throw new Error(data.error || "GIF search is temporarily unavailable.");
        nextItems = data.items ?? [];
        more = Boolean(data.hasMore) && nextOffset + nextItems.length < 90;
      }
      trackUsage({ name: "gif_search", source: personalKey ? "personal" : "shared" });
      setItems((current) => append ? [...current, ...nextItems.filter((item) => !current.some((saved) => saved.id === item.id))] : nextItems);
      setOffset((current) => append ? current + nextItems.length : nextItems.length);
      setHasMore(more);
    } catch (reason) {
      setError((reason as Error).message || "GIF search could not load.");
      const retryAfter = Number((reason as Error & { retryAfterMs?: number }).retryAfterMs);
      if (retryAfter > 0) setCooldownMs(retryAfter);
      if (!append) { setItems([]); setOffset(0); setHasMore(false); }
    }
    finally { setLoading(false); }
  }

  function savePersonalKey() {
    const value = keyDraft.trim().slice(0, 256);
    try {
      if (value) localStorage.setItem(PERSONAL_KEY_STORAGE, value);
      else localStorage.removeItem(PERSONAL_KEY_STORAGE);
    } catch {
      if (value) { setError("This browser could not save the key on this device. Allow local storage or use the shared search."); return; }
    }
    setPersonalKey(value);
    setKeyDraft(value);
    setKeySaved(true);
    window.setTimeout(() => setKeySaved(false), 2500);
    setItems([]); setOffset(0); setHasMore(false); setCooldownMs(0); setCooldownScope(null); setError("");
  }

  useEffect(() => {
    if (open && tab === "gifs" && items.length === 0 && !error && !checkingGate && cooldownMs <= 0) void search();
    // Load featured GIFs once per picker open; search() is intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, checkingGate, cooldownMs, items.length, error]);

  function chooseFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  async function makeMeme() {
    if (!image || !imagePreview) { fileRef.current?.click(); return; }
    setError("");
    try {
      const bitmap = await createImageBitmap(image);
      const scale = Math.min(1, 1200 / bitmap.width, 1200 / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not create the meme image.");
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const fontSize = Math.max(22, Math.round(width / 13));
      context.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
      context.textAlign = "center";
      context.lineJoin = "round";
      context.lineWidth = Math.max(3, fontSize / 9);
      context.strokeStyle = "#111";
      context.fillStyle = "#fff";
      const drawCaption = (value: string, y: number) => {
        const words = value.trim().toUpperCase().split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (context.measureText(next).width > width - 36 && line) { lines.push(line); line = word; }
          else line = next;
        }
        if (line) lines.push(line);
        lines.slice(0, 3).forEach((part, index) => {
          const lineY = y + (index - (Math.min(lines.length, 3) - 1) / 2) * (fontSize * 1.1);
          context.strokeText(part, width / 2, lineY, width - 30);
          context.fillText(part, width / 2, lineY, width - 30);
        });
      };
      if (topText.trim()) drawCaption(topText, fontSize * 1.45);
      if (bottomText.trim()) drawCaption(bottomText, height - fontSize * 0.65);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not export meme image.")), "image/jpeg", 0.9));
      onMeme(new File([blob], "jackcaster-meme.jpg", { type: "image/jpeg" }));
      setOpen(false);
    } catch (reason) { setError((reason as Error).message || "Could not make that meme."); }
  }

  return <div className="gif-picker-wrap">
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
    <button type="button" className="tool gif-picker-trigger" disabled={disabled} aria-label="Add GIF or make a meme" title="Add GIF or make a meme" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">GIF</span></button>
    {open && <section className="gif-picker" aria-label="GIF and meme picker">
      <div className="gif-picker-head"><strong>Add a GIF or meme</strong><button type="button" aria-label="Close GIF picker" onClick={() => setOpen(false)}>×</button></div>
      <div className="gif-picker-tabs"><button type="button" className={tab === "gifs" ? "active" : ""} onClick={() => setTab("gifs")}>Find a GIF</button><button type="button" className={tab === "meme" ? "active" : ""} onClick={() => setTab("meme")}>Make a meme</button></div>
      {tab === "gifs" ? <>
        <details ref={personalKeyDetailsRef} className="gif-personal-key"><summary>{personalKey ? "Using your personal GIPHY key" : "Use your own GIPHY key (optional)"}</summary><p>Your key is saved in this browser&apos;s local storage and sent directly to GIPHY; Jackcaster&apos;s server never receives it. Local storage is available to scripts running on this site, so use a key you control and remove it before using a shared device. Get a key from the <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer">GIPHY developer dashboard</a>. The free shared search works without Firebase sign-in: one search globally every 45 seconds, and one per browser session every five minutes.</p><label htmlFor="giphy-personal-key">GIPHY API key</label><input id="giphy-personal-key" type="password" autoComplete="off" value={keyDraft} maxLength={256} onChange={(event) => setKeyDraft(event.target.value)} placeholder="Paste your personal GIPHY key" /><div className="gif-personal-key-actions"><button type="button" className="btn sm" disabled={!keyDraft.trim() && !personalKey} onClick={savePersonalKey}>{keySaved ? "Saved on this device" : keyDraft.trim() ? "Save key on this device" : "Remove saved key"}</button>{personalKey && <span>Personal searches follow your GIPHY key&apos;s own quota.</span>}</div></details>
        <p className="gif-shared-note">{personalKey ? "Searching GIPHY with your personal key · direct from this browser" : "Free shared GIPHY search · one request globally every 45 seconds"}</p>
        <form className="gif-search" onSubmit={(event) => { event.preventDefault(); setCategory(""); void search(query); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reactions, moments…" aria-label="Search GIFs" /><button type="submit" disabled={loading || checkingGate || coolingDown}>{loading || checkingGate ? "…" : coolingDown ? `${secondsLeft}s` : "Search"}</button></form>
        <div className="gif-categories" role="group" aria-label="GIF categories">{GIF_CATEGORIES.map((item) => <button key={item.label} type="button" className={category === item.label ? "active" : ""} disabled={loading || checkingGate || coolingDown} onClick={() => { setCategory(item.label); setQuery(item.query); void search(item.query); }}>{item.label}</button>)}</div>
        {coolingDown && <div className="gif-picker-cooldown" role="status">{cooldownScope === "session" ? "Your session’s next free search opens in" : "The next free shared search opens in"} <strong>{secondsLeft}s</strong>. {cooldownScope === "session" ? "Each browser session gets one free search every five minutes." : "The shared library is first-come-first-served, once every 45 seconds."}</div>}
        {checkingGate && <div className="gif-picker-message" role="status">Checking shared search window…</div>}
        {error && <div className="gif-picker-message" role="alert">{error}</div>}
        {!error && <div className="gif-picker-grid">{items.map((item) => <div className="gif-picker-item" key={item.id}>
          <button type="button" className="gif-picker-select" title={`Add ${item.title}`} onClick={() => { onSelect({ url: item.url, preview: item.preview, title: item.title, sourceUrl: item.sourceUrl }); setOpen(false); }}><img src={item.preview} alt={item.title} loading="lazy" /></button>
          {item.sourceUrl && <a className="gif-picker-open" href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} on GIPHY`} title="Open on GIPHY">↗</a>}
        </div>)}</div>}
        {!error && hasMore && <button type="button" className="gif-load-more" disabled={loading || checkingGate || coolingDown} onClick={() => void search(category && !query ? GIF_CATEGORIES.find((item) => item.label === category)?.query ?? query : query, true)}>{loading ? "Loading…" : coolingDown ? `Load more in ${secondsLeft}s` : "Load more GIFs"}</button>}
        {!loading && !error && items.length === 0 && <p className="gif-picker-message">No GIFs found. Try another search.</p>}
        <small className="gif-attribution">Powered By GIPHY</small>
      </> : <div className="meme-maker">
        <button type="button" className="meme-image-button" onClick={() => fileRef.current?.click()}>{imagePreview ? <img src={imagePreview} alt="Meme source preview" /> : <span>Choose a photo for your meme</span>}</button>
        <input value={topText} maxLength={120} onChange={(event) => setTopText(event.target.value)} placeholder="Top caption" aria-label="Top meme caption" />
        <input value={bottomText} maxLength={120} onChange={(event) => setBottomText(event.target.value)} placeholder="Bottom caption" aria-label="Bottom meme caption" />
        <button type="button" className="btn" onClick={() => void makeMeme()}>{image ? "Add meme to cast" : "Choose photo"}</button>
      </div>}
    </section>}
  </div>;
}
