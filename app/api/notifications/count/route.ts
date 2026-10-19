import { NextResponse } from "next/server";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await neynar().fetchAllNotifications({ fid: viewer.fid, limit: 25 });
    const count = Number.isSafeInteger(result.unseen_notifications_count) ? result.unseen_notifications_count : 0;
    return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Notification count unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
