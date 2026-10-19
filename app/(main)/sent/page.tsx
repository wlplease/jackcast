import { FeedComposer } from "@/components/FeedComposer";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { jackcastFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function SentPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  try {
    const page = await jackcastFeed(cursor);
    return <>
      <div className="section-head"><div><h1>Sent</h1><p>Your public casts marked as posted through Jackcaster.</p></div></div>
      <FeedComposer canWrite={viewer.canWrite} cursor={cursor} />
      <Feed page={page} basePath="/sent" canWrite={viewer.canWrite} viewerFid={viewer.fid} live="jackcast" emptyTitle="No Jackcaster casts yet" emptyBody="Posts and replies you publish through Jackcaster will appear here. Casts from other clients are not included." />
    </>;
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
