"use client";

import { useState } from "react";
import type { CastView } from "@/lib/types";

export function AICatchUp({ casts }: { casts: CastView[] }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    setError("");
    setSummary("");
    try {
      const response = await fetch("/api/ai/catch-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ casts: casts.slice(0, 20).map((cast) => ({
          author: cast.author.display_name || cast.author.username || "Unknown",
          text: cast.text,
          timestamp: cast.timestamp,
        })) }),
      });
      const data = await response.json() as { summary?: string; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || "Could not make a digest right now.");
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make a digest right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-catchup" aria-label="AI feed catch-up">
      <div className="ai-catchup-top">
        <div>
          <strong>Catch up with AI</strong>
          <p>Gemini reads up to 20 posts from this page when you ask.</p>
        </div>
        <button type="button" onClick={summarize} disabled={busy || casts.length === 0}>
          {busy ? "Summarizing…" : summary ? "Refresh digest" : "Make digest"}
        </button>
      </div>
      {summary && <p className="ai-catchup-summary" aria-live="polite">{summary}</p>}
      {error && <p className="ai-catchup-error" role="status">{error}</p>}
      <small>Post text and author names are sent to Google. The digest cannot take actions.</small>
    </section>
  );
}
