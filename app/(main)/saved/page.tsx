import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { savedCasts as loadSavedCasts } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { requireViewer } from "@/lib/viewer";

export default async function SavedPage() {
  const viewer = await requireViewer();
  const prefs = await getPrefs();
  try {
    const casts = await loadSavedCasts(prefs.savedCasts, viewer.fid);
    return <>
      <div className="section-head"><div><h1>Saved</h1><p>Posts you bookmarked to come back to.</p></div><span className="meta">{casts.length}/{prefs.savedCasts.length} available</span></div>
      <Feed page={{ casts, cursor: null, hidden: 0 }} basePath="/saved" canWrite={viewer.canWrite} viewerFid={viewer.fid} emptyTitle="Your reading list is clear" emptyBody="Use the bookmark button on any cast to save it here." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
