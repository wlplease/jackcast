"use client";

import { useState } from "react";

export function CopyIntroLinkButton() {
  const [status, setStatus] = useState("");
  const [fallbackLink, setFallbackLink] = useState("");

  async function copyLink() {
    const link = new URL("/login", window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(link);
      setFallbackLink("");
      setStatus("Intro link copied.");
    } catch {
      setFallbackLink(link);
      setStatus("Clipboard access is unavailable. Select and copy this intro link:");
    }
  }

  return <span className="copy-intro-link"><button type="button" className="btn ghost" onClick={() => void copyLink()}>Copy intro link</button><small role="status" aria-live="polite">{status}</small>{fallbackLink && <input aria-label="Intro page link to copy" readOnly value={fallbackLink} onFocus={(event) => event.currentTarget.select()} />}</span>;
}
