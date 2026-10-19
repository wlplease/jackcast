import Link from "next/link";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { followingMediaFeed, type MediaKind } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

const TYPES: { id: MediaKind; label: string }[] = [
  { id: "all", label: "All media" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "image", label: "Images" },
];

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [viewer, prefs] = await Promise.all([requireViewer(), getPrefs()]);
  const params = await searchParams;
  const kind: MediaKind = TYPES.some((item) => item.id === params.type) ? params.type as MediaKind : "all";
  try {
    const page = await followingMediaFeed(kind);
    const basePath = `/media?type=${kind}`;
    return <>
      <section className="section-head"><div><h1>{prefs.feedNames.media}</h1><p>Photos, clips, and audio shared by people you follow.</p></div></section>
      <nav className="media-filters" aria-label="Filter media">{TYPES.map((type) => <Link key={type.id} href={`/media?type=${type.id}`} className="tab" aria-current={kind === type.id ? "page" : undefined}>{type.label}</Link>)}</nav>
      <Feed page={page} basePath={basePath} canWrite={viewer.canWrite} viewerFid={viewer.fid} live="media" emptyTitle={`No ${kind === "all" ? "media" : `${kind}s`} in this slice`} emptyBody="Keep scrolling to check older casts from people you follow." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
