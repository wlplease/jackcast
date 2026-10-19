"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import { BUILTIN_FEED_ORDER, type BuiltinFeedKey } from "@/lib/prefs-shared";

const LABELS: Record<BuiltinFeedKey, string> = { following: "Following", friends: "Friends", leaders: "Top Accounts", recasts: "Recasts", sent: "Sent", miniApps: "Mini Apps", media: "Media", custom: "Custom" };

export function FeedNavigationForm({ initialOrder, initialHidden }: { initialOrder: BuiltinFeedKey[]; initialHidden: BuiltinFeedKey[] }) {
  const [order, setOrder] = useState(initialOrder);
  const [hidden, setHidden] = useState(initialHidden);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function update(nextOrder: BuiltinFeedKey[], nextHidden: BuiltinFeedKey[]) {
    const previousOrder = order;
    const previousHidden = hidden;
    setOrder(nextOrder);
    setHidden(nextHidden);
    setStatus("Saving…");
    setError("");
    start(async () => {
      const result = await savePrefs({ feedOrder: nextOrder, hiddenFeeds: nextHidden });
      if (result.ok) { setOrder(result.prefs.feedOrder); setHidden(result.prefs.hiddenFeeds); setStatus("Saved on this device."); }
      else { setOrder(previousOrder); setHidden(previousHidden); setStatus(""); setError(result.error); }
    });
  }

  function move(key: BuiltinFeedKey, delta: -1 | 1) {
    const index = order.indexOf(key);
    const target = index + delta;
    if (target < 0 || target >= order.length || pending) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    update(next, hidden);
  }

  return <div className="feed-nav-settings">
    <p className="field-hint">Choose which built-in feeds appear in the header and set their order. Following always stays visible. These settings affect this device only.</p>
    <ol>{order.map((key, index) => <li key={key}>
      <label><input type="checkbox" checked={!hidden.includes(key)} disabled={pending || key === "following"} onChange={() => update(order, hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key])} /><span>{LABELS[key]}{key === "following" ? " · always shown" : ""}</span></label>
      <span className="feed-nav-moves"><button type="button" className="btn ghost sm" disabled={pending || index === 0} aria-label={`Move ${LABELS[key]} earlier`} onClick={() => move(key, -1)}>↑</button><button type="button" className="btn ghost sm" disabled={pending || index === order.length - 1} aria-label={`Move ${LABELS[key]} later`} onClick={() => move(key, 1)}>↓</button></span>
    </li>)}</ol>
    {status && <p className="save-status saved" role="status">{status}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="btn ghost sm" disabled={pending || (order.every((key, index) => key === BUILTIN_FEED_ORDER[index]) && hidden.length === 0)} onClick={() => update(BUILTIN_FEED_ORDER, [])}>Restore default tabs</button>
  </div>;
}
