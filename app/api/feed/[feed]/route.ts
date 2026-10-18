import { NextResponse, type NextRequest } from "next/server";
import { friendsFeed, followingFeed } from "@/lib/data";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ feed: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Connect your account first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { feed } = await params;
  if (feed !== "following" && feed !== "friends") return NextResponse.json({ error: "Unknown feed." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  if (cursor && (cursor.length > 4096 || /[\u0000-\u001f\u007f]/.test(cursor))) return NextResponse.json({ error: "Invalid feed cursor." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const page = feed === "following" ? await followingFeed(cursor) : await friendsFeed(cursor);
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn't load more casts. Try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
