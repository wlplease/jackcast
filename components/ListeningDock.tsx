"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JACKCASTER_TRACKS, type AudioTrack } from "@/lib/audio-tracks";

export function ListeningDock({ personalTracks = [] }: { personalTracks?: AudioTrack[] }) {
  const tracks = useMemo(() => [...JACKCASTER_TRACKS, ...personalTracks], [personalTracks]);
  const audio = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState("");
  const current = tracks.find((track) => track.url === selected);

  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  useEffect(() => { if (audio.current) audio.current.loop = repeat; }, [repeat]);
  useEffect(() => {
    const pauseForOtherMedia = () => {
      if (!audio.current || audio.current.paused) return;
      audio.current.pause();
    };
    window.addEventListener("jackcaster:pause-background-audio", pauseForOtherMedia);
    return () => window.removeEventListener("jackcaster:pause-background-audio", pauseForOtherMedia);
  }, []);

  async function choose(track: AudioTrack, autoplay = true) {
    const player = audio.current;
    if (!player) return;
    setSelected(track.url);
    setError("");
    if (player.src !== new URL(track.url, window.location.href).href) {
      player.src = track.url;
      player.load();
    }
    if (!autoplay) { player.pause(); setPlaying(false); return; }
    try { await player.play(); setPlaying(true); }
    catch { setPlaying(false); setError("Playback was blocked or this audio file could not be opened. Press play to try again."); }
  }

  function step(direction: 1 | -1) {
    if (!tracks.length) return;
    if (shuffle && direction === 1 && tracks.length > 1) {
      const choices = tracks.filter((track) => track.url !== selected);
      void choose(choices[Math.floor(Math.random() * choices.length)]);
      return;
    }
    const index = tracks.findIndex((track) => track.url === selected);
    void choose(tracks[(index + direction + tracks.length) % tracks.length]);
  }

  return <div className="listening-dock">
    <button type="button" className="icon-btn listening-dock-toggle" aria-label="Open music player" aria-expanded={open} title="Listen" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      {playing && <span className="listening-playing-dot" aria-hidden="true" />}
    </button>
    <section className="listening-dock-panel" hidden={!open} aria-label="Jackcaster music player">
      <header><div><strong>Listen</strong><small>{current?.title ?? "Choose a soundtrack"}</small></div><button type="button" className="listening-close" onClick={() => setOpen(false)} aria-label="Minimize music player">×</button></header>
      <label className="sr-only" htmlFor="listening-track-select">Choose a track</label>
      <select id="listening-track-select" className="text-input" value={selected} onChange={(event) => { const track = tracks.find((item) => item.url === event.target.value); if (track) void choose(track, false); }}>
        <option value="">Choose a track…</option>
        <optgroup label="Jackcaster soundtrack">{JACKCASTER_TRACKS.map((track) => <option key={track.url} value={track.url}>{track.title}</option>)}</optgroup>
        {personalTracks.length > 0 && <optgroup label="Your tracks">{personalTracks.map((track) => <option key={track.url} value={track.url}>{track.title}</option>)}</optgroup>}
      </select>
      <audio ref={audio} controls preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { if (!repeat) step(1); }} />
      <div className="listening-dock-controls">
        <button type="button" className={shuffle ? "active" : ""} aria-pressed={shuffle} onClick={() => setShuffle((value) => !value)} title="Shuffle">⇄</button>
        <button type="button" onClick={() => step(-1)} aria-label="Previous track" title="Previous track">|◀</button>
        <button type="button" className="listening-play" onClick={() => { if (!selected) { void choose(tracks[0]); return; } if (audio.current?.paused) void audio.current.play().then(() => setPlaying(true)).catch(() => setError("Playback could not start. Try again.")); else audio.current?.pause(); }} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
        <button type="button" onClick={() => step(1)} aria-label="Next track" title="Next track">▶|</button>
        <button type="button" className={repeat ? "active" : ""} aria-pressed={repeat} onClick={() => setRepeat((value) => !value)} title="Repeat track">↻</button>
        <label className="listening-volume"><span aria-hidden="true">♪</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" /></label>
      </div>
      {error && <small className="form-error" role="status">{error}</small>}
      <small className="listening-dock-note">Playback starts only when you press play. <a href="/me#listening" onClick={() => setOpen(false)}>Manage your tracks</a></small>
    </section>
  </div>;
}
