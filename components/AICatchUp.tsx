"use client";

import { useEffect, useState } from "react";
import type { CastView } from "@/lib/types";

function providerError(error: unknown, service: "Gemini" | "ElevenLabs"): string {
  if (!(error instanceof Error)) return `${service} is temporarily unavailable. Try again later.`;
  if (/Failed to fetch|NetworkError|Load failed|Unexpected token|JSON Parse/i.test(error.message)) {
    return `Couldn't reach ${service}. Check service availability and try again later.`;
  }
  return error.message || `${service} is temporarily unavailable. Try again later.`;
}

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
    setAudioRequested(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
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
      setError(providerError(e, "Gemini"));
    } finally {
      setBusy(false);
    }
  }

  function clearDigest() {
    setSummary("");
    setError("");
    setAudioRequested(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
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
      setError(providerError(e, "ElevenLabs"));
    } finally {
      setAudioBusy(false);
    }
  }

  return (
    <section id="ai-catch-up" className="ai-catchup" aria-label="AI feed catch-up" tabIndex={-1}>
      <div className="ai-catchup-top">
        <div>
          <strong>Catch up with AI</strong>
          <p>Three quick highlights from up to 20 posts.</p>
        </div>
        <div className="ai-catchup-actions">
          <button type="button" onClick={summarize} disabled={busy || casts.length === 0 || Boolean(summary) || !process.env.NEXT_PUBLIC_AI_CATCHUP_ENABLED}>
            {busy ? "Summarizing…" : summary ? "Digest ready" : "Make digest"}
          </button>
          {summary && (
            <details className="ai-catchup-menu">
              <summary aria-label="Digest options" title="Digest options">⋯</summary>
              <div className="ai-catchup-menu-popover">
                <button type="button" onClick={summarize} disabled={busy}>Redo digest</button>
                <button type="button" onClick={clearDigest} disabled={busy || audioBusy}>Clear digest</button>
              </div>
            </details>
          )}
          <a className="ai-catchup-close" href="/" aria-label="Close AI catch-up">Close</a>
        </div>
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
      {error && <p className="ai-catchup-error" role="alert"><strong>Service status:</strong> {error}</p>}
      <small>One digest and one audio request per visit. Selected post text and author names go to Google for the digest. If you choose Read aloud, only the summary goes to ElevenLabs. These services cannot take actions.</small>
    </section>
  );
}
