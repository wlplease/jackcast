"use client";

import { useState } from "react";
import { withCastAttribution } from "@/lib/cast-attribution";

const SHARE_OPTIONS = {
  signal: {
    product: "Jackcaster",
    href: "/",
    label: "A calmer feed",
    text: "Want a calmer Farcaster feed? Jackcaster brings chronological posts, customizable feeds, and useful tools together without engagement ranking. Built on the open-source Selfcaster project: https://selfcaster.xyz. Give it a try:",
    tags: ["#Farcaster", "#Jackcaster"],
  },
  miniapps: {
    product: "Jackcaster",
    href: "/",
    label: "Mini Apps, media, and music",
    text: "Discover Farcaster posts, Mini Apps, video, audio, and music in one place with Jackcaster. Built on the open-source Selfcaster project: https://selfcaster.xyz. Take a look and tell me what you think:",
    tags: ["#Farcaster", "#MiniApps", "#Jackcaster"],
  },
  opensource: {
    product: "Jackcaster",
    href: "/",
    label: "Open source and customizable",
    text: "Jackcaster is my open-source Farcaster client fork, built on Selfcaster: https://selfcaster.xyz. Customize your feeds, explore Mini Apps, and help shape what comes next:",
    tags: ["#Farcaster", "#OpenSource", "#Jackcaster"],
  },
  community: {
    product: "Jackcaster",
    href: "/",
    label: "Made for the Farcaster community",
    text: "I’m trying Jackcaster, an open-source Farcaster client with feeds you can shape around your community. It’s built on Selfcaster: https://selfcaster.xyz. Come explore and share feedback:",
    tags: ["#Farcaster", "#Jackcaster", "#OpenSource"],
  },
  tools: {
    product: "Jackcaster",
    href: "/",
    label: "A useful Farcaster toolkit",
    text: "Jackcaster brings a chronological feed, Friends, Recasts, Mini Apps, media, profile analytics, and an optional AI catch-up into one open-source client. Built on Selfcaster: https://selfcaster.xyz. See what you think:",
    tags: ["#Farcaster", "#Jackcaster", "#MiniApps"],
  },
  selfcaster: {
    product: "Selfcaster",
    href: "https://selfcaster.xyz/",
    label: "Original Selfcaster",
    text: "Meet Selfcaster, the original open-source Farcaster client by @genuinejack. Explore the project and support the people building Farcaster tools:",
    tags: ["#Farcaster", "#Selfcaster", "#OpenSource"],
  },
} as const;

type ShareStyle = keyof typeof SHARE_OPTIONS;

export function ShareJackcasterButton({ full = false }: { full?: boolean }) {
  const [style, setStyle] = useState<ShareStyle>("signal");
  const [tags, setTags] = useState<string[]>([...SHARE_OPTIONS.signal.tags]);
  const [castText, setCastText] = useState<string>(SHARE_OPTIONS.signal.text);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    const option = SHARE_OPTIONS[style];
    const appUrl = new URL(option.href, window.location.origin).href;
    const text = withCastAttribution(`${castText.trim()}${tags.length ? `\n\n${tags.join(" ")}` : ""}`);
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        await sdk.actions.composeCast({ text, embeds: [appUrl] });
        setBusy(false);
        return;
      }
    } catch { /* Use Jackcaster's compose screen outside Farcaster. */ }
    window.location.assign(`/compose?text=${encodeURIComponent(text)}&url=${encodeURIComponent(appUrl)}`);
  }

  return <div className={`share-jackcaster${full ? " full" : " compact"}`}>
    {full && <>
      <label>Share angle<select value={style} onChange={(event) => { const next = event.target.value as ShareStyle; setStyle(next); setTags([...SHARE_OPTIONS[next].tags]); setCastText(SHARE_OPTIONS[next].text); }}>
        {(Object.entries(SHARE_OPTIONS) as [ShareStyle, typeof SHARE_OPTIONS[ShareStyle]][]).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
      </select></label>
      <label>Cast text<textarea className="share-copy-input" rows={5} maxLength={320 - (tags.length ? tags.join(" ").length + 2 : 0)} value={castText} onChange={(event) => setCastText(event.target.value)} /><small className="share-char-count">{Math.max(0, 320 - castText.length - (tags.length ? tags.join(" ").length + 2 : 0))} characters left before tags</small></label>
      <fieldset className="share-tags"><legend>Discovery tags</legend><p>Choose a few relevant tags. You can edit everything before posting.</p>
        {Array.from(new Set(Object.values(SHARE_OPTIONS).flatMap((option) => option.tags))).map((tag) => <button type="button" key={tag} className={tags.includes(tag) ? "active" : ""} aria-pressed={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 3} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 3 ? [...current, tag] : current)}>{tag}</button>)}
      </fieldset>
      <div className="share-preview"><small>CAST PREVIEW · {SHARE_OPTIONS[style].product.toUpperCase()}</small><p>{castText}</p>{tags.length > 0 && <span>{tags.join(" ")}</span>}<small>{SHARE_OPTIONS[style].product} will be attached as a link. Edit the copy and tags before opening Farcaster.</small></div>
    </>}
    <button type="button" className={full ? "btn primary" : "share-jackcaster-button"} onClick={() => void share()} disabled={busy}>
      <span aria-hidden="true">✦</span> {busy ? "Opening cast composer…" : "Share Jackcaster"}
    </button>
  </div>;
}
