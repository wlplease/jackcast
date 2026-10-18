export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string }
  | { kind: "mention"; value: string }
  | { kind: "channel"; value: string };

/** Splits cast text into plain text, links, @mentions and /channel references. */
export function tokenize(text: string): TextPart[] {
  const re = /(https?:\/\/[^\s]+)|(@[a-z0-9][a-z0-9-.]{0,30}[a-z0-9])|((?:^|(?<=\s))\/[a-z0-9-]{2,32}\b)/gi;
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ kind: "text", value: text.slice(last, i) });
    if (m[1]) parts.push({ kind: "url", value: m[1] });
    else if (m[2]) parts.push({ kind: "mention", value: m[2].slice(1) });
    else if (m[3]) parts.push({ kind: "channel", value: m[3].trim().slice(1) });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}
