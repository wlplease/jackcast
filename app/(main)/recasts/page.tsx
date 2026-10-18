import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { recastsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function RecastsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  try {
    const page = await recastsFeed(cursor);
    return (
      <>
        <div className="section-head"><h1>Recasts</h1><span className="meta">Your recasts</span></div>
        <Feed page={page} basePath="/recasts" canWrite={viewer.canWrite} viewerFid={viewer.fid} emptyTitle="No recasts yet" emptyBody="Posts you recast will collect here." />
      </>
    );
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
