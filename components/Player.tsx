"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { PlayerSpec } from "@/lib/players";
import { pauseBackgroundAudio } from "@/lib/audio-focus";

const ALLOW = "autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture";

export function Player({ spec }: { spec: PlayerSpec }) {
  const [on, setOn] = useState(false);
  const [youtubeThumbFallback, setYoutubeThumbFallback] = useState(false);

  if (spec.kind === "youtube") {
    if (!on) {
      return (
        <button type="button" className="player yt-facade" onClick={() => { pauseBackgroundAudio(); setOn(true); }} aria-label="Play video">
          <img src={`https://i.ytimg.com/vi/${spec.id}/${youtubeThumbFallback ? "hqdefault" : "maxresdefault"}.jpg`} alt="" loading="lazy" onError={() => { if (!youtubeThumbFallback) setYoutubeThumbFallback(true); }} />
          <span className="yt-play" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          </span>
        </button>
      );
    }
    const q = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0" });
    if (spec.start) q.set("start", String(spec.start));
    return (
      <div className="player yt">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${spec.id}?${q}`}
          title="YouTube video"
          allow={ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className={`player ${spec.provider}`}>
      <iframe
        src={spec.src}
        title={spec.title}
        height={spec.height}
        loading="lazy"
        allow={ALLOW}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
