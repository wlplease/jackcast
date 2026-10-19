import { Fragment } from "react";
import Link from "next/link";
import type { Page } from "@/lib/data";
import { CastCard } from "./CastCard";
import { CaughtUpProvider, SeenLine } from "./CaughtUp";
import { NewCastsPill } from "./NewCastsPill";
import { ExpandableCasts } from "./ExpandableCasts";
import { groupRepeatedLinks } from "@/lib/feed-groups";
import { getPrefs } from "@/lib/prefs";
import { ActiveFeedFilters } from "./ActiveFeedFilters";
import { InfiniteFeed } from "./InfiniteFeed";

export async function Feed({
  page,
  basePath,
  canWrite,
  live,
  viewerFid,
  emptyTitle = "Quiet in here",
  emptyBody = "Nothing to show yet.",
}: {
  page: Page;
  basePath: string;
  canWrite: boolean;
  /** Feed id ("following" or "c:<channel>") to enable the caught-up line and new-casts pill. First page only. */
  live?: string;
  viewerFid?: number;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const prefs = await getPrefs();
  const hiddenNote =
    page.hidden > 0 ? (
      <div className="hidden-note">
        {page.hidden} {page.hidden === 1 ? "cast" : "casts"} hidden by your filters.{" "}
        <Link href="/me#filters">Adjust</Link>
      </div>
    ) : null;

  if (!page.casts.length) {
    const infinite = live === "following" || live === "friends" || live === "media" || live === "top" || live === "jackcast";
    return (
      <>
        <ActiveFeedFilters prefs={prefs} />
        {live && <NewCastsPill feed={live} newest={null} />}
        {!infinite && <div className="empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyBody}</p>
        </div>}
        {infinite && <InfiniteFeed key={live === "media" ? mediaKindFrom(basePath) : live} initial={page} canWrite={canWrite} viewerFid={viewerFid ?? 0} mutes={prefs.mutes} groupLinks={prefs.groupLinks} live={live} mediaKind={live === "media" ? mediaKindFrom(basePath) : "all"} audioEnabled={Boolean((process.env.ELEVENLABS_API_KEY || process.env.ELEVELN_LAB_API_KEY) && process.env.ELEVENLABS_VOICE_ID)} digestEnabled={Boolean(process.env.GOOGLE_AI_API_KEY)} emptyTitle={emptyTitle} emptyBody={emptyBody} />}
        {hiddenNote}
        {page.cursor && (
          <Link className="more" href={`${basePath}${basePath.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(page.cursor)}`}>
            older →
          </Link>
        )}
      </>
    );
  }

  const groups = prefs.groupLinks ? groupRepeatedLinks(page.casts) : page.casts.map((cast) => [cast]);
  const list = groups.map((group, i) => (
    <Fragment key={group[0].hash}>
      {live && i > 0 && <SeenLine above={groups[i - 1][0].timestamp} below={group[0].timestamp} />}
      <CastCard cast={group[0]} canWrite={canWrite} viewerFid={viewerFid} mutes={prefs.mutes} />
      {group.length > 1 && (
        <ExpandableCasts count={group.length - 1}>
          {group.slice(1).map((cast) => <CastCard key={cast.hash} cast={cast} canWrite={canWrite} viewerFid={viewerFid} mutes={prefs.mutes} />)}
        </ExpandableCasts>
      )}
    </Fragment>
  ));

  const newest = page.casts[0]?.timestamp ?? null;

  return (
    <>
      <ActiveFeedFilters prefs={prefs} />
      {live ? (
        <>
          {live !== "top" && live !== "friends" && live !== "jackcast" && <NewCastsPill feed={live} newest={newest} />}
          {live === "following" || live === "friends" || live === "media" || live === "top" || live === "jackcast"
            ? <InfiniteFeed key={live === "media" ? mediaKindFrom(basePath) : live} initial={page} canWrite={canWrite} viewerFid={viewerFid ?? 0} mutes={prefs.mutes} groupLinks={prefs.groupLinks} live={live} mediaKind={live === "media" ? mediaKindFrom(basePath) : "all"} audioEnabled={Boolean((process.env.ELEVENLABS_API_KEY || process.env.ELEVELN_LAB_API_KEY) && process.env.ELEVENLABS_VOICE_ID)} digestEnabled={Boolean(process.env.GOOGLE_AI_API_KEY)} />
            : <CaughtUpProvider feed={live} newest={newest}>{list}</CaughtUpProvider>}
        </>
      ) : (
        list
      )}
      {hiddenNote}
      {page.cursor && !(live === "following" || live === "friends" || live === "media" || live === "top") && (
        <Link className="more" href={`${basePath}${basePath.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(page.cursor)}`}>
          older →
        </Link>
      )}
    </>
  );
}

function mediaKindFrom(basePath: string): string {
  return new URLSearchParams(basePath.split("?")[1] ?? "").get("type") ?? "all";
}
