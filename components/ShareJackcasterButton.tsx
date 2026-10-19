"use client";

import { useState } from "react";
import { MAX_CAST_BYTES, withCastAttribution } from "@/lib/cast-attribution";

const APP_TAGS = ["#Farcaster", "#Selfcaster", "#Jackcast"] as const;

const SHARE_OPTIONS = {
  signal: {
    product: "Jackcast",
    href: "/",
    label: "A new Farcaster feed",
    text: "Farcaster, on your terms. Jackcast brings chronological feeds, your circles, Mini Apps, and media together in one open-source client built on Selfcaster. Take a look:",
    tags: [...APP_TAGS],
  },
  miniapps: {
    product: "Jackcast",
    href: "/",
    label: "Mini Apps, media, and music",
    text: "Mini Apps, video, audio, a built-in soundtrack, and useful profile stats—all alongside my Farcaster feeds in Jackcast. It’s an open-source Selfcaster fork. What would you explore first?",
    tags: [...APP_TAGS],
  },
  opensource: {
    product: "Jackcast",
    href: "/",
    label: "Open source and customizable",
    text: "Jackcast is an open-source Farcaster client built on GenuineJack’s Selfcaster. The code, setup guide, and changes are public. Fork it, make it yours, or send an idea or fix:",
    tags: [...APP_TAGS],
  },
  community: {
    product: "Jackcast",
    href: "/",
    label: "Made for the Farcaster community",
    text: "I use Jackcast to keep up with people I follow, a separate Friends feed, community leaders, and recasts in their own view. Set up your feeds your way, then tell me what you think:",
    tags: [...APP_TAGS],
  },
  tools: {
    product: "Jackcast",
    href: "/",
    label: "A useful Farcaster toolkit",
    text: "Jackcast puts separate feeds, Mini Apps, video and audio, optional AI catch-up, and a music player in one place. It’s an open-source Selfcaster fork. What would make your Farcaster setup better?",
    tags: [...APP_TAGS],
  },
  selfcaster: {
    product: "Selfcaster",
    href: "https://selfcaster.xyz/",
    label: "Original Selfcaster",
    text: "Meet Selfcaster, the original open-source Farcaster client by @genuinejack. Jackcast is an independent fork built on that work. Explore the original and the new client:",
    tags: [...APP_TAGS],
  },
} as const;

type ShareStyle = keyof typeof SHARE_OPTIONS;

export function ShareJackcasterButton({ full = false }: { full?: boolean }) {
  const [style, setStyle] = useState<ShareStyle>("signal");
  const [tags, setTags] = useState<string[]>([...SHARE_OPTIONS.signal.tags]);
  const [castText, setCastText] = useState<string>(SHARE_OPTIONS.signal.text);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const selectedOption = SHARE_OPTIONS[style];
  const tagLine = tags.length ? `\n\n${tags.join(" > ")}` : "";
  const finalText = withCastAttribution(`${castText.trim()}${tagLine}`);
  const finalBytes = new TextEncoder().encode(finalText).length;
  const appUrl = selectedOption.href === "/" ? "https://jackcast.vercel.app/" : selectedOption.href;
  const copyText = `${finalText}\n\n${appUrl}`;
  const copyBytes = new TextEncoder().encode(copyText).length;
  const tooLong = finalBytes > MAX_CAST_BYTES;
  const copyTooLong = copyBytes > MAX_CAST_BYTES;

  async function copyShareText() {
    if (!castText.trim() || copyTooLong) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("Clipboard access is unavailable here. You can select the preview text and copy it.");
    }
  }

  async function share() {
    if (busy || !castText.trim() || tooLong) return;
    setBusy(true);
    const appUrl = selectedOption.href === "/" ? "https://jackcast.vercel.app/" : selectedOption.href;
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        await sdk.actions.composeCast({ text: finalText, embeds: [appUrl] });
        setBusy(false);
        return;
      }
    } catch { /* Use Jackcaster's compose screen outside Farcaster. */ }
    window.location.assign(`/compose?text=${encodeURIComponent(finalText)}&url=${encodeURIComponent(appUrl)}`);
  }

  return <div className={`share-jackcaster${full ? " full" : " compact"}`}>
    {full && <>
      <label htmlFor="share-angle">Share idea<select id="share-angle" value={style} onChange={(event) => { const next = event.target.value as ShareStyle; setStyle(next); setTags([...SHARE_OPTIONS[next].tags]); setCastText(SHARE_OPTIONS[next].text); setCopied(false); setCopyError(""); }}>
        {(Object.entries(SHARE_OPTIONS) as [ShareStyle, typeof SHARE_OPTIONS[ShareStyle]][]).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
      </select></label>
      <label htmlFor="share-copy-input">Cast text<textarea id="share-copy-input" className="share-copy-input" rows={5} maxLength={MAX_CAST_BYTES} value={castText} onChange={(event) => { setCastText(event.target.value); setCopied(false); setCopyError(""); }} /><small className={`share-char-count${tooLong ? " over" : ""}`} aria-live="polite">{finalBytes} / {MAX_CAST_BYTES} bytes · includes tags and Jackcast source</small></label>
      <fieldset className="share-tags"><legend>Discovery tags</legend><p>Keep the project trail or pick only the tags that fit your post.</p>
        {Array.from(new Set(Object.values(SHARE_OPTIONS).flatMap((option) => option.tags))).map((tag) => <button type="button" key={tag} className={tags.includes(tag) ? "active" : ""} aria-pressed={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 3} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 3 ? [...current, tag] : current)}>{tag}</button>)}
      </fieldset>
      <div className="share-preview"><small>EXACT CAST TEXT · {selectedOption.product.toUpperCase()}</small><p>{finalText}</p><div className="share-preview-link"><span aria-hidden="true">↗</span><strong>Attached link</strong><code>{selectedOption.href === "/" ? "Jackcast home" : selectedOption.href}</code></div></div>
      {tooLong && <p className="share-status" role="alert">Shorten the cast text or remove a tag to fit the 1,024-byte Farcaster limit.</p>}
      {copyError && <p className="share-status" role="alert">{copyError}</p>}
    </>}
    {full ? <div className="share-actions">
      <button type="button" className="btn primary" onClick={() => void share()} disabled={busy || !castText.trim() || tooLong} aria-live="polite"><span aria-hidden="true">✦</span> {busy ? "Opening cast composer…" : "Open Farcaster composer"}</button>
      <button type="button" className="btn ghost" onClick={() => void copyShareText()} disabled={!castText.trim() || copyTooLong}>{copied ? "Copied" : "Copy share text"}</button>
    </div> : <button type="button" className="share-jackcaster-button" onClick={() => void share()} disabled={busy} aria-live="polite"><span aria-hidden="true">✦</span> {busy ? "Opening cast composer…" : "Share Jackcast"}</button>}
    {full && <small className="share-ready-note" role="status">{copyTooLong ? `Copy is ${copyBytes - MAX_CAST_BYTES} bytes over the limit; shorten the text to include the link.` : copied ? "Copied with the link and tags." : "Review your cast in Farcaster before posting."}</small>}
  </div>;
}
