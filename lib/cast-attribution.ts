export const CAST_ATTRIBUTION = "Casted from https://jackcaster.vercel.app";
export const CAST_ATTRIBUTION_LINE = `\n\n${CAST_ATTRIBUTION}`;
export const MAX_CAST_BYTES = 1024;

/** Add the Jackcaster source link while leaving an existing attribution untouched. */
export function withCastAttribution(text: string): string {
  const trimmed = text.trim();
  if (/casted from\s+https:\/\/jackcaster\.vercel\.app/i.test(trimmed)) return trimmed;
  return `${trimmed}${CAST_ATTRIBUTION_LINE}`;
}
