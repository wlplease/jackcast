import type { CastView } from "./types";

function canonicalUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref_src)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function linkKey(cast: CastView): string | null {
  const urls = Array.from(new Set(cast.embeds.map((embed) => embed.url ? canonicalUrl(embed.url) : null).filter((url): url is string => !!url))).sort();
  return urls.length ? urls.join("\n") : null;
}

/** Keeps the newest cast first and groups only posts with an identical set of normalized links. */
export function groupRepeatedLinks(casts: CastView[]): CastView[][] {
  const groups: CastView[][] = [];
  const byKey = new Map<string, CastView[]>();
  for (const cast of casts) {
    const key = linkKey(cast);
    const group = key ? byKey.get(key) : undefined;
    if (group) group.push(cast);
    else {
      const next = [cast];
      groups.push(next);
      if (key) byKey.set(key, next);
    }
  }
  return groups;
}
