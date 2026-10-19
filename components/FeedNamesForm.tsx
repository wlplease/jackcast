"use client";

import { useState, useTransition, type FormEvent } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import { DEFAULT_FEED_NAMES, type FeedNames } from "@/lib/prefs-shared";

const LABELS: { key: keyof FeedNames; title: string }[] = [
  { key: "following", title: "Following" },
  { key: "friends", title: "Friends" },
  { key: "leaders", title: "Leaders" },
  { key: "recasts", title: "Recasts" },
  { key: "miniApps", title: "Mini Apps" },
  { key: "media", title: "Media" },
];

export function FeedNamesForm({ initial }: { initial: FeedNames }) {
  const [names, setNames] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = Object.fromEntries(Object.entries(names).map(([key, value]) => [key, value.trim().replace(/\s+/g, " ").slice(0, 18)])) as FeedNames;
    setNames(clean);
    setError("");
    start(async () => {
      const result = await savePrefs({ feedNames: clean });
      if (result.ok) { setNames(result.prefs.feedNames); setStatus("Saved on this device."); }
      else { setStatus(""); setError(result.error); }
    });
  }

  function reset() {
    setError("");
    start(async () => {
      const result = await savePrefs({ feedNames: DEFAULT_FEED_NAMES });
      if (result.ok) { setNames(result.prefs.feedNames); setStatus("Default labels restored."); }
      else { setStatus(""); setError(result.error); }
    });
  }

  return <form className="feed-names-form" onSubmit={submit}>
    <p className="field-hint">Rename the built-in feed tabs for this device. This only changes labels; each feed keeps the same posts and behavior. Your Custom feed already has its own name.</p>
    <div className="feed-names-grid">{LABELS.map(({ key, title }) => <label key={key}>{title}<input value={names[key]} maxLength={18} onChange={(event) => { setNames((current) => ({ ...current, [key]: event.target.value })); setStatus(""); }} /></label>)}</div>
    <div className="feed-names-actions"><button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save names"}</button><button className="btn ghost sm" type="button" onClick={reset} disabled={pending}>Restore defaults</button>{status && <span className="save-status saved" role="status">{status}</span>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
