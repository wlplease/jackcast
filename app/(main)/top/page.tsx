import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { topAccountsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function TopAccountsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const [{ cursor }, viewer] = await Promise.all([searchParams, requireViewer()]);
  try {
    const page = await topAccountsFeed(cursor);
    return <>
      <section className="section-head top-feed-head"><div><h1>Top Accounts</h1><p>Recent posts from Farcaster leaders and your most active follows. Accounts are selected by 90-day activity; posts appear newest first.</p></div></section>
      <Feed page={page} basePath="/top" canWrite={viewer.canWrite} viewerFid={viewer.fid} live="top" emptyTitle="No recent posts from these accounts" emptyBody="New posts will appear here as the leaders and active accounts in your network cast." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
