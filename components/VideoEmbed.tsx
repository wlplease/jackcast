"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { pauseBackgroundAudio } from "@/lib/audio-focus";

/** Farcaster's own videos are HLS (.m3u8) with a thumbnail.jpg next to the playlist. */
export function thumbFor(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.endsWith(".m3u8")) return null;
    u.pathname = u.pathname.replace(/[^/]+\.m3u8$/, "thumbnail.jpg");
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Shows a poster until you tap, then plays. Safari plays HLS on its own; everywhere else
 * hls.js loads on the first tap, so a feed full of videos costs nothing until you press play.
 */
export function VideoEmbed({ url, ratio, duration, preview }: { url: string; ratio?: number; duration?: number; preview?: string }) {
  const hls = url.split("?")[0].endsWith(".m3u8");
  const nativePoster = hls ? thumbFor(url) : null;
  const posters = [preview, nativePoster].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  const [on, setOn] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const poster = posters[posterIndex];
  const style = { aspectRatio: ratio && ratio > 0.3 && ratio < 4 ? String(ratio) : "16 / 9", ...(ratio && ratio < 0.9 ? { maxHeight: "min(70dvh, 620px)" } : {}) };

  useEffect(() => {
    const video = ref.current;
    if (!on || !video) return;
    let destroy: (() => void) | undefined;
    const play = () => video.play().catch(() => {});
    if (!hls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      play();
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setFailed(true);
          return;
        }
        const h = new Hls({ capLevelToPlayerSize: true });
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setFailed(true);
        });
        h.loadSource(url);
        h.attachMedia(video);
        h.on(Hls.Events.MANIFEST_PARSED, play);
        destroy = () => h.destroy();
      });
    }
    return () => destroy?.();
  }, [on, hls, url]);

  if (failed) {
    return (
      <a className="embed-card" href={url} target="_blank" rel="noreferrer">
        <div>
          <div className="site">video</div>
          <div className="title">This video won&apos;t play here. Open it in a new tab.</div>
        </div>
      </a>
    );
  }

  if (!on) {
    return (
      <button type="button" className="player video-facade" style={style} onClick={() => { pauseBackgroundAudio(); setOn(true); }} aria-label="Play video">
        {poster ? (
          <img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPosterIndex((index) => index + 1)} />
        ) : !hls ? (
          <video src={`${url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} onLoadedData={(event) => { try { event.currentTarget.currentTime = 0.1; } catch {} }} />
        ) : <span className="video-facade-fallback">Video preview unavailable · tap to play</span>}
        <span className="video-playback-badge"><span className="yt-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>{duration && <small>{formatDuration(duration)}</small>}</span>
      </button>
    );
  }

  return (
    <div className="player video" style={style}>
      <video ref={ref} controls playsInline poster={poster ?? undefined} />
    </div>
  );
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
