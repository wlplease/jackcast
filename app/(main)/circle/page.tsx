import Link from "next/link";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { customFeed } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { requireViewer } from "@/lib/viewer";

export default async function CustomFeedPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  const prefs = await getPrefs();
  if (!prefs.customPeople.length) {
    return (
      <>
        <div className="section-head"><h1>{prefs.customName}</h1></div>
        <div className="empty">
          <h2>Build your own feed</h2>
          <p>Choose up to 10 people for a separate chronological feed. Name it anything you like.</p>
          <Link className="btn" href="/me#custom-feed">Set up this feed</Link>
        </div>
      </>
    );
  }

  try {
    const page = await customFeed(cursor);
    return (
      <>
        <div className="section-head"><h1>{prefs.customName}</h1><span className="meta">{prefs.customPeople.length} people · newest first</span></div>
        <Feed page={page} basePath="/circle" canWrite={viewer.canWrite} live={cursor ? undefined : "circle"} emptyTitle="Quiet in this feed" emptyBody="New casts from this group will show up here." />
      </>
    );
  } catch (error) {
    return <SetupBanner error={error} />;
  }
}
