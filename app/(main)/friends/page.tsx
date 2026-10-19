import Link from "next/link";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { friendsFeed } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { requireViewer } from "@/lib/viewer";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  const prefs = await getPrefs();
  if (!prefs.friends.length) {
    return (
      <>
        <div className="section-head"><h1>Top Friends</h1></div>
        <div className="empty">
          <h2>Make this feed yours</h2>
          <p>Add your top 20 active accounts, 20 curated Farcaster accounts, or choose people yourself. Their newest posts will show up here.</p>
          <Link className="btn" href="/me#friends">Choose people</Link>
        </div>
      </>
    );
  }

  try {
    const page = await friendsFeed(cursor);
    return (
      <>
        <div className="section-head">
          <h1>Top Friends</h1>
          <span className="meta">{prefs.friends.length} people · newest first</span>
          <Link className="btn ghost sm" href="/me#friends">Manage Top Friends</Link>
        </div>
        <Feed page={page} basePath="/friends" canWrite={viewer.canWrite} viewerFid={viewer.fid} live={cursor ? undefined : "friends"} emptyTitle="Nothing new from your people" emptyBody="Their next casts will show up here." />
      </>
    );
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
