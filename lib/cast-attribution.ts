export const CAST_ATTRIBUTION = "Casted from https://jackcast.vercel.app";
export const CAST_ATTRIBUTION_LINE = `\n\n${CAST_ATTRIBUTION}`;
export const MAX_CAST_BYTES = 1024;

/** Add the Jackcast source link and upgrade the previous Jackcaster URL in drafts. */
export function withCastAttribution(text: string): string {
  const trimmed = text.trim();
  const previousJackcast = /Casted from\s+https:\/\/jackcaster\.vercel\.app\/?/i;
  if (previousJackcast.test(trimmed)) return trimmed.replace(previousJackcast, CAST_ATTRIBUTION);
  if (/Casted from\s+https:\/\/jackcast\.vercel\.app\/?/i.test(trimmed)) return trimmed;
  return `${trimmed}${CAST_ATTRIBUTION_LINE}`;
}
