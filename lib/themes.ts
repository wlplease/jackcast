// Color themes. Shared by the server (renders the chosen theme's tokens into <head>, so there's
// no flash) and the browser (previews the theme immediately in Settings).
// Jackcaster is the default and lives in app/globals.css too.
// Add your own: copy an entry, give it an id in THEME_IDS, and run `npm run check:themes`.
// Every pairing is contrast-checked by scripts/check-themes.ts. Run it after changing a color.

export type Tokens = {
  paper: string; // page background
  card: string; // raised surfaces: composer, cards, inputs
  ink: string; // body text
  ink2: string; // secondary text (>= 4.5:1 on paper)
  ink3: string; // meta text: times, counts (>= 3:1 on paper)
  rule: string; // hairlines
  ruleStrong: string; // borders on controls
  brand: string; // fills: buttons, active tab, top bar, badges, focus
  onBrand: string; // text on brand fills (>= 4.5:1)
  accent: string; // brand-colored text: links, channel names (>= 4.5:1 on paper)
  accentSoft: string; // tinted backgrounds, focus halos
  like: string; // liked heart (>= 3:1 on paper)
  recast: string; // recasted icon (>= 3:1 on paper)
  chart: string; // stats bars (>= 3:1 on card)
};

export type Theme = { id: ThemeId; label: string; note: string; light: Tokens; dark: Tokens };

