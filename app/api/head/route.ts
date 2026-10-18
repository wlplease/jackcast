import { NextResponse } from "next/server";
import { channelFeed, followingFeed } from "@/lib/data";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const LIMIT = 25;

/** Newest cast timestamps for a feed, so the "new casts" pill can count what's arrived. */
export async function GET(req: Request) {
  if (!(await getViewer())) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const feed = new URL(req.url).searchParams.get("feed") ?? "following";
  try {
    const page = feed.startsWith("c:") ? await channelFeed(feed.slice(2), undefined, LIMIT) : await followingFeed(undefined, LIMIT);
    return NextResponse.json({
      timestamps: page.casts.map((c) => c.timestamp),
      capped: page.casts.length + page.hidden >= LIMIT,
    });
  } catch {
    return NextResponse.json({ error: "Couldn't check" }, { status: 502 });
  }
}
