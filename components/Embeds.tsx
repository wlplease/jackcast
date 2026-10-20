/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { EmbedView } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Player } from "./Player";
import { playerFor } from "@/lib/players";
import { VideoEmbed } from "./VideoEmbed";
import { ImageEmbed } from "./ImageEmbed";
import { withoutCastAttribution } from "@/lib/cast-attribution";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m3u8)(\?|$)/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|$)/i;

// Where Farcaster images actually live. Many of these URLs have no file extension
// (Farcaster's own uploads look like imagedelivery.net/<account>/<id>/original),
// and Neynar doesn't always include a content type, so match on the host too.
const IMAGE_HOSTS = [
  /(^|\.)imagedelivery\.net$/,
  /(^|\.)wrpcd\.net$/,
  /\.public\.blob\.vercel-storage\.com$/,
  /^i\.imgur\.com$/,
  /^res\.cloudinary\.com$/,
  /^media\.tenor\.com$/,
  /^media\d*\.giphy\.com$/,
  /^pbs\.twimg\.com$/,
  /^tba-mobile\.mypinata\.cloud$/,
];

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isImage(e: EmbedView) {
  if (e.metadata?.content_type?.startsWith("image/") || e.metadata?.image) return true;
  if (!e.url) return false;
  if (IMAGE_EXT.test(e.url)) return true;
  const h = host(e.url);
  if (/\.private\.blob\.vercel-storage\.com$/.test(h)) return !VIDEO_EXT.test(e.url);
  return IMAGE_HOSTS.some((re) => re.test(h)) && !VIDEO_EXT.test(e.url);
}
function isVideo(e: EmbedView) {
  return e.metadata?.content_type?.startsWith("video/") || (e.url && VIDEO_EXT.test(e.url)) || Boolean(e.metadata?.video);
}
function isAudio(e: EmbedView) {
  return e.metadata?.content_type?.startsWith("audio/") || (e.url && AUDIO_EXT.test(e.url));
}
function isAnimatedImage(url: string) {
  return /\.gif(?:[?#]|$)/i.test(url) || /(^|\.)media\d*\.giphy\.com$|(^|\.)media\.tenor\.com$/i.test(host(url));
}
/**
 * Photos from a private Vercel Blob store can't be opened directly, so the app serves them
 * itself at /i/<pathname> (see app/i/[...path]/route.ts).
 */
function viaProxy(url: string): string {
  try {
    const u = new URL(url);
    if (/\.private\.blob\.vercel-storage\.com$/.test(u.hostname)) return `/i${u.pathname}`;
  } catch {}
  return url;
}

/** Width over height, when Neynar knows it. */
function videoRatio(e: EmbedView): number | undefined {
  const s = e.metadata?.video?.stream?.find((x) => x.width_px && x.height_px);
  return s ? s.width_px! / s.height_px! : undefined;
}

export function Embeds({ embeds }: { embeds: EmbedView[] }) {
  if (!embeds?.length) return null;
  const images = embeds.filter((e) => !e.cast && e.url && isImage(e) && !isVideo(e) && !playerFor(e)).length;
  return (
    <div className={`embeds${images === 2 ? " pair" : ""}`}>
      {embeds.map((e, i) => {
        if (e.cast) {
          const quoteText = withoutCastAttribution(e.cast.text);
          return (
            <Link key={i} href={`/cast/${e.cast.hash}`} className="quote">
              <div className="q-head">
                <Avatar user={e.cast.author} size="sm" />
                <span>{e.cast.author.display_name || e.cast.author.username}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {quoteText.length > 280 ? quoteText.slice(0, 280) + "…" : quoteText}
              </div>
            </Link>
          );
        }
        if (!e.url) return null;
        const player = playerFor(e);
        if (isAudio(e)) return <AudioEmbed key={i} url={e.url} title={e.metadata?.html?.ogTitle} />;
        if (player) return <Player key={i} spec={player} />;
        if (isVideo(e)) {
          const preview = e.metadata?.html?.ogImage?.map((image) => image.url ?? "").find((url) => {
            try { return new URL(url).protocol === "https:"; } catch { return false; }
          });
          return <VideoEmbed key={i} url={e.url} ratio={videoRatio(e)} duration={e.metadata?.video?.duration_s} preview={preview} />;
        }
        if (isImage(e)) {
          const src = viaProxy(e.url);
          return (
            <ImageEmbed key={i} src={src} animated={isAnimatedImage(e.url)} />
          );
        }
        const og = e.metadata?.html;
        let host = "";
        try {
          host = new URL(e.url).hostname.replace(/^www\./, "");
        } catch {}
        return (
          <a key={i} className="embed-card" href={e.url} target="_blank" rel="noreferrer">
            <div>
              <div className="site">{og?.ogSiteName || host}</div>
              <div className="title">{og?.ogTitle || e.url}</div>
              {og?.ogDescription && <div className="desc">{og.ogDescription}</div>}
            </div>
            {og?.ogImage?.[0]?.url && <img src={og.ogImage[0].url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          </a>
        );
      })}
    </div>
  );
}

function AudioEmbed({ url, title }: { url: string; title?: string }) {
  let host = "Audio";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return <div className="audio-embed"><div className="audio-embed-heading"><span className="audio-embed-icon" aria-hidden="true">♫</span><span><strong>{title || "Audio post"}</strong><small>{host}</small></span><a href={url} target="_blank" rel="noreferrer" aria-label="Open audio source in a new tab">↗</a></div><audio controls preload="none" src={url}>Audio playback is not supported in this browser. <a href={url}>Open audio</a>.</audio></div>;
}
