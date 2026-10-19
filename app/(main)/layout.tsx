import { Masthead } from "@/components/Masthead";
import { FeedScrollRestoration } from "@/components/FeedScrollRestoration";
import { tabChannels } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { SavedCastsProvider } from "@/components/SavedCastsProvider";
import { MiniAppSessionProvider } from "@/components/MiniAppSession";
import { ArcadeDiscovery } from "@/components/ArcadeDiscovery";
import { profileStudioStatus } from "@/lib/profile-studio";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profileStudio = profileStudioStatus();
  let channels: string[] = [];
  try {
    const [nextChannels, prefs] = await Promise.all([tabChannels(), getPrefs()]);
    channels = nextChannels;
    return (
      <SavedCastsProvider initial={prefs.savedCasts}><MiniAppSessionProvider><div className="shell">
        <FeedScrollRestoration />
        <Masthead channels={channels} customName={prefs.customName} audioTracks={prefs.audioTracks} feedNames={prefs.feedNames} animatedProfilesEnabled={profileStudio.enabled} />
        <ArcadeDiscovery />
        <main>{children}</main>
      </div></MiniAppSessionProvider></SavedCastsProvider>
    );
  } catch {}

  return (
    <SavedCastsProvider initial={[]}><MiniAppSessionProvider><div className="shell">
      <FeedScrollRestoration />
      <Masthead channels={channels} customName="Custom" animatedProfilesEnabled={profileStudio.enabled} />
      <ArcadeDiscovery />
      <main>{children}</main>
    </div></MiniAppSessionProvider></SavedCastsProvider>
  );
}
