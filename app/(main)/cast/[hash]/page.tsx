import { notFound } from "next/navigation";
import { CastCard } from "@/components/CastCard";
import { Composer } from "@/components/Composer";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { clean, getMe } from "@/lib/data";
import { asCast } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";

export default async function ThreadPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-f]{6,64}$/i.test(hash)) notFound();
  const viewer = await requireViewer();

  try {
    const [me, convo] = await Promise.all([
      getMe(),
      neynar().lookupCastConversation({
        identifier: hash,
        type: "hash",
        replyDepth: 2,
        includeChronologicalParentCasts: true,
        viewerFid: viewer.fid,
        limit: 50,
      }),
    ]);

    const focus = asCast(convo.conversation.cast);
    // Keep the thread readable: never hide parents, but apply your filters to replies.
    const parents = (convo.conversation.chronological_parent_casts ?? []).map(asCast);
    const { casts: replies, hidden } = await clean(convo.conversation.cast.direct_replies ?? [], viewer.fid);
    const canWrite = viewer.canWrite;

    return (
      <>
        {parents.map((p) => (
          <CastCard key={p.hash} cast={p} canWrite={canWrite} variant="parent" showReplyTo={false} />
        ))}
        <CastCard cast={focus} canWrite={canWrite} variant="focus" showReplyTo={false} />
        {canWrite && (
          <Composer
            id="reply"
            me={me}
            parentHash={focus.hash}
            parentAuthorFid={focus.author.fid}
            placeholder={`Reply to @${focus.author.username}`}
          />
        )}
        {replies.map((r) => (
          <CastCard key={r.hash} cast={r} canWrite={canWrite} showReplyTo={false} />
        ))}
        {hidden > 0 && <div className="hidden-note">{hidden} {hidden === 1 ? "reply" : "replies"} hidden by your filters.</div>}
        {!replies.length && (
          <div className="empty">
            <p>No replies yet.</p>
          </div>
        )}
      </>
    );
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) notFound();
    return <SetupBanner error={e} />;
  }
}
