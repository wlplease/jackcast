"use client";

import { useEffect, useState } from "react";

const storageKey = "jackcaster:feed-welcome-dismissed:v1";

export function FeedWelcome({ mode }: { mode: "connected" | "read-only" | "setup" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { setVisible(localStorage.getItem(storageKey) !== "1"); }
    catch { setVisible(true); }
  }, []);

  if (!visible) return null;
  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(storageKey, "1"); } catch { /* Keep dismissal for this visit. */ }
  }

  return <aside className="feed-welcome" aria-labelledby="feed-welcome-title">
    <div className="feed-welcome-content">
      <span className="feed-welcome-kicker">START HERE</span>
      <strong id="feed-welcome-title">Welcome to Jackcaster</strong>
      <p>Your Farcaster feed, focused lists, conversations, Mini Apps, and media—all in one personal client.</p>
      {mode !== "setup" && <nav className="feed-welcome-links" aria-label="Quick start">
        <a href="/friends">Friends</a><a href="/mini-apps">Mini Apps</a><a href="/media">Media</a><a href="/me">Settings</a><a href="/welcome">Getting started guide <span aria-hidden="true">→</span></a>
      </nav>}
      <small>{mode === "connected" ? "Your account is connected on this device. You can post and reply from Jackcaster." : mode === "read-only" ? "Explore freely in read-only mode. Connect an account only when you want to post or react. Optional services can be turned off in Settings → Privacy choices." : "Choose a read-only account or connect your own in Setup to start browsing."}</small>
      {mode !== "connected" && <a className="feed-welcome-connect" href="/setup">{mode === "setup" ? "Set up an account" : "Connect account for posting"} <span aria-hidden="true">→</span></a>}
    </div>
    <button type="button" onClick={dismiss} aria-label="Dismiss welcome message">Got it</button>
  </aside>;
}
