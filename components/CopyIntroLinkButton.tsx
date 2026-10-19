"use client";

import { useState } from "react";

export function CopyIntroLinkButton() {
  const [status, setStatus] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL("/login", window.location.origin).toString());
      setStatus("Intro link copied.");
    } catch {
      setStatus("Clipboard access is unavailable. Copy the page address from your browser.");
    }
  }

  return <span className="copy-intro-link"><button type="button" className="btn ghost" onClick={() => void copyLink()}>Copy intro link</button><small role="status" aria-live="polite">{status}</small></span>;
}
