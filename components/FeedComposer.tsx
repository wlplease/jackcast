import { Composer } from "@/components/Composer";
import { composerChannels, getMe } from "@/lib/data";

/** Shared composer for each first-page timeline. It only loads the signed-in
 * profile and channel choices when the viewer can publish. */
export async function FeedComposer({ canWrite, cursor, channel }: { canWrite: boolean; cursor?: string; channel?: string }) {
  if (!canWrite || cursor) return null;
  const [me, channels] = await Promise.all([getMe(), composerChannels()]);
  return <Composer me={me} channels={channels} defaultChannel={channel} placeholder={channel ? `Cast to /${channel}` : undefined} />;
}
