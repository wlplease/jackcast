import Link from "next/link";
import type { CastView } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { RichText } from "./RichText";
import { Embeds } from "./Embeds";
import { CastActions } from "./CastActions";

export function CastCard({
  cast,
  canWrite,
  variant,
  showReplyTo = true,
  viewerFid,
  mutes,
}: {
  cast: CastView;
  canWrite: boolean;
  variant?: "focus" | "parent";
  showReplyTo?: boolean;
  viewerFid?: number;
  mutes?: string[];
}) {
  const a = cast.author;
  return (
    <article className={`cast${variant ? ` ${variant}` : ""}`}>
      {variant !== "focus" && <Link className="stretch" href={`/cast/${cast.hash}`} aria-label="Open thread" />}
      <Link href={`/u/${a.username}`}>
        <Avatar user={a} />
      </Link>
      <div style={{ minWidth: 0 }}>
        {cast.sharedByFollowed && <div className="recast-context">↻ Recasted by someone you follow</div>}
        {showReplyTo && cast.parent_hash && variant !== "parent" && (
          <div className="reply-to">replying in a thread</div>
        )}
        <header className="cast-head">
          <Link href={`/u/${a.username}`} className="name">
            {a.display_name || a.username}
          </Link>
          <span className="handle">@{a.username}</span>
          <span className="dot">·</span>
          <time dateTime={cast.timestamp} title={new Date(cast.timestamp).toLocaleString()}>
            {timeAgo(cast.timestamp)}
          </time>
          {cast.channel?.id && (
            <Link className="chan" href={`/c/${cast.channel.id}`}>
              /{cast.channel.id}
            </Link>
          )}
        </header>
        {cast.text && (
          <p className="cast-text">
            <RichText text={cast.text} />
          </p>
        )}
        <Embeds embeds={cast.embeds} />
        <CastActions
          hash={cast.hash}
          authorFid={a.fid}
          replies={cast.replies?.count ?? 0}
          likes={cast.reactions?.likes_count ?? 0}
          recasts={cast.reactions?.recasts_count ?? 0}
          liked={cast.viewer_context?.liked ?? false}
          recasted={cast.viewer_context?.recasted ?? false}
          canWrite={canWrite}
          authorUsername={a.username}
          viewerFid={viewerFid}
          mutes={mutes}
        />
      </div>
    </article>
  );
}
