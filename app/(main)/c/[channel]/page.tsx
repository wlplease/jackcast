import { Composer } from "@/components/Composer";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { channelFeed, getMe, composerChannels } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channel: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { channel } = await params;
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  try {
    const [me, page, channels, info] = await Promise.all([
      getMe(),
      channelFeed(channel, cursor),
      composerChannels(),
      neynar()
        .lookupChannel({ id: channel })
        .then((r) => r.channel)
        .catch(() => null),
    ]);
    const canWrite = viewer.canWrite;
    return (
      <>
        <div className="section-head">
          <h1>/{channel}</h1>
          {info?.follower_count != null && <span className="meta">{info.follower_count.toLocaleString()} followers</span>}
        </div>
        {info?.description && <p style={{ margin: "0 18px 12px", color: "var(--ink-2)", fontSize: 14 }}>{info.description}</p>}
        {canWrite && !cursor && (
          <Composer me={me} defaultChannel={channel} channels={channels} placeholder={`Cast to /${channel}`} />
        )}
        <Feed page={page} basePath={`/c/${channel}`} canWrite={canWrite} viewerFid={viewer.fid} live={cursor ? undefined : `c:${channel}`} emptyBody={`No casts in /${channel} yet.`} />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
