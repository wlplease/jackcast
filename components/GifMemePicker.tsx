"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type GifItem = { id: string; url: string; preview: string; title: string };
type GiphyItem = { id: string; title?: string; images?: { original?: { url?: string }; fixed_width_small?: { url?: string } } };

export function GifMemePicker({ disabled, onSelect, onMeme }: {
  disabled: boolean;
  onSelect: (gif: { url: string; preview: string; title: string }) => void;
  onMeme: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"gifs" | "meme">("gifs");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function search(term = "") {
    setLoading(true);
    setError("");
    try {
      const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      if (!key) throw new Error("GIF search needs a GIPHY API key. You can still make a meme from any photo or paste a GIF link.");
      const endpoint = term.trim() ? "search" : "trending";
      const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`);
      url.searchParams.set("api_key", key);
      url.searchParams.set("limit", "18");
      url.searchParams.set("rating", "g");
      if (term.trim()) url.searchParams.set("q", term.trim().slice(0, 50));
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const data = await response.json() as { data?: GiphyItem[]; meta?: { status?: number } };
      if (!response.ok) throw new Error("GIF search is temporarily unavailable. Try again in a moment.");
      setItems((data.data ?? []).flatMap((item) => {
        const full = item.images?.original?.url;
        const preview = item.images?.fixed_width_small?.url;
        if (!full || !preview) return [];
        try {
          const fullUrl = new URL(full);
          const previewUrl = new URL(preview);
          const isGiphyHost = (hostname: string) => hostname === "giphy.com" || hostname.endsWith(".giphy.com");
          if (fullUrl.protocol !== "https:" || previewUrl.protocol !== "https:" || !isGiphyHost(fullUrl.hostname) || !isGiphyHost(previewUrl.hostname)) return [];
          return [{ id: item.id, url: fullUrl.href, preview: previewUrl.href, title: (item.title || "GIF").slice(0, 120) }];
        } catch { return []; }
      }));
    } catch (reason) { setError((reason as Error).message || "GIF search could not load."); setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (open && tab === "gifs" && items.length === 0 && !error) void search();
    // Load featured GIFs once per picker open; search() is intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

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
        <form className="gif-search" onSubmit={(event) => { event.preventDefault(); void search(query); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reactions, moments…" aria-label="Search GIFs" /><button type="submit" disabled={loading}>{loading ? "…" : "Search"}</button></form>
        {error && <div className="gif-picker-message">{error}{error.includes("GIPHY API key") && <span> Add <code>NEXT_PUBLIC_GIPHY_API_KEY</code> to the app environment to enable search.</span>}</div>}
        {!error && <div className="gif-picker-grid">{items.map((item) => <button type="button" key={item.id} title={item.title} onClick={() => { onSelect({ url: item.url, preview: item.preview, title: item.title }); setOpen(false); }}><img src={item.preview} alt={item.title} loading="lazy" /></button>)}</div>}
        {!loading && !error && items.length === 0 && <p className="gif-picker-message">No GIFs found. Try another search.</p>}
        <label className="gif-paste">Or paste a GIF link<input type="url" placeholder="https://…" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const input = event.currentTarget; try { const url = new URL(input.value); if (url.protocol !== "https:") throw new Error(); onSelect({ url: url.href, preview: url.href, title: "GIF" }); setOpen(false); } catch { setError("Paste a valid HTTPS GIF link."); } } }} /></label>
        <small className="gif-attribution">GIFs by GIPHY</small>
      </> : <div className="meme-maker">
        <button type="button" className="meme-image-button" onClick={() => fileRef.current?.click()}>{imagePreview ? <img src={imagePreview} alt="Meme source preview" /> : <span>Choose a photo for your meme</span>}</button>
        <input value={topText} maxLength={120} onChange={(event) => setTopText(event.target.value)} placeholder="Top caption" aria-label="Top meme caption" />
        <input value={bottomText} maxLength={120} onChange={(event) => setBottomText(event.target.value)} placeholder="Bottom caption" aria-label="Bottom meme caption" />
        <button type="button" className="btn" onClick={() => void makeMeme()}>{image ? "Add meme to cast" : "Choose photo"}</button>
      </div>}
    </section>}
  </div>;
}
