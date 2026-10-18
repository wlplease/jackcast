import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";
import { themeById, themeCss } from "@/lib/themes";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export async function generateViewport(): Promise<Viewport> {
  const { theme, mode } = await getPrefs();
  const t = themeById(theme);
  const themeColor =
    mode === "auto"
      ? [
          { media: "(prefers-color-scheme: light)", color: t.light.paper },
          { media: "(prefers-color-scheme: dark)", color: t.dark.paper },
        ]
      : (mode === "dark" ? t.dark : t.light).paper;
  return { themeColor, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme, mode } = await getPrefs();
  return (
    <html lang="en" data-theme={theme} data-mode={mode}>
      <head>
        {/* The chosen theme, rendered on the server so the first paint is already right. */}
        <style id="sc-theme" dangerouslySetInnerHTML={{ __html: themeCss(theme, mode) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
