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
      <p>Start with your Following feed. Tune who and what you see in <a href="/me">Settings</a>, meet new people in <a href="/friends">Friends</a>, and browse community-built <a href="/mini-apps">Mini Apps</a>. Your feed choices stay in this browser.</p>
      <small>Posting and reactions use your connected Farcaster signer. AI catch-up and read-aloud are optional; each sends only the information described beside its feature.</small>
    </div>
    <button type="button" onClick={dismiss} aria-label="Dismiss getting started guide">Got it</button>
  </aside>;
}
