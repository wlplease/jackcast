import { notFound } from "next/navigation";
import { CastCard } from "@/components/CastCard";
import { Composer } from "@/components/Composer";
import { SetupBanner } from "@/components/SetupBanner";
import { ThreadReplyTree } from "@/components/ThreadReplyTree";
import { neynar } from "@/lib/neynar";
import { getMe } from "@/lib/data";
import { asCast } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";
import { buildReplyTree, THREAD_DEPTH } from "@/lib/thread-replies";

export default async function ThreadPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-f]{6,64}$/i.test(hash)) notFound();
  const viewer = await requireViewer();

  try {
    const [me, convo, prefs] = await Promise.all([
      getMe(),
      neynar().lookupCastConversation({
        identifier: hash,
        type: "hash",
        replyDepth: THREAD_DEPTH,
        includeChronologicalParentCasts: true,
        viewerFid: viewer.fid,
        limit: 50,
      }),
      getPrefs(),
    ]);

    const focus = asCast(convo.conversation.cast);
    // Keep the thread readable: never hide parents, but apply your filters to replies.
    const parents = (convo.conversation.chronological_parent_casts ?? []).map(asCast);
    const { nodes: replies, hidden, truncated } = await buildReplyTree(
      convo.conversation.cast.direct_replies ?? [],
      viewer.fid,
    );
    const canWrite = viewer.canWrite;

    return (
      <>
        <section className="thread-posts" aria-label="Post and its conversation context">
          {parents.length > 0 && <div className="thread-context-label">EARLIER IN THIS THREAD</div>}
          {parents.map((p) => (
            <CastCard key={p.hash} cast={p} canWrite={canWrite} variant="parent" showReplyTo={false} viewerFid={viewer.fid} mutes={prefs.mutes} />
          ))}
          <CastCard cast={focus} canWrite={canWrite} variant="focus" showReplyTo={false} viewerFid={viewer.fid} mutes={prefs.mutes} />
        </section>
        <ThreadReplyTree parentHash={focus.hash} initialNodes={replies} initialCursor={convo.next?.cursor ?? null} initialHidden={hidden} initiallyTruncated={truncated} canWrite={canWrite} viewerFid={viewer.fid} mutes={prefs.mutes} />
        {canWrite && (
          <Composer
            id="reply"
            me={me}
            parentHash={focus.hash}
            parentAuthorFid={focus.author.fid}
            placeholder={`Reply to @${focus.author.username}`}
          />
        )}
      </>
    );
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) notFound();
    return <SetupBanner error={e} />;
  }
}
