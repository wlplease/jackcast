"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";

type GifItem = { id: string; url: string; preview: string; title: string; sourceUrl?: string };
type GiphyImage = { url?: string };
type GiphyItem = { id: string; title?: string; url?: string; images?: { original?: GiphyImage; downsized_large?: GiphyImage; fixed_width?: GiphyImage; fixed_width_small?: GiphyImage } };

function directGifUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/\.gif$/i.test(url.pathname)) return null;
    if (/^media\d*\.giphy\.com$/i.test(url.hostname)) {
      // GIPHY's cid/tracking query is unnecessary for its public media path and can
      // push a valid image embed over Farcaster's URL length limit.
      url.search = "";
      url.hash = "";
    }
    return url.href.length <= 256 ? url.href : null;
  } catch { return null; }
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
  const [category, setCategory] = useState("Trending");
  const [items, setItems] = useState<GifItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userApiKey, setUserApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [rememberApiKey, setRememberApiKey] = useState(true);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [keySettingsOpen, setKeySettingsOpen] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jackcaster.giphy.api-key.v1") || "";
      setUserApiKey(saved);
      setApiKeyDraft(saved);
      setRememberApiKey(true);
      if (!saved && !process.env.NEXT_PUBLIC_GIPHY_API_KEY) setKeySettingsOpen(true);
    } catch {}
    setApiKeyReady(true);
  }, []);

  function saveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = apiKeyDraft.trim();
    if (key && (key.length < 8 || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key))) {
      setKeyMessage("Enter a valid GIPHY API key (letters, numbers, _ or - only).");
      return;
    }
    try {
      if (key && rememberApiKey) localStorage.setItem("jackcaster.giphy.api-key.v1", key);
      else localStorage.removeItem("jackcaster.giphy.api-key.v1");
    } catch {
      setKeyMessage("This browser could not save the key. Check its storage settings.");
      return;
    }
    setUserApiKey(key);
    setKeyMessage(key ? (rememberApiKey ? "Your key is saved in this browser." : "Your key will be used until you close or reload this page.") : "Your personal key was removed.");
    setError("");
    setItems([]);
    setOffset(0);
    setHasMore(false);
  }

  async function search(term = "", append = false) {
    setLoading(true);
    setError("");
    try {
      const key = userApiKey.trim() || process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      if (!key) throw new Error("Add a GIPHY API key below to search. You can still make a meme or paste a GIF link without one.");
      const endpoint = term.trim() ? "search" : "trending";
      const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`);
      url.searchParams.set("api_key", key);
      url.searchParams.set("limit", "18");
      url.searchParams.set("offset", String(append ? offset : 0));
      url.searchParams.set("rating", "g");
      if (term.trim()) url.searchParams.set("q", term.trim().slice(0, 50));
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const data = await response.json() as { data?: GiphyItem[]; meta?: { status?: number } };
      if (!response.ok) throw new Error("GIF search is temporarily unavailable. Try again in a moment.");
      const nextItems = (data.data ?? []).flatMap((item) => {
        const full = [item.images?.original?.url, item.images?.downsized_large?.url, item.images?.fixed_width?.url, item.images?.fixed_width_small?.url]
          .map(directGifUrl).find((url): url is string => Boolean(url));
        const preview = item.images?.fixed_width_small?.url;
        if (!full || !preview || !item.id) return [];
        try {
          const previewUrl = new URL(preview);
          const pageUrl = item.url ? new URL(item.url) : undefined;
          const isGiphyHost = (hostname: string) => hostname === "giphy.com" || hostname.endsWith(".giphy.com");
          if (previewUrl.protocol !== "https:" || !isGiphyHost(new URL(full).hostname) || !isGiphyHost(previewUrl.hostname)) return [];
          if (pageUrl && (pageUrl.protocol !== "https:" || !isGiphyHost(pageUrl.hostname))) return [];
          return [{ id: item.id, url: full, preview: previewUrl.href, title: (item.title || "GIF").slice(0, 120), sourceUrl: pageUrl?.href }];
        } catch { return []; }
      });
      setItems((current) => append ? [...current, ...nextItems.filter((item) => !current.some((saved) => saved.id === item.id))] : nextItems);
      setOffset((current) => append ? current + (data.data?.length ?? 0) : (data.data?.length ?? 0));
      setHasMore((data.data?.length ?? 0) === 18);
    } catch (reason) {
      setError((reason as Error).message || "GIF search could not load.");
      if (!append) { setItems([]); setOffset(0); setHasMore(false); }
    }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (apiKeyReady && open && tab === "gifs" && items.length === 0 && !error) void search();
    // Load featured GIFs once per picker open; search() is intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyReady, open, tab, userApiKey]);

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
        <details className="gif-key-settings" open={keySettingsOpen} onToggle={(event) => setKeySettingsOpen(event.currentTarget.open)}>
          <summary>Use your own GIPHY API key</summary>
          <p>Get a web API key from GIPHY, then save it just for this browser. Jackcaster sends it directly to GIPHY for GIF search.</p>
          <form className="gif-key-form" onSubmit={saveApiKey}>
            <input type="password" value={apiKeyDraft} maxLength={128} autoComplete="off" spellCheck={false} onChange={(event) => { setApiKeyDraft(event.target.value); setKeyMessage(""); }} placeholder="Paste your GIPHY API key" aria-label="Your GIPHY API key" />
            <button type="submit">Save key</button>
            <label className="gif-remember-key"><input type="checkbox" checked={rememberApiKey} onChange={(event) => setRememberApiKey(event.target.checked)} /> Remember key on this device</label>
          </form>
          {keyMessage && <small className="gif-key-message" role="status">{keyMessage}</small>}
          <small className="gif-key-links"><a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer">Get a GIPHY API key ↗</a> · <a href="https://developers.giphy.com/docs/api/" target="_blank" rel="noreferrer">GIPHY API guide</a></small>
        </details>
        <form className="gif-search" onSubmit={(event) => { event.preventDefault(); setCategory(""); void search(query); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reactions, moments…" aria-label="Search GIFs" /><button type="submit" disabled={loading}>{loading ? "…" : "Search"}</button></form>
        <div className="gif-categories" role="group" aria-label="GIF categories">{GIF_CATEGORIES.map((item) => <button key={item.label} type="button" className={category === item.label ? "active" : ""} disabled={loading} onClick={() => { setCategory(item.label); setQuery(item.query); void search(item.query); }}>{item.label}</button>)}</div>
        {error && <div className="gif-picker-message">{error}</div>}
        {!error && <div className="gif-picker-grid">{items.map((item) => <div className="gif-picker-item" key={item.id}>
          <button type="button" className="gif-picker-select" title={`Add ${item.title}`} onClick={() => { onSelect({ url: item.url, preview: item.preview, title: item.title, sourceUrl: item.sourceUrl }); setOpen(false); }}><img src={item.preview} alt={item.title} loading="lazy" /></button>
          {item.sourceUrl && <a className="gif-picker-open" href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} on GIPHY`} title="Open on GIPHY">↗</a>}
        </div>)}</div>}
        {!error && hasMore && <button type="button" className="gif-load-more" disabled={loading} onClick={() => void search(category && !query ? GIF_CATEGORIES.find((item) => item.label === category)?.query ?? query : query, true)}>{loading ? "Loading…" : "Load more GIFs"}</button>}
        {!loading && !error && items.length === 0 && <p className="gif-picker-message">No GIFs found. Try another search.</p>}
        <label className="gif-paste">Or paste a direct GIF image URL<input type="url" placeholder="https://…/image.gif" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const input = event.currentTarget; const url = directGifUrl(input.value.trim()); if (url) { onSelect({ url, preview: url, title: "GIF" }); setOpen(false); } else { setError("Use GIF search or paste a direct HTTPS .gif image URL. Share-page links do not embed as animations."); } } }} /></label>
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
