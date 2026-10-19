"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePrefs } from "@/app/(main)/me/actions";
import { MAX_AUDIO_TRACKS, type Prefs } from "@/lib/prefs-shared";

type Track = Prefs["audioTracks"][number];

export function ListeningSettings({ initial }: { initial: Track[] }) {
  const router = useRouter();
  const [tracks, setTracks] = useState(initial);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(next: Track[]) {
    setBusy(true);
    setMessage("");
    try {
      const result = await savePrefs({ audioTracks: next });
      if (!result.ok) {
        setMessage(result.error);
        return false;
      }
      setTracks(result.prefs.audioTracks);
      router.refresh();
      return true;
    } catch {
      setMessage("Could not save your playlist. Try again shortly.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim().replace(/\s+/g, " ").slice(0, 48);
    let parsed: URL;
    try { parsed = new URL(url.trim()); } catch { setMessage("Enter a direct HTTPS audio link."); return; }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.href.length > 512) {
      setMessage("Use a secure HTTPS audio URL without embedded credentials (512 characters max).");
      return;
    }
    if (!cleanTitle) { setMessage("Add a short title for this track."); return; }
    if (tracks.some((track) => track.url === parsed.toString())) { setMessage("That track is already in your playlist."); return; }
    const saved = await update([...tracks, { title: cleanTitle, url: parsed.toString() }]);
    if (saved) { setTitle(""); setUrl(""); }
  }

  return <div className="listening-settings">
    <p className="field-hint">Open the Listen button in the top bar for Jackcaster’s soundtrack and your saved tracks. Nothing starts until you press play. Personal links are saved in this browser’s Jackcaster settings.</p>
    <div className="listening-user-tracks"><div className="me-section-head"><h3>Your tracks</h3><span className="meta">{tracks.length}/{MAX_AUDIO_TRACKS}</span></div>
    {tracks.length ? <div className="listening-track-list">{tracks.map((track) => <article className="listening-track" key={track.url}><div className="listening-track-head"><span className="audio-embed-icon" aria-hidden="true">♫</span><strong>{track.title}</strong><small>{new URL(track.url).hostname}</small></div><button className="linkish listening-remove" type="button" disabled={busy} onClick={() => void update(tracks.filter((item) => item.url !== track.url))}>Remove from your playlist</button></article>)}</div> : <div className="listening-empty"><span aria-hidden="true">＋</span><div><strong>Add your own audio</strong><p>Add up to {MAX_AUDIO_TRACKS} direct HTTPS audio links. Files can be hosted on your own site or storage.</p></div></div>}
    {tracks.length < MAX_AUDIO_TRACKS && <form className="listening-add" onSubmit={addTrack}>
      <label>Track name<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={48} placeholder="Quiet Feed" required /></label>
      <label>Direct audio URL<input className="text-input" type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={512} placeholder="https://…/track.mp3" required /></label>
      <button type="submit" className="btn ghost sm" disabled={busy}>{busy ? "Saving…" : "Add track"}</button>
    </form>}
    </div>
    {message && <p className="form-error" role="status">{message}</p>}
    <small className="listening-privacy">Your tracks accept HTTPS links only. Audio streams from the file’s host; Jackcaster doesn’t upload or store your personal audio.</small>
  </div>;
}
