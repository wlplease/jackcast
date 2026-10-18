import { Composer } from "@/components/Composer";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { followingFeed, getMe, composerChannels } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function Home({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  try {
    const [me, page, channels] = await Promise.all([getMe(), followingFeed(cursor), composerChannels()]);
    const canWrite = viewer.canWrite;
    return (
      <>
        {!canWrite && (
          <div className="banner">
            Read-only mode. <a href="/setup" style={{ color: "var(--accent)", fontWeight: 500 }}>Connect your account</a> to cast, like and reply.
          </div>
        )}
        {canWrite && !cursor && <Composer me={me} channels={channels} />}
        <Feed page={page} basePath="/" canWrite={canWrite} live={cursor ? undefined : "following"} emptyTitle="Your feed is empty" emptyBody="Follow some people and they'll show up here, newest first." />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
