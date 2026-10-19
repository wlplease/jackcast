"use client";

import { useEffect, useRef, useState } from "react";

export function MiniAppLaunchButton({ app, onLaunch }: { app: { url: string; title: string }; onLaunch?: (app: { url: string; title: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || minimized) return;
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
  }, [open, minimized]);

  async function launch() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    let target: URL;
    try {
      target = new URL(app.url);
    } catch {
      setMessage("This Mini App link is invalid and cannot be opened.");
      setBusy(false);
      return;
    }
    if (target.protocol !== "https:" || target.username || target.password) {
      setMessage("This Mini App link is not secure and cannot be opened.");
      setBusy(false);
      return;
    }
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        onLaunch?.(app);
        await sdk.actions.openMiniApp({ url: target.toString() });
        return;
      }
      onLaunch?.(app);
      setMinimized(false);
      setOpen(true);
    } catch {
      onLaunch?.(app);
      setMessage("Farcaster could not open this app natively. Showing a web preview instead.");
      setMinimized(false);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="miniapp-launch" onClick={launch} disabled={busy} aria-label={`Open ${app.title}`}>
      {busy ? "Opening…" : "Open ↗"}
    </button>
    {open && !minimized && <div className="miniapp-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="miniapp-viewer" role="dialog" aria-modal="true" aria-label={`${app.title} Mini App`}>
        <header className="miniapp-viewer-header">
          <button ref={closeRef} type="button" className="miniapp-viewer-back" onClick={() => setOpen(false)} aria-label="Close app preview">← <span>Back</span></button>
          <strong title={app.title}>{app.title}</strong>
          <div className="miniapp-viewer-tools">
            <button type="button" className="miniapp-viewer-minimize" onClick={() => setMinimized(true)} aria-label={`Minimize ${app.title}`} title="Minimize">−</button>
            <a href={app.url} target="_blank" rel="noopener noreferrer" onClick={() => onLaunch?.(app)} className="miniapp-viewer-external" aria-label={`Open ${app.title} in a new tab`}>↗</a>
          </div>
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
    {open && minimized && <button type="button" className="miniapp-minimized-tray" onClick={() => setMinimized(false)} aria-label={`Restore ${app.title}`}>
      <span className="miniapp-tray-icon" aria-hidden="true">▣</span>
      <span className="miniapp-tray-title">{app.title}</span>
      <span className="miniapp-tray-restore" aria-hidden="true">↗</span>
    </button>}
  </>;
}
