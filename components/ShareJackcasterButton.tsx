"use client";

import { useState } from "react";

const SHARE_OPTIONS = {
  signal: {
    product: "Jackcaster",
    href: "/",
    label: "A calmer feed",
    text: "Want a calmer Farcaster feed? Jackcaster brings chronological posts, customizable feeds, and useful tools together without engagement ranking. Give it a try:",
    tags: ["#Farcaster", "#Jackcaster"],
  },
  miniapps: {
    product: "Jackcaster",
    href: "/",
    label: "Mini Apps, media, and music",
    text: "Discover Farcaster posts, Mini Apps, video, audio, and music in one place with Jackcaster. Take a look and tell me what you think:",
    tags: ["#Farcaster", "#MiniApps", "#Jackcaster"],
  },
  opensource: {
    product: "Jackcaster",
    href: "/",
    label: "Open source and customizable",
    text: "Jackcaster is my open-source Farcaster client fork: customize your feeds, explore Mini Apps, and help shape what comes next:",
    tags: ["#Farcaster", "#OpenSource", "#Jackcaster"],
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
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    const option = SHARE_OPTIONS[style];
    const appUrl = new URL(option.href, window.location.origin).href;
    const text = `${SHARE_OPTIONS[style].text}${tags.length ? `\n\n${tags.join(" ")}` : ""}`;
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
      <label>Share angle<select value={style} onChange={(event) => { const next = event.target.value as ShareStyle; setStyle(next); setTags([...SHARE_OPTIONS[next].tags]); }}>
        {(Object.entries(SHARE_OPTIONS) as [ShareStyle, typeof SHARE_OPTIONS[ShareStyle]][]).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
      </select></label>
      <fieldset className="share-tags"><legend>Discovery tags</legend><p>Choose a few relevant tags. You can edit everything before posting.</p>
        {Array.from(new Set(Object.values(SHARE_OPTIONS).flatMap((option) => option.tags))).map((tag) => <button type="button" key={tag} className={tags.includes(tag) ? "active" : ""} aria-pressed={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 3} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 3 ? [...current, tag] : current)}>{tag}</button>)}
      </fieldset>
      <div className="share-preview"><small>CAST PREVIEW · {SHARE_OPTIONS[style].product.toUpperCase()}</small><p>{SHARE_OPTIONS[style].text}</p>{tags.length > 0 && <span>{tags.join(" ")}</span>}<small>{SHARE_OPTIONS[style].product} will be attached as a link. You can edit the cast before posting.</small></div>
    </>}
    <button type="button" className={full ? "btn primary" : "share-jackcaster-button"} onClick={() => void share()} disabled={busy}>
      <span aria-hidden="true">✦</span> {busy ? "Opening cast composer…" : "Share Jackcaster"}
    </button>
  </div>;
}
