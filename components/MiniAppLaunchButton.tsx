"use client";

import { useEffect, useRef, useState } from "react";

export function MiniAppLaunchButton({ app }: { app: { url: string; title: string } }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function launch() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const target = new URL(app.url);
      if (target.protocol !== "https:" || target.username || target.password) throw new Error("This app link is not secure.");
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        await sdk.actions.openMiniApp({ url: target.toString() });
        return;
      }
      setOpen(true);
    } catch {
      setMessage("Farcaster could not open this app natively. Showing a web preview instead.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="miniapp-launch" onClick={launch} disabled={busy} aria-label={`Open ${app.title}`}>
      {busy ? "Opening…" : "Open ↗"}
    </button>
    {open && <div className="miniapp-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="miniapp-viewer" role="dialog" aria-modal="true" aria-label={`${app.title} Mini App`}>
        <header className="miniapp-viewer-header">
          <button ref={closeRef} type="button" className="miniapp-viewer-back" onClick={() => setOpen(false)} aria-label="Close app preview">← <span>Back</span></button>
          <strong title={app.title}>{app.title}</strong>
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="miniapp-viewer-external" aria-label={`Open ${app.title} in a new tab`}>↗</a>
        </header>
        <div className="miniapp-viewer-note" role="status">
          {message || "Web preview · Farcaster wallet and native actions are available when opened from Farcaster."}
        </div>
        <iframe
          className="miniapp-viewer-frame"
          src={app.url}
          title={app.title}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      </section>
    </div>}
  </>;
}
