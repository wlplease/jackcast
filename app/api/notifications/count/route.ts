import { NextResponse, type NextRequest } from "next/server";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await neynar().fetchAllNotifications({ fid: viewer.fid, limit: 100 });
    const count = Number.isSafeInteger(result.unseen_notifications_count) && result.unseen_notifications_count >= 0
      ? result.unseen_notifications_count
      : 0;
    const after = Number(request.nextUrl.searchParams.get("after"));
    const countAfter = Number.isFinite(after) && after > 0
      ? result.notifications.filter((notification) => {
          const timestamp = Date.parse(notification.most_recent_timestamp);
          return !notification.seen && Number.isFinite(timestamp) && timestamp > after;
        }).length
      : null;
    return NextResponse.json({ count, countAfter }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Neynar can temporarily throttle or fail. Treat this as unavailable rather
    // than returning a fake zero (or a browser-console 503); the client keeps its
    // last known badge and can refresh again later.
    return NextResponse.json({ unavailable: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
