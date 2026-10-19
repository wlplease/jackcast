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
  const first = users[0].display_name || users[0].username || `FID ${users[0].fid}`;
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

  return (
    <>
      <div className="section-head">
        <h1>Notifications</h1>
        <NotificationControls count={unseenCount} canMarkRead={Boolean(signerUuid)} />
      </div>
      {(Array.isArray(res.notifications) ? res.notifications : []).map((n, i) => {
        const rawUsers: unknown[] =
          n.type === "follows"
            ? (n.follows ?? []).map((f) => f?.user)
            : n.type === "likes" || n.type === "recasts"
              ? (n.reactions ?? []).map((r) => r?.user)
              : n.cast
                ? [n.cast.author]
                : [];
        // Notification payloads can contain partial actors (for example, a deleted or
        // unavailable account). Keep one malformed actor from taking down the whole page.
        const users: Author[] = rawUsers.filter((user): user is Author =>
          Boolean(user && typeof user === "object" && Number.isSafeInteger((user as Author).fid) && (user as Author).fid > 0)
        );
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
      {(!Array.isArray(res.notifications) || !res.notifications.length) && (
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
