import type { CastView } from "./types";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds one matcher for all muted terms. $tickers, #tags and @handles match as whole tokens. */
export function muteMatcher(terms: string[]): ((text: string) => boolean) | null {
  if (!terms.length) return null;
  const parts = terms.map((t) => {
    const e = escape(t);
    // Word-ish edges where they make sense, so "gm" doesn't hide "programming".
    const start = /^[\w$#@]/.test(t) ? "(?:^|[^\\w$#@])" : "";
    const end = /\w$/.test(t) ? "(?![\\w])" : "";
    return `${start}${e}${end}`;
  });
  const re = new RegExp(parts.join("|"), "i");
  return (text) => re.test(text);
}

function searchableText(c: CastView): string {
  const bits = [c.text];
  for (const e of c.embeds ?? []) {
    if (e.cast?.text) bits.push(e.cast.text);
    if (e.metadata?.html?.ogTitle) bits.push(e.metadata.html.ogTitle);
  }
  return bits.join("\n");
}

export type FilterResult = { casts: CastView[]; hidden: number };

/** Applies the quality dial and muted words. Your own casts are never hidden. */
export function applyFilters(
  casts: CastView[],
  opts: { myFid: number; minScore: number; mutes: string[]; showReplies?: boolean; hideMiniApps?: boolean }
): FilterResult {
  const muted = muteMatcher(opts.mutes);
  const kept: CastView[] = [];
  let hidden = 0;
  for (const c of casts) {
    const isReply = Boolean(c.parent_hash);
    const hasMiniApp = (c.embeds ?? []).some((embed) => Boolean(embed.metadata?.frame));
    if ((opts.showReplies === false && isReply) || (opts.hideMiniApps && hasMiniApp)) {
      hidden++;
      continue;
    }
    if (c.author.fid === opts.myFid) {
      kept.push(c);
      continue;
    }
    const lowScore = opts.minScore > 0 && (c.author.score ?? 1) < opts.minScore;
    if (lowScore || (muted && muted(searchableText(c)))) {
      hidden++;
      continue;
    }
    kept.push(c);
  }
  return { casts: kept, hidden };
}
