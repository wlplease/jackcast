"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pauseBackgroundAudio } from "@/lib/audio-focus";
import { trackUsage } from "@/components/UsageAnalytics";

type MiniApp = { url: string; title: string; sameOrigin: boolean };
type MiniAppSession = { openMiniApp: (app: { url: string; title: string }) => void };
const MiniAppSessionContext = createContext<MiniAppSession | null>(null);

export function useMiniAppSession() {
  const session = useContext(MiniAppSessionContext);
  if (!session) throw new Error("Mini App launch controls must be inside MiniAppSessionProvider.");
  return session;
}

export function MiniAppSessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<MiniApp | null>(null);
  const [minimized, setMinimized] = useState(false);

  const openMiniApp = useCallback((app: { url: string; title: string }) => {
    try {
      const url = new URL(app.url);
      if (url.protocol !== "https:" || url.username || url.password) return;
      pauseBackgroundAudio();
      setActive({ url: url.toString(), title: app.title.slice(0, 80), sameOrigin: url.origin === window.location.origin });
      trackUsage({ name: "mini_app_opened" });
      setMinimized(false);
    } catch { /* Launch buttons validate URLs and show the validation message. */ }
  }, []);

  const value = useMemo(() => ({ openMiniApp }), [openMiniApp]);

  useEffect(() => {
    if (!active || minimized) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMinimized(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, minimized]);

  const close = () => { setActive(null); setMinimized(false); };

  return <MiniAppSessionContext.Provider value={value}>
    {children}
    {active && <>
      <div className={`miniapp-viewer-backdrop${minimized ? " minimized" : ""}`} aria-hidden={minimized}>
        <section className="miniapp-viewer" role="dialog" aria-modal={!minimized} aria-label={`${active.title} Mini App`}>
          <header className="miniapp-viewer-header">
            <button type="button" className="miniapp-viewer-back" onClick={close} aria-label="Close Mini App">← <span>Back</span></button>
            <strong title={active.title}>{active.title}</strong>
            <div className="miniapp-viewer-tools">
              <button type="button" className="miniapp-viewer-minimize" onClick={() => setMinimized(true)} aria-label={`Minimize ${active.title}`} title="Minimize">−</button>
              <a href={active.url} target="_blank" rel="noopener noreferrer" className="miniapp-viewer-external" aria-label={`Open ${active.title} in a new tab`}>↗</a>
            </div>
          </header>
          <iframe
            className="miniapp-viewer-frame"
            src={active.url}
            title={active.title}
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox={`allow-forms allow-scripts${active.sameOrigin ? "" : " allow-same-origin"} allow-popups allow-popups-to-escape-sandbox allow-downloads`}
            allow="fullscreen; clipboard-read; clipboard-write"
          />
        </section>
      </div>
      {minimized && <div className="miniapp-minimized-tray">
        <button type="button" className="miniapp-tray-restore-button" onClick={() => setMinimized(false)} aria-label={`Restore ${active.title}`}>
          <span className="miniapp-tray-icon" aria-hidden="true">▣</span>
          <span className="miniapp-tray-title">{active.title}</span>
          <span className="miniapp-tray-restore">Open</span>
        </button>
        <button type="button" className="miniapp-tray-close" onClick={close} aria-label={`Close ${active.title}`} title="Close">×</button>
      </div>}
    </>}
  </MiniAppSessionContext.Provider>;
}
