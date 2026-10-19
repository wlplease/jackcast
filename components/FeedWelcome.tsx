"use client";

import { useEffect, useState } from "react";

const storageKey = "jackcaster:feed-welcome-dismissed:v1";

export function FeedWelcome() {
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
    <div><strong id="feed-welcome-title">Your Jackcaster, ready to explore</strong>
      <p>Start with your Following feed, then explore <a href="/friends">Friends</a>, <a href="/top">Top Accounts</a>, and <a href="/mini-apps">Mini Apps</a>. Visit <a href="/me">Settings</a> to reorder or hide feeds and choose a theme. Your feed choices stay in this browser.</p>
      <small>Read-only browsing works without connecting a signer. Posting and reactions need your own Farcaster connection. AI catch-up and read-aloud are optional; review each feature’s data note before using it.</small>
    </div>
    <button type="button" onClick={dismiss} aria-label="Dismiss getting started guide">Got it</button>
  </aside>;
}
