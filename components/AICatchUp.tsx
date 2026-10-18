"use client";

import { useEffect, useState } from "react";
import type { CastView } from "@/lib/types";

type Digest = { storyline: string; sections: { title: string; summary: string }[] };

function providerError(error: unknown, service: "Gemini" | "ElevenLabs"): string {
  if (!(error instanceof Error)) return `${service} is temporarily unavailable. Try again later.`;
  if (/Failed to fetch|NetworkError|Load failed|Unexpected token|JSON Parse/i.test(error.message)) {
    return `Couldn't reach ${service}. Check service availability and try again later.`;
  }
  return error.message || `${service} is temporarily unavailable. Try again later.`;
}

export function AICatchUp({ casts, audioEnabled = false, digestEnabled = false }: { casts: CastView[]; audioEnabled?: boolean; digestEnabled?: boolean }) {
  const [digest, setDigest] = useState<Digest | null>(null);
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
    setDigest(null);
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
      const data = await response.json() as { digest?: Digest; error?: string };
      if (!response.ok || !data.digest?.storyline || !data.digest.sections?.length) throw new Error(data.error || "Could not make a digest right now.");
      setDigest(data.digest);
    } catch (e) {
      setError(providerError(e, "Gemini"));
    } finally {
      setBusy(false);
    }
  }

  function clearDigest() {
    setDigest(null);
    setError("");
    setAudioRequested(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
  }

  async function readAloud() {
    if (!digest || audioRequested || audioBusy) return;
    setAudioRequested(true);
    setAudioBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: [digest.storyline, ...digest.sections.map((section) => `${section.title}: ${section.summary}`)].join("\n\n") }),
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
          <p>A storyline and topic breakdown from up to 20 posts.</p>
        </div>
        <div className="ai-catchup-actions">
          <button type="button" onClick={summarize} disabled={busy || casts.length === 0 || Boolean(digest) || !digestEnabled}>
            {busy ? "Summarizing…" : digest ? "Digest ready" : digestEnabled ? "Make digest" : "AI not enabled"}
          </button>
          {digest && (
            <details className="ai-catchup-menu">
              <summary aria-label="Digest options" title="Digest options">⋯</summary>
              <div className="ai-catchup-menu-popover">
                <button type="button" onClick={summarize} disabled={busy}>Redo digest</button>
                <button type="button" onClick={clearDigest} disabled={busy || audioBusy}>Clear digest</button>
              </div>
            </details>
          )}
        </div>
      </div>
      {digest && <div className="ai-digest-content" aria-live="polite">
        <section className="ai-digest-story"><h3>The story</h3><p>{digest.storyline}</p></section>
        <div className="ai-digest-sections">{digest.sections.map((section, index) => <article className="ai-digest-section" key={`${section.title}-${index}`}><h4>{section.title}</h4><p>{section.summary}</p></article>)}</div>
      </div>}
      {digest && audioEnabled && (
        <div className="ai-catchup-audio">
          <button type="button" onClick={readAloud} disabled={audioBusy || audioRequested}>
            {audioBusy ? "Creating audio…" : audioUrl ? "Audio ready" : audioRequested ? "Audio attempt used" : "Read aloud"}
          </button>
          {audioUrl && <audio controls preload="none" src={audioUrl}>Audio playback is not supported in this browser.</audio>}
          {audioUrl && <a className="ai-catchup-download" href={audioUrl} download="jackcast-digest.mp3">Download MP3</a>}
        </div>
      )}
      {error && <p className="ai-catchup-error" role="alert"><strong>Service status:</strong> {error}</p>}
      {!digestEnabled && <p className="field-hint">Add GOOGLE_AI_API_KEY to the server environment to enable AI catch-up.</p>}
      <small>One digest and one audio request per visit. Selected post text and author names go to Google for the digest. If you choose Read aloud, only the generated digest goes to ElevenLabs. These services cannot take actions.</small>
    </section>
  );
}
