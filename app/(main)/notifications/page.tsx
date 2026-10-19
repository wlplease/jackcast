import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { timeAgo } from "@/lib/format";
import type { Author } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";
import { NotificationControls } from "@/components/NotificationControls";

const GLYPH: Record<string, string> = {
  likes: "♥",
  recasts: "↻",
  follows: "+",
  reply: "↳",
  mention: "@",
  quote: "❝",
};

const VERB: Record<string, string> = {
  likes: "liked your cast",
  recasts: "recast your cast",
  follows: "followed you",
  reply: "replied",
  mention: "mentioned you",
  quote: "quoted you",
};

function whoLine(users: Author[], verb: string) {
  if (!users.length) return verb;
  const first = users[0].display_name || users[0].username;
  const rest = users.length - 1;
  return (
    <>
      <span className="who">{first}</span>
      {rest > 0 ? ` and ${rest} other${rest > 1 ? "s" : ""}` : ""} {verb}
    </>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  let res;
  try {
    res = await neynar().fetchAllNotifications({ fid: viewer.fid, limit: 25, cursor });
  } catch (e) {
    return <SetupBanner error={e} />;
  }

  const signerUuid = viewer.signerUuid;
  const unseenCount = Number.isSafeInteger(res.unseen_notifications_count) && res.unseen_notifications_count >= 0
    ? res.unseen_notifications_count
    : 0;
  const newestUnseenAt = res.notifications
    .filter((notification) => !notification.seen)
    .map((notification) => notification.most_recent_timestamp)
    .filter((timestamp): timestamp is string => typeof timestamp === "string")
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  return (
    <>
      <div className="section-head">
        <h1>Notifications</h1>
        <NotificationControls count={unseenCount} newestUnseenAt={newestUnseenAt} canMarkRead={Boolean(signerUuid)} />
      </div>
      {res.notifications.map((n, i) => {
        const users: Author[] =
          n.type === "follows"
            ? (n.follows ?? []).map((f) => f.user as Author)
            : n.type === "likes" || n.type === "recasts"
              ? (n.reactions ?? []).map((r) => r.user as Author)
              : n.cast
                ? [n.cast.author as Author]
                : [];
        const href = n.cast ? `/cast/${n.cast.hash}` : users[0]?.username ? `/u/${users[0].username}` : "#";
        return (
          <Link key={`${n.type}-${n.most_recent_timestamp}-${i}`} href={href} className={`note${n.seen ? "" : " unseen"}`} data-notification-time={n.most_recent_timestamp}>
            <div className="note-icon" aria-hidden="true">
              {GLYPH[n.type] ?? "•"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="note-faces">
                {users.slice(0, 8).map((u) => (
                  <Avatar key={u.fid} user={u} size="sm" />
                ))}
              </div>
              <div className="note-body">
                {whoLine(users, VERB[n.type] ?? n.type)}{" "}
                <span style={{ color: "var(--ink-3)" }}>· {timeAgo(n.most_recent_timestamp)}</span>
              </div>
              {n.cast?.text && <div className="note-snippet">{n.cast.text}</div>}
            </div>
          </Link>
        );
      })}
      {!res.notifications.length && (
        <div className="empty">
          <h2>All caught up</h2>
        </div>
      )}
      {res.next?.cursor && (
        <Link className="more" href={`/notifications?cursor=${encodeURIComponent(res.next.cursor)}`}>
          older →
        </Link>
      )}
    </>
  );
}