export const THEME_IDS = ["jackcaster", "selfcaster", "orange", "stone", "farcaster", "higher", "twitter", "x"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const MODES = ["auto", "light", "dark"] as const;
export type Mode = (typeof MODES)[number];

export const THEMES: Theme[] = [
  {
    id: "jackcaster",
    label: "Jackcaster",
    note: "Cool teal, mint, and a bright pink spark.",
    light: {
      paper: "#f5f8f6", card: "#eaf1ed", ink: "#14221e", ink2: "#405850", ink3: "#61766e",
      rule: "#dce7e1", ruleStrong: "#bfd0c6", brand: "#08786e", onBrand: "#ffffff",
      accent: "#00665e", accentSoft: "#dcf2eb", like: "#bf376e", recast: "#08786e", chart: "#08786e",
    },
    dark: {
      paper: "#0b1714", card: "#12251f", ink: "#edf7f1", ink2: "#b0c9bf", ink3: "#89a499",
      rule: "#213a32", ruleStrong: "#35564a", brand: "#91e4c8", onBrand: "#092119",
      accent: "#9be8ce", accentSoft: "#183a30", like: "#ff9fc5", recast: "#9be8ce", chart: "#58dcb3",
    },
  },
  {
    id: "selfcaster",
    label: "Selfcaster",
    note: "The original deep green, pink, and lemon palette.",
    light: {
      paper: "#f7f3ef", card: "#f0e8e2", ink: "#0d1f1c", ink2: "#3f5651", ink3: "#677b76",
      rule: "#e6ddd6", ruleStrong: "#d1c6be", brand: "#0d3733", onBrand: "#ffffff",
      accent: "#006060", accentSoft: "#dcefe9", like: "#c2387f", recast: "#006060", chart: "#007070",
    },
    dark: {
      paper: "#0a2421", card: "#0d3733", ink: "#eef4f1", ink2: "#a9c2bc", ink3: "#80a09a",
      rule: "#164540", ruleStrong: "#22564f", brand: "#f0a0d0", onBrand: "#0a2421",
      accent: "#e0e868", accentSoft: "#1f3f2a", like: "#f0a0d0", recast: "#e0e868", chart: "#38b8e0",
    },
  },
  {
    id: "orange",
    label: "Orange",
    note: "Orange on black and white.",
    light: {
      paper: "#ffffff", card: "#faf8f5", ink: "#0d0d0d", ink2: "#4a4845", ink3: "#8a8782",
      rule: "#eceae6", ruleStrong: "#d9d6d0", brand: "#ff6d0e", onBrand: "#0d0d0d",
      accent: "#b84c09", accentSoft: "#fff1e7", like: "#e8590c", recast: "#0d0d0d", chart: "#e8590c",
    },
    dark: {
      paper: "#0d0d0d", card: "#171615", ink: "#f6f4f0", ink2: "#b9b5ae", ink3: "#7d7a75",
      rule: "#262523", ruleStrong: "#3a3835", brand: "#ff6d0e", onBrand: "#0d0d0d",
      accent: "#ff8a3d", accentSoft: "#2a1608", like: "#ff6d0e", recast: "#f6f4f0", chart: "#ee620b",
    },
  },
  {
    id: "stone",
    label: "Stone",
    note: "Burnt orange on warm grays.",
    light: {
      paper: "#f3f2ee", card: "#e8e6e1", ink: "#2b2b27", ink2: "#55534e", ink3: "#77746d",
      rule: "#e0ddd7", ruleStrong: "#c9c5bd", brand: "#e2683c", onBrand: "#1e1e1a",
      accent: "#a8441c", accentSoft: "#f5e1d6", like: "#d65a2d", recast: "#3d3d37", chart: "#c95527",
    },
    dark: {
      paper: "#2e2e29", card: "#3d3d37", ink: "#e8e6e1", ink2: "#bdb9b1", ink3: "#9a968e",
      rule: "#45453e", ruleStrong: "#605e59", brand: "#e2683c", onBrand: "#1e1e1a",
      accent: "#f39470", accentSoft: "#4a3226", like: "#e8794f", recast: "#e8e6e1", chart: "#e2683c",
    },
  },
  {
    id: "farcaster",
    label: "Farcaster",
    note: "The purple.",
    light: {
      paper: "#ffffff", card: "#f8f7fc", ink: "#121019", ink2: "#4f4b5c", ink3: "#7f7a8c",
      rule: "#eceaf2", ruleStrong: "#d9d6e3", brand: "#6a4cf0", onBrand: "#ffffff",
      accent: "#5b3fe0", accentSoft: "#f1edff", like: "#e5484d", recast: "#1f9d55", chart: "#6a4cf0",
    },
    dark: {
      paper: "#101010", card: "#1a1a1a", ink: "#f5f5f5", ink2: "#adadad", ink3: "#808080",
      rule: "#262626", ruleStrong: "#383838", brand: "#866aff", onBrand: "#0b0b0f",
      accent: "#a290ff", accentSoft: "#221a40", like: "#f2555a", recast: "#3dd68c", chart: "#866aff",
    },
  },
  {
    id: "higher",
    label: "Higher",
    note: "Black, white and a green arrow. ↑",
    light: {
      paper: "#ffffff", card: "#f6f6f4", ink: "#000000", ink2: "#474747", ink3: "#7a7a7a",
      rule: "#ebebeb", ruleStrong: "#d4d4d4", brand: "#00d43a", onBrand: "#000000",
      accent: "#067a24", accentSoft: "#e2fbe8", like: "#00a82e", recast: "#000000", chart: "#04992d",
    },
    dark: {
      paper: "#000000", card: "#0e0e0e", ink: "#f2f2f2", ink2: "#a8a8a8", ink3: "#7a7a7a",
      rule: "#1f1f1f", ruleStrong: "#333333", brand: "#00ff41", onBrand: "#000000",
      accent: "#3dff6e", accentSoft: "#062b12", like: "#00ff41", recast: "#f2f2f2", chart: "#22e858",
    },
  },
  {
    id: "twitter",
    label: "Twitter",
    note: "The bird era. Sky blue, and Dim for dark mode.",
    light: {
      paper: "#ffffff", card: "#f5f8fa", ink: "#14171a", ink2: "#5b6b78", ink3: "#7b8a97",
      rule: "#e6ecf0", ruleStrong: "#ccd6dd", brand: "#1da1f2", onBrand: "#0b1a26",
      accent: "#0c74b8", accentSoft: "#e8f5fe", like: "#e0245e", recast: "#119a50", chart: "#1a8ad2",
    },
    dark: {
      paper: "#15202b", card: "#192734", ink: "#f7f9f9", ink2: "#a3b1bd", ink3: "#8496a3",
      rule: "#253341", ruleStrong: "#38444d", brand: "#1da1f2", onBrand: "#0b1a26",
      accent: "#4db5f5", accentSoft: "#13324a", like: "#f0507f", recast: "#1fcb72", chart: "#1da1f2",
    },
  },
  {
    id: "x",
    label: "X",
    note: "Monochrome with a blue link.",
    light: {
      paper: "#ffffff", card: "#f7f9f9", ink: "#0f1419", ink2: "#536471", ink3: "#6e7d89",
      rule: "#eff3f4", ruleStrong: "#cfd9de", brand: "#0f1419", onBrand: "#ffffff",
      accent: "#1570b8", accentSoft: "#e8f5fd", like: "#e0136f", recast: "#00875f", chart: "#1a7fc6",
    },
    dark: {
      paper: "#000000", card: "#16181c", ink: "#e7e9ea", ink2: "#8b9198", ink3: "#6c7177",
      rule: "#2f3336", ruleStrong: "#3e4144", brand: "#eff3f4", onBrand: "#0f1419",
      accent: "#1d9bf0", accentSoft: "#0a2a40", like: "#f91880", recast: "#00ba7c", chart: "#1d9bf0",
    },
  },
];

export const themeById = (id: string | null | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const VARS: [keyof Tokens, string][] = [
  ["paper", "--paper"], ["card", "--card"], ["ink", "--ink"], ["ink2", "--ink-2"], ["ink3", "--ink-3"],
  ["rule", "--rule"], ["ruleStrong", "--rule-strong"], ["brand", "--brand"], ["onBrand", "--on-brand"],
  ["accent", "--accent"], ["accentSoft", "--accent-soft"], ["like", "--like"], ["recast", "--recast"], ["chart", "--chart"],
];

const block = (t: Tokens, scheme: "light" | "dark") =>
  VARS.map(([k, v]) => `${v}:${t[k]};`).join("") + `color-scheme:${scheme};`;

/**
 * CSS for a theme + mode. `html:root` outranks the `:root` defaults in globals.css, so this can sit
 * anywhere in the page. Auto follows the system; light and dark pin it.
 */
export function themeCss(id: ThemeId, mode: Mode): string {
  const t = themeById(id);
  if (mode === "light") return `html:root{${block(t.light, "light")}}`;
  if (mode === "dark") return `html:root{${block(t.dark, "dark")}}`;
  return `html:root{${block(t.light, "light")}}@media (prefers-color-scheme: dark){html:root{${block(t.dark, "dark")}}}`;
}
