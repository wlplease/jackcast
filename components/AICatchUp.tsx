"use client";

import { useEffect, useState } from "react";
import type { CastView } from "@/lib/types";

export function AICatchUp({ casts, audioEnabled = false }: { casts: CastView[]; audioEnabled?: boolean }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioRequested, setAudioRequested] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

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

  async function readAloud() {
    if (!summary || audioRequested || audioBusy) return;
    setAudioRequested(true);
    setAudioBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: summary }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Could not create audio right now.");
      }
      const audio = await response.blob();
      setAudioUrl(URL.createObjectURL(audio));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create audio right now.");
    } finally {
      setAudioBusy(false);
    }
  }

  return (
    <section id="ai-catch-up" className="ai-catchup" aria-label="AI feed catch-up" tabIndex={-1}>
      <div className="ai-catchup-top">
        <div>
          <strong>Catch up with AI</strong>
          <p>Gemini reads up to 20 posts from this page when you ask.</p>
        </div>
        <button type="button" onClick={summarize} disabled={busy || casts.length === 0 || Boolean(summary)}>
          {busy ? "Summarizing…" : summary ? "Digest ready" : "Make digest"}
        </button>
      </div>
      {summary && <p className="ai-catchup-summary" aria-live="polite">{summary}</p>}
      {summary && audioEnabled && (
        <div className="ai-catchup-audio">
          <button type="button" onClick={readAloud} disabled={audioBusy || audioRequested}>
            {audioBusy ? "Creating audio…" : audioUrl ? "Audio ready" : audioRequested ? "Audio attempt used" : "Read aloud"}
          </button>
          {audioUrl && <audio controls preload="none" src={audioUrl}>Audio playback is not supported in this browser.</audio>}
          {audioUrl && <a className="ai-catchup-download" href={audioUrl} download="jackcast-digest.mp3">Download MP3</a>}
        </div>
      )}
      {error && <p className="ai-catchup-error" role="status">{error}</p>}
      <small>One digest and one audio request per visit. Selected post text and author names go to Google for the digest. If you choose Read aloud, only the summary goes to ElevenLabs. These services cannot take actions.</small>
    </section>
  );
}
