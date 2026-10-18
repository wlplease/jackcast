// Contrast check for every theme in lib/themes.ts (WCAG 2 ratios).
// Run: node --experimental-strip-types scripts/check-themes.ts
import { THEMES, type Tokens } from "../lib/themes.ts";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const RULES: [keyof Tokens, keyof Tokens, number, string][] = [
  ["ink", "paper", 7, "body text"],
  ["ink", "card", 7, "text in cards"],
  ["ink2", "paper", 4.5, "secondary text"],
  ["ink2", "card", 4.5, "secondary text in cards"],
  ["ink3", "paper", 3, "meta text"],
  ["ink3", "card", 3, "meta text in cards"],
  ["onBrand", "brand", 4.5, "button labels"],
  ["accent", "paper", 4.5, "links"],
  ["accent", "card", 4.5, "links in cards"],
  ["like", "paper", 3, "liked heart"],
  ["recast", "paper", 3, "recast icon"],
  ["chart", "card", 3, "chart bars"],
];

let failed = 0;
for (const t of THEMES) {
  for (const mode of ["light", "dark"] as const) {
    const tok = t[mode];
    const bad = RULES.map(([a, b, min, what]) => ({ what, a, b, min, r: ratio(tok[a], tok[b]) })).filter((x) => x.r < x.min);
    const worst = Math.min(...RULES.map(([a, b, min]) => ratio(tok[a], tok[b]) / min));
    console.log(`${bad.length ? "FAIL" : "ok  "} ${t.id.padEnd(10)} ${mode.padEnd(5)} worst margin ${worst.toFixed(2)}x`);
    for (const x of bad) console.log(`       ${x.what}: ${x.a} on ${x.b} = ${x.r.toFixed(2)} (needs ${x.min})`);
    failed += bad.length;
  }
}
process.exit(failed ? 1 : 0);
