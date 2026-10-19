import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";
import { themeById, themeCss } from "@/lib/themes";
import { BRAND } from "@/lib/brand";
import { SiteFooter } from "@/components/SiteFooter";
import { MiniAppHostReady } from "@/components/MiniAppHostReady";
import { UsageAnalytics } from "@/components/UsageAnalytics";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/jackcaster-icon.svg?v=4", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/favicon-32.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png?v=4", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png?v=4",
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
  const prefs = await getPrefs();
  const { theme, mode } = prefs;
  return (
    <html lang="en" data-theme={theme} data-mode={mode} data-density={prefs.density} data-previews={prefs.showPreviews ? "on" : "off"}>
      <head>
        {/* The chosen theme, rendered on the server so the first paint is already right. */}
        <style id="sc-theme" dangerouslySetInnerHTML={{ __html: themeCss(theme, mode) }} />
      </head>
      <body>
        <MiniAppHostReady />
        <UsageAnalytics />
        <div className="app-frame">
          <div className="app-content">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
