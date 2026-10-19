import { Masthead } from "@/components/Masthead";
import { FeedScrollRestoration } from "@/components/FeedScrollRestoration";
import { tabChannels } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { SavedCastsProvider } from "@/components/SavedCastsProvider";
import { MiniAppSessionProvider } from "@/components/MiniAppSession";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let channels: string[] = [];
  try {
    const [nextChannels, prefs] = await Promise.all([tabChannels(), getPrefs()]);
    channels = nextChannels;
    return (
      <SavedCastsProvider initial={prefs.savedCasts}><MiniAppSessionProvider><div className="shell">
        <FeedScrollRestoration />
        <Masthead channels={channels} customName={prefs.customName} audioTracks={prefs.audioTracks} />
        <main>{children}</main>
      </div></MiniAppSessionProvider></SavedCastsProvider>
    );
  } catch {}

  return (
    <SavedCastsProvider initial={[]}><MiniAppSessionProvider><div className="shell">
      <FeedScrollRestoration />
      <Masthead channels={channels} customName="Custom" />
      <main>{children}</main>
    </div></MiniAppSessionProvider></SavedCastsProvider>
  );
}
