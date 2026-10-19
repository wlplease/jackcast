import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { topAccountsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export default async function TopAccountsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const [{ cursor }, viewer, prefs] = await Promise.all([searchParams, requireViewer(), getPrefs()]);
  try {
    const page = await topAccountsFeed(cursor);
    return <>
      <section className="section-head top-feed-head"><div><h1>{prefs.feedNames.leaders}</h1><p>Recent posts from Farcaster leaders and your most active follows, newest first.</p></div></section>
      <Feed page={page} basePath="/top" canWrite={viewer.canWrite} viewerFid={viewer.fid} live="top" emptyTitle="No recent posts from these accounts" emptyBody="New posts will appear here as the leaders and active accounts in your network cast." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
