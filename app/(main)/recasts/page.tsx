import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { recastsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export default async function RecastsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  const prefs = await getPrefs();
  try {
    const page = await recastsFeed(cursor);
    return (
      <>
        <div className="section-head"><h1>{prefs.feedNames.recasts}</h1><span className="meta">Shared by people you follow</span></div>
        <Feed page={page} basePath="/recasts" canWrite={viewer.canWrite} viewerFid={viewer.fid} emptyTitle="No new recasts" emptyBody="Posts recast by people you follow will show up here." />
      </>
    );
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
