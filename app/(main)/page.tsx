import { FeedComposer } from "@/components/FeedComposer";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { followingFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { FeedWelcome } from "@/components/FeedWelcome";

export default async function Home({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  try {
    const page = await followingFeed(cursor);
    const canWrite = viewer.canWrite;
    return (
      <>
        {!canWrite && (
          <div className="banner">
            Read-only mode. <a href="/setup" style={{ color: "var(--accent)", fontWeight: 500 }}>Connect your account</a> to cast, like and reply.
          </div>
        )}
        {canWrite && <FeedWelcome />}
        <FeedComposer canWrite={canWrite} cursor={cursor} />
        <Feed page={page} basePath="/" canWrite={canWrite} viewerFid={viewer.fid} live={cursor ? undefined : "following"} emptyTitle="Your feed is empty" emptyBody="Follow some people and they'll show up here, newest first." />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
