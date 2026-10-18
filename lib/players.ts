import type { EmbedView } from "./types";

export type PlayerSpec =
  | { kind: "youtube"; id: string; start?: number; url: string }
  | { kind: "iframe"; provider: "spotify" | "soundcloud" | "archive" | "bandcamp"; src: string; height: number; title: string; url: string };

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function ytStart(u: URL): number | undefined {
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  if (!t) return undefined;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 ? s : undefined;
}

/** Recognizes links we can play inline. Returns null for everything else. */
export function playerFor(embed: EmbedView): PlayerSpec | null {
  if (!embed.url) return null;
  const u = safeUrl(embed.url);
  if (!u) return null;
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const path = u.pathname;

  // YouTube
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = path.slice(1).split("/")[0];
    else if (path === "/watch") id = u.searchParams.get("v");
    else {
      const m = path.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (m) id = m[1];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "youtube", id, start: ytStart(u), url: embed.url };
  }

  // Spotify
  if (host === "open.spotify.com") {
    const m = path.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
    if (m) {
      const [, type, id] = m;
      return {
        kind: "iframe",
        provider: "spotify",
        src: `https://open.spotify.com/embed/${type}/${id}`,
        height: type === "track" || type === "episode" ? 152 : 352,
        title: "Spotify player",
        url: embed.url,
      };
    }
  }

  // SoundCloud (full links, not on.soundcloud.com shorteners)
  if (host === "soundcloud.com" && path.split("/").filter(Boolean).length >= 2) {
    const params = new URLSearchParams({
      url: `https://soundcloud.com${path}`,
      color: "#ff6d0e",
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "true",
      visual: "false",
    });
    return { kind: "iframe", provider: "soundcloud", src: `https://w.soundcloud.com/player/?${params}`, height: 166, title: "SoundCloud player", url: embed.url };
  }

  // Internet Archive (hello, Grateful Dead tapes)
  if (host === "archive.org") {
    const m = path.match(/^\/details\/([\w.-]+)/);
    if (m) {
      return {
        kind: "iframe",
        provider: "archive",
        src: `https://archive.org/embed/${m[1]}?playlist=1&list_height=150`,
        height: 300,
        title: "Internet Archive player",
        url: embed.url,
      };
    }
  }

  // Bandcamp exposes its player URL in the page's og:video tag
  if (host.endsWith("bandcamp.com")) {
    const og = embed.metadata?.html?.ogVideo?.map((v) => v.url ?? "").find((v) => v.includes("bandcamp.com/EmbeddedPlayer")) ?? "";
    const m = og.match(/(album|track)=(\d+)/);
    if (m) {
      return {
        kind: "iframe",
        provider: "bandcamp",
        src: `https://bandcamp.com/EmbeddedPlayer/${m[1]}=${m[2]}/size=large/bgcol=ffffff/linkcol=ff6d0e/tracklist=false/artwork=small/transparent=true/`,
        height: 120,
        title: "Bandcamp player",
        url: embed.url,
      };
    }
  }

  return null;
}
