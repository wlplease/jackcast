import { NextResponse } from "next/server";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await neynar().fetchAllNotifications({ fid: viewer.fid, limit: 25 });
    const count = Number.isSafeInteger(result.unseen_notifications_count) && result.unseen_notifications_count >= 0
      ? result.unseen_notifications_count
      : 0;
    const newestUnseenAt = result.notifications
      .filter((notification) => !notification.seen)
      .map((notification) => notification.most_recent_timestamp)
      .filter((timestamp): timestamp is string => typeof timestamp === "string")
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    return NextResponse.json({ count, newestUnseenAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Notification count unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
