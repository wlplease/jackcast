import { Masthead } from "@/components/Masthead";
import { FeedScrollRestoration } from "@/components/FeedScrollRestoration";
import { tabChannels } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { SavedCastsProvider } from "@/components/SavedCastsProvider";
import { MiniAppSessionProvider } from "@/components/MiniAppSession";
import { ArcadeDiscovery } from "@/components/ArcadeDiscovery";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let channels: string[] = [];
  try {
    const [nextChannels, prefs] = await Promise.all([tabChannels(), getPrefs()]);
    channels = nextChannels;
    return (
      <SavedCastsProvider initial={prefs.savedCasts} initialCollections={prefs.savedCollections} initialAssignments={prefs.savedCastCollections}><MiniAppSessionProvider><div className="shell">
        <FeedScrollRestoration />
        <Masthead channels={channels} customName={prefs.customName} audioTracks={prefs.audioTracks} feedNames={prefs.feedNames} feedOrder={prefs.feedOrder} hiddenFeeds={prefs.hiddenFeeds} />
        <ArcadeDiscovery />
        <main>{children}</main>
      </div></MiniAppSessionProvider></SavedCastsProvider>
    );
  } catch {}

  return (
    <SavedCastsProvider initial={[]} initialCollections={[{ id: "inbox", name: "Reading list" }]} initialAssignments={[]}><MiniAppSessionProvider><div className="shell">
      <FeedScrollRestoration />
      <Masthead channels={channels} customName="Custom" />
      <ArcadeDiscovery />
      <main>{children}</main>
    </div></MiniAppSessionProvider></SavedCastsProvider>
  );
}
