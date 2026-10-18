/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { EmbedView } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Player } from "./Player";
import { playerFor } from "@/lib/players";
import { VideoEmbed } from "./VideoEmbed";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m3u8)(\?|$)/i;

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
  return e.metadata?.content_type?.startsWith("video/") || (e.url && VIDEO_EXT.test(e.url)) || !!e.metadata?.video;
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
  const v = e.metadata?.video as { stream?: { width_px?: number; height_px?: number }[] } | undefined;
  const s = v?.stream?.find((x) => x.width_px && x.height_px);
  return s ? s.width_px! / s.height_px! : undefined;
}

export function Embeds({ embeds }: { embeds: EmbedView[] }) {
  if (!embeds?.length) return null;
  const images = embeds.filter((e) => !e.cast && e.url && isImage(e) && !isVideo(e) && !playerFor(e)).length;
  return (
    <div className={`embeds${images === 2 ? " pair" : ""}`}>
      {embeds.map((e, i) => {
        if (e.cast) {
          return (
            <Link key={i} href={`/cast/${e.cast.hash}`} className="quote">
              <div className="q-head">
                <Avatar user={e.cast.author} size="sm" />
                <span>{e.cast.author.display_name || e.cast.author.username}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {e.cast.text.length > 280 ? e.cast.text.slice(0, 280) + "…" : e.cast.text}
              </div>
            </Link>
          );
        }
        if (!e.url) return null;
        const player = playerFor(e);
        if (player) return <Player key={i} spec={player} />;
        if (isVideo(e)) return <VideoEmbed key={i} url={e.url} ratio={videoRatio(e)} />;
        if (isImage(e)) {
          const src = viaProxy(e.url);
          return (
            <a key={i} className="embed-image-link" href={src} target="_blank" rel="noreferrer">
              <img className="embed-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </a>
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
