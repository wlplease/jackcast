"use client";

import { useState } from "react";
import { useMiniAppSession } from "@/components/MiniAppSession";

export function MiniAppLaunchButton({ app, onLaunch }: { app: { url: string; title: string }; onLaunch?: (app: { url: string; title: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { openMiniApp } = useMiniAppSession();

  async function launch() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    let target: URL;
    try { target = new URL(app.url); } catch { setMessage("This Mini App link is invalid and cannot be opened."); setBusy(false); return; }
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
      openMiniApp({ ...app, url: target.toString() });
    } catch {
      onLaunch?.(app);
      openMiniApp({ ...app, url: target.toString() }, "Farcaster native launch was unavailable. Showing the browser preview instead.");
    } finally { setBusy(false); }
  }

  return <span className="miniapp-launch-wrap"><button type="button" className="miniapp-launch" onClick={() => void launch()} disabled={busy} aria-label={`Open ${app.title}`}>
    {busy ? "Opening…" : "Open ↗"}
  </button>{message && <small className="form-error" role="status">{message}</small>}</span>;
}
