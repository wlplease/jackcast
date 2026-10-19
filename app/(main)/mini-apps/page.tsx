import { MiniAppsHub } from "@/components/MiniAppsHub";
import { SetupBanner } from "@/components/SetupBanner";
import { miniAppsOverview } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export default async function MiniAppsPage() {
  const viewer = await requireViewer();
  try {
    const [overview, prefs] = await Promise.all([miniAppsOverview(viewer.fid), getPrefs()]);
    return <MiniAppsHub {...overview} initialSaved={prefs.savedMiniApps} feedTitle={prefs.feedNames.miniApps} />;
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
