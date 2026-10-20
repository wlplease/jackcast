"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import type { CastView } from "@/lib/types";
import { withoutCastAttribution } from "@/lib/cast-attribution";

export function PinnedCastForm({ casts, initial }: { casts: CastView[]; initial: string | null }) {
  const [hash, setHash] = useState(initial ?? "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function save(next: string) {
    setHash(next);
    setStatus("Saving…");
    setError("");
    start(async () => {
      const result = await savePrefs({ pinnedCastHash: next || null });
      if (result.ok) {
        setHash(result.prefs.pinnedCastHash ?? "");
        setStatus("Saved on this app");
      } else {
        setStatus("");
        setError(result.error);
      }
    });
  }

  return (
    <div className="field">
      <div className="field-head">
        <h3>Pinned cast</h3>
        <span className="save-status" aria-live="polite">{status}</span>
      </div>
      <p className="field-hint">Shown at the top of your profile in this Selfcaster. This does not pin it on Farcaster.</p>
      <select className="text-input" value={hash} onChange={(event) => save(event.target.value)}>
        <option value="">No pinned cast</option>
        {casts.map((cast) => (
          <option key={cast.hash} value={cast.hash}>{(withoutCastAttribution(cast.text) || "Photo or link").replace(/\s+/g, " ").slice(0, 72)}</option>
        ))}
      </select>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
