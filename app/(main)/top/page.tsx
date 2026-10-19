import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { topAccountsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";
import { FeedComposer } from "@/components/FeedComposer";

export default async function TopAccountsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const [{ cursor }, viewer, prefs] = await Promise.all([searchParams, requireViewer(), getPrefs()]);
  try {
    const page = await topAccountsFeed(cursor);
    return <>
      <section className="section-head top-feed-head"><div><h1>{prefs.feedNames.leaders}</h1><p>Recent posts from a shared Farcaster leaders roster, newest first. Your follows do not change this feed.</p></div></section>
      <FeedComposer canWrite={viewer.canWrite} cursor={cursor} />
      <Feed page={page} basePath="/top" canWrite={viewer.canWrite} viewerFid={viewer.fid} live="top" emptyTitle="No recent posts from this roster" emptyBody="New posts will appear here as these Farcaster leaders cast." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
